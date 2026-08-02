import assert from 'node:assert/strict'
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectRoot = resolve(packageRoot, '..', '..', 'playground')
const testFixture = join(packageRoot, 'reference', 'tests', 'registryReloadFixture.scene.ts')
const exampleFixture = join(packageRoot, 'reference', 'examples', 'registryReloadFixture.scene.ts')
const fixtureSource = `export default { id: 'registry-reload-fixture' }\n`
const waitForReload = () => new Promise((resolve) => setTimeout(resolve, 175))
const cleanup = () => {
  rmSync(testFixture, { force: true })
  rmSync(exampleFixture, { force: true })
}

cleanup()
process.env.DEFINEDMOTION_PROJECT_ROOT = projectRoot

try {
  const config = (await import('../electron.vite.config.ts')).default
  const plugins = config.renderer.plugins
  const projectPlugin = plugins.find((plugin) => plugin?.name === 'definedmotion:project-modules')
  const reloadPlugin = plugins.find(
    (plugin) => plugin?.name === 'definedmotion:project-source-reload'
  )
  assert.ok(projectPlugin)
  assert.ok(reloadPlugin)

  const watcherListeners = new Map()
  const watchedPaths = []
  const invalidated = []
  const reloadMessages = []
  const transformed = []
  const modules = new Map([
    ['\0virtual:definedmotion-config', { id: '\0virtual:definedmotion-config' }],
    ['\0virtual:definedmotion-project', { id: '\0virtual:definedmotion-project' }]
  ])
  const server = {
    watcher: {
      add(paths) {
        watchedPaths.push(...paths)
      },
      on(event, listener) {
        watcherListeners.set(event, listener)
      },
      off(event) {
        watcherListeners.delete(event)
      }
    },
    moduleGraph: {
      getModuleById(id) {
        return modules.get(id)
      },
      invalidateModule(module) {
        invalidated.push(module.id)
      }
    },
    transformRequest(id) {
      transformed.push(id)
      return Promise.resolve({})
    },
    ws: {
      send(message) {
        reloadMessages.push(message)
      }
    },
    config: { logger: { error() {} } },
    httpServer: { once() {} }
  }

  reloadPlugin.configureServer(server)
  const referenceTestsRoot = join(packageRoot, 'reference', 'tests')
  const referenceExamplesRoot = join(packageRoot, 'reference', 'examples')
  assert.ok(watchedPaths.includes(referenceTestsRoot))
  assert.ok(watchedPaths.includes(referenceExamplesRoot))
  assert.deepEqual(reloadPlugin.handleHotUpdate({ file: testFixture }), [])
  assert.equal(reloadPlugin.handleHotUpdate({ file: join(packageRoot, 'README.md') }), undefined)

  const onWatcherEvent = watcherListeners.get('all')
  assert.equal(typeof onWatcherEvent, 'function')
  mkdirSync(dirname(testFixture), { recursive: true })
  writeFileSync(testFixture, fixtureSource)
  onWatcherEvent('add', testFixture)
  await waitForReload()
  assert.ok(invalidated.includes('\0virtual:definedmotion-project'))
  assert.ok(transformed.some((id) => id.endsWith('/reference/tests/registryReloadFixture.scene.ts')))
  assert.deepEqual(reloadMessages.at(-1), { type: 'full-reload' })
  assert.match(await projectPlugin.load('\0virtual:definedmotion-project'), /reference\/tests\/registryReloadFixture\.scene\.ts/)

  renameSync(testFixture, exampleFixture)
  onWatcherEvent('unlink', testFixture)
  onWatcherEvent('add', exampleFixture)
  await waitForReload()
  const movedRegistry = await projectPlugin.load('\0virtual:definedmotion-project')
  assert.doesNotMatch(movedRegistry, /reference\/tests\/registryReloadFixture\.scene\.ts/)
  assert.match(movedRegistry, /reference\/examples\/registryReloadFixture\.scene\.ts/)

  rmSync(exampleFixture)
  onWatcherEvent('unlink', exampleFixture)
  await waitForReload()
  assert.doesNotMatch(
    await projectPlugin.load('\0virtual:definedmotion-project'),
    /registryReloadFixture\.scene\.ts/
  )

  console.log('Scene registry live reload tests passed')
} finally {
  cleanup()
}
