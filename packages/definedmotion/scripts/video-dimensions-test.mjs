import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const temporaryDirectory = await mkdtemp(join(packageRoot, '.video-dimensions-test-'))

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
    join(temporaryDirectory, 'sceneErrors.mjs'),
    await transpile(join(packageRoot, 'src/runtime/scene/sceneErrors.ts'))
  )
  await writeFile(
    join(temporaryDirectory, 'videoDimensions.mjs'),
    (await transpile(join(packageRoot, 'src/runtime/rendering/videoDimensions.ts'))).replace(
      '../scene/sceneErrors',
      './sceneErrors.mjs'
    )
  )

  const { validateVideoDimensions } = await import(
    pathToFileURL(join(temporaryDirectory, 'videoDimensions.mjs')).href
  )

  assert.doesNotThrow(() => validateVideoDimensions(1920, 1080))
  assert.throws(
    () => validateVideoDimensions(1200, 675),
    (error) =>
      error?.code === 'INVALID_VIDEO_DIMENSIONS' &&
      error.message.includes('both be even') &&
      error.message.includes('1200×675')
  )
  assert.throws(
    () => validateVideoDimensions(0, 1080),
    (error) =>
      error?.code === 'INVALID_VIDEO_DIMENSIONS' &&
      error.message.includes('positive integers')
  )

  console.log('video dimension tests passed')
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true })
}
