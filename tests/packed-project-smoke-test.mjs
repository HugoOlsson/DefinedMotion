import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const definedMotionRoot = join(repositoryRoot, 'packages', 'definedmotion')
const creatorEntry = join(
  repositoryRoot,
  'packages',
  'create-definedmotion',
  'bin',
  'create-definedmotion.js'
)
const temporaryRoot = mkdtempSync(join(tmpdir(), 'definedmotion-packed-project-'))
const npmEnvironment = {
  ...process.env,
  npm_config_cache: join(tmpdir(), 'definedmotion-npm-cache'),
  npm_config_fund: 'false',
  npm_config_audit: 'false'
}

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    env: npmEnvironment,
    ...options
  })
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed\n${result.stdout ?? ''}\n${result.stderr ?? ''}`
    )
  }
  return result.stdout
}

const hashFile = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')

try {
  const packedOutput = run(
    'npm',
    ['pack', definedMotionRoot, '--json', '--pack-destination', temporaryRoot],
    { cwd: repositoryRoot }
  )
  const packageJsonStart = packedOutput.lastIndexOf('\n[')
  if (packageJsonStart === -1) throw new Error(`npm pack returned unexpected output: ${packedOutput}`)
  const tarball = join(temporaryRoot, JSON.parse(packedOutput.slice(packageJsonStart + 1))[0].filename)
  if (!existsSync(tarball)) throw new Error('DefinedMotion tarball was not created')

  run(process.execPath, [creatorEntry, 'consumer'], { cwd: temporaryRoot })
  const consumerRoot = join(temporaryRoot, 'consumer')
  const packagePath = join(consumerRoot, 'package.json')
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))
  packageJson.dependencies.definedmotion = `file:${tarball}`
  writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`)

  run('npm', ['install', '--prefer-offline'], { cwd: consumerRoot })

  for (const required of [
    'node_modules/definedmotion/cli/index.mjs',
    'node_modules/definedmotion/assets/fonts/Montserrat-Medium.woff',
    'node_modules/definedmotion/reference/INDEX.md',
    'node_modules/definedmotion/reference/catalog.json',
    'node_modules/definedmotion/reference/examples/tutorials/easy1.scene.ts',
    'node_modules/definedmotion/reference/tests/assets/test_asset_references.scene.ts'
  ]) {
    if (!existsSync(join(consumerRoot, required))) {
      throw new Error(`Packed consumer is missing ${required}`)
    }
  }

  for (const forbidden of [
    'node_modules/definedmotion/build',
    'node_modules/definedmotion/scripts',
    'node_modules/definedmotion/src/scenes'
  ]) {
    if (existsSync(join(consumerRoot, forbidden))) {
      throw new Error(`Packed consumer contains legacy structure ${forbidden}`)
    }
  }

  const userScene = join(consumerRoot, 'src', 'scenes', 'my-first-scene.scene.ts')
  const userSceneBeforeUpgrade = hashFile(userScene)
  run('npm', ['run', 'build'], { cwd: consumerRoot })
  const scenesOutput = run(
    'npm',
    ['run', 'dm', '--', 'scenes', '--no-build', '--json'],
    { cwd: consumerRoot }
  )
  const jsonStart = scenesOutput.indexOf('{')
  const result = JSON.parse(scenesOutput.slice(jsonStart))
  const ids = new Set(result.scenes.map((scene) => scene.id))
  for (const id of ['my-first-scene', 'tutorial-easy-1', 'test-asset-references']) {
    if (!ids.has(id)) throw new Error(`Packed consumer did not discover ${id}`)
  }

  run('npm', ['install', `definedmotion@file:${tarball}`, '--prefer-offline'], {
    cwd: consumerRoot
  })
  if (hashFile(userScene) !== userSceneBeforeUpgrade) {
    throw new Error('Updating DefinedMotion modified the user scene')
  }

  process.stdout.write(
    `Packed consumer verified with ${result.scenes.length} packaged and project scenes; ` +
      `dependency reinstall preserved the user scene\n`
  )
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true })
}
