import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const temporaryDirectory = await mkdtemp(join(packageRoot, '.viewer-preview-test-'))

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
  await mkdir(join(temporaryDirectory, 'scene'))
  await writeFile(
    join(temporaryDirectory, 'scene', 'sceneErrors.mjs'),
    await transpile(join(packageRoot, 'src/runtime/scene/sceneErrors.ts'))
  )
  await writeFile(
    join(temporaryDirectory, 'scene', 'scenePreview.mjs'),
    (await transpile(join(packageRoot, 'src/runtime/scene/scenePreview.ts'))).replace(
      './sceneErrors',
      './sceneErrors.mjs'
    )
  )
  await writeFile(
    join(temporaryDirectory, 'preferences.mjs'),
    await transpile(join(packageRoot, 'src/viewer/preferences.ts'))
  )

  const preview = await import(
    pathToFileURL(join(temporaryDirectory, 'scene', 'scenePreview.mjs')).href
  )
  const preferences = await import(
    pathToFileURL(join(temporaryDirectory, 'preferences.mjs')).href
  )

  // PREVIEW-01: a marker must identify a real frame and a clean animation boundary.
  assert.doesNotThrow(() => preview.validatePreviewMarker(2, 5))
  assert.throws(
    () => preview.validatePreviewMarker(5, 5),
    (error) => error?.code === 'INVALID_PREVIEW_MARKER' && /frames 0-4/.test(error.message)
  )
  assert.throws(
    () => preview.validatePreviewMarker(2, 5, { startFrame: 0, endFrame: 4 }),
    (error) =>
      error?.code === 'INVALID_PREVIEW_MARKER' && /animation \[0, 4\)/.test(error.message)
  )

  // PREVIEW-02: enabled viewer navigation cannot request history before the marker.
  assert.equal(preview.effectiveViewerFrame(0, 8, 3, true), 3)
  assert.equal(preview.effectiveViewerFrame(6, 8, 3, true), 6)
  assert.equal(preview.effectiveViewerFrame(20, 8, 3, true), 3)
  assert.equal(preview.effectiveViewerFrame(0, 8, 3, false), 0)

  // PREVIEW-03: preferences have stable defaults and tolerate older stored values.
  assert.deepEqual(preferences.normalizeViewerPreferences(undefined), {
    showExamplesAndTests: false,
    usePreviewMarker: true,
    showFpsMonitor: false
  })
  assert.deepEqual(
    preferences.normalizeViewerPreferences({
      selectedSceneId: 'demo',
      usePreviewMarker: false,
      showFpsMonitor: true
    }),
    {
      selectedSceneId: 'demo',
      showExamplesAndTests: false,
      usePreviewMarker: false,
      showFpsMonitor: true
    }
  )

  console.log('viewer preview tests passed')
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true })
}
