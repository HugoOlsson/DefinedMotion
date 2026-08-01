import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const temporaryDirectory = await mkdtemp(join(packageRoot, '.viewer-selection-test-'))

const transpile = async (inputPath) => {
  const source = await readFile(inputPath, 'utf8')
  const result = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Bundler
    },
    fileName: inputPath,
    reportDiagnostics: true
  })
  const errors = (result.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error
  )
  assert.equal(errors.length, 0, errors.map((error) => error.messageText).join('\n'))
  return result.outputText
}

try {
  await writeFile(
    join(temporaryDirectory, 'project.mjs'),
    await transpile(join(packageRoot, 'src/project.ts'))
  )
  await writeFile(
    join(temporaryDirectory, 'sceneSelection.mjs'),
    await transpile(join(packageRoot, 'src/viewer/sceneSelection.ts'))
  )
  await writeFile(
    join(temporaryDirectory, 'sceneState.mjs'),
    await transpile(join(packageRoot, 'src/renderer/sceneState.ts'))
  )
  await writeFile(
    join(temporaryDirectory, 'frameRateMonitor.mjs'),
    await transpile(join(packageRoot, 'src/viewer/frameRateMonitor.ts'))
  )

  const projectModule = await import(pathToFileURL(join(temporaryDirectory, 'project.mjs')).href)
  const selection = await import(
    pathToFileURL(join(temporaryDirectory, 'sceneSelection.mjs')).href
  )

  // SELECT-01: one registry exposes deterministic viewer group metadata.
  const project = projectModule.defineProject({
    fps: 60,
    renderEveryNthFrame: 1,
    seed: 1,
    defaultScene: 'project-scene',
    scenes: {
      'project-scene': { id: 'project-scene', create() {} },
      example: { id: 'example', assetNamespace: 'reference', create() {} },
      test: { id: 'test', assetNamespace: 'reference', isTest: true, create() {} }
    }
  })
  assert.deepEqual(
    projectModule.listProjectScenes(project).map(({ id, kind, isDefault }) => ({
      id,
      kind,
      isDefault
    })),
    [
      { id: 'project-scene', kind: 'project', isDefault: true },
      { id: 'example', kind: 'example', isDefault: false },
      { id: 'test', kind: 'test', isDefault: false }
    ]
  )

  // SELECT-03: only the newest generation remains eligible to publish state.
  const generations = new selection.SelectionGeneration()
  const first = generations.begin()
  const second = generations.begin()
  assert.equal(generations.isCurrent(first), false)
  assert.equal(generations.isCurrent(second), true)
  generations.invalidate()
  assert.equal(generations.isCurrent(second), false)

  // SELECT-05: missing stored IDs resolve explicitly to the configured default.
  const summaries = projectModule.listProjectScenes(project)
  assert.deepEqual(selection.resolveInitialScene(summaries, 'project-scene', 'example'), {
    id: 'example',
    fellBack: false
  })
  assert.deepEqual(selection.resolveInitialScene(summaries, 'project-scene', 'removed'), {
    id: 'project-scene',
    fellBack: true
  })

  // SELECT-06: hidden reference entries retain only the active selection.
  assert.deepEqual(
    selection.visibleScenesFor(summaries, 'example', false, 'example').map(({ id }) => id),
    ['example']
  )
  assert.deepEqual(selection.visibleScenesFor(summaries, 'test', false, 'example'), [])

  let currentUrl = 'http://localhost/?scene=example&frame=12'
  globalThis.window = {
    location: { href: currentUrl },
    history: {
      replaceState(_state, _unused, url) {
        currentUrl = String(url)
        globalThis.window.location.href = currentUrl
      }
    }
  }
  const sceneState = await import(
    pathToFileURL(join(temporaryDirectory, 'sceneState.mjs')).href
  )
  assert.equal(sceneState.restoredFrameForScene('example'), 12)
  assert.equal(sceneState.restoredFrameForScene('project-scene'), undefined)
  sceneState.updateStateInUrl('project-scene', 7)
  assert.equal(new URL(currentUrl).searchParams.get('scene'), 'project-scene')
  assert.equal(new URL(currentUrl).searchParams.get('frame'), '7')

  // The FPS monitor counts actual presentation intervals over a bounded window.
  const { FrameRateMonitor } = await import(
    pathToFileURL(join(temporaryDirectory, 'frameRateMonitor.mjs')).href
  )
  const monitor = new FrameRateMonitor(500)
  let measured
  for (let frame = 0; frame <= 30; frame++) measured = monitor.record((frame * 1000) / 60)
  assert.ok(Math.abs(measured - 60) < 1e-9)
  monitor.reset()
  assert.equal(monitor.record(1_000), undefined)

  console.log('viewer scene selection tests passed')
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true })
}
