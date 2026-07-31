import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import * as THREE from 'three'
import ts from 'typescript'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const sourceRoot = join(packageRoot, 'src/runtime')
const temporaryDirectory = await mkdtemp(join(packageRoot, '.verification-test-'))

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
    join(temporaryDirectory, 'measurement.mjs'),
    await transpile(join(sourceRoot, 'measurement.ts'))
  )
  await writeFile(
    join(temporaryDirectory, 'scene', 'sceneVerification.mjs'),
    await transpile(join(sourceRoot, 'scene/sceneVerification.ts'))
  )
  const measurement = await import(pathToFileURL(join(temporaryDirectory, 'measurement.mjs')).href)
  const { SceneVerificationRegistry } = await import(
    pathToFileURL(join(temporaryDirectory, 'scene', 'sceneVerification.mjs')).href
  )

  // VERIFY-01: canonical world bounds include descendants and current transforms.
  const root = new THREE.Group()
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 1))
  mesh.position.set(3, -1, 0)
  root.add(mesh)
  assert.deepEqual(measurement.worldBounds(root).min.toArray(), [1, -2, -0.5])
  assert.deepEqual(measurement.worldBounds(root).max.toArray(), [5, 0, 0.5])
  assert.equal(measurement.worldBounds(new THREE.Group()).isEmpty(), true)

  // VERIFY-02: screen bounds are logical pixels, unclipped, and null behind the camera.
  const camera = new THREE.OrthographicCamera(-10, 10, 5, -5, 1, 100)
  camera.position.z = 20
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)
  const projected = measurement.screenBounds(root, camera, 200, 100)
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(projected).map(([key, value]) => [key, Math.round(value * 1e6) / 1e6])
    ),
    {
      left: 110,
      right: 150,
      top: 50,
      bottom: 70,
      width: 40,
      height: 20
    }
  )
  root.position.x = 20
  assert.ok(measurement.screenBounds(root, camera, 200, 100).left > 200)
  root.position.set(0, 0, 30)
  assert.equal(measurement.screenBounds(root, camera, 200, 100), null)

  // VERIFY-03: hierarchy visibility is intentionally narrower than pixel visibility.
  const parent = new THREE.Group()
  const child = new THREE.Group()
  parent.add(child)
  assert.equal(measurement.isVisibleInHierarchy(child), true)
  parent.visible = false
  assert.equal(measurement.isVisibleInHierarchy(child), false)

  // VERIFY-04: registration rejects unstable IDs, duplicate IDs, and invalid ranges.
  const registry = new SceneVerificationRegistry()
  registry.register('valid', { frames: { start: 2, end: 5 } }, () => {})
  assert.equal(registry.snapshot()[0].options.frames.end, 5)
  assert.throws(() => registry.register('valid', {}, () => {}), /already registered/)
  assert.throws(() => registry.register(' bad', {}, () => {}), /without surrounding/)
  assert.throws(
    () => registry.register('range', { frames: { start: 4, end: 4 } }, () => {}),
    /end greater than start/
  )

  console.log('scene verification foundation tests passed')
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true })
}
