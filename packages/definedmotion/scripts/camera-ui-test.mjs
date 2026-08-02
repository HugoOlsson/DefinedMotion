import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import * as THREE from 'three'
import ts from 'typescript'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const temporaryDirectory = await mkdtemp(join(packageRoot, '.camera-ui-test-'))

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

const overlayCamera = (layer) => {
  const camera = layer.root.children.find((child) => child.isCamera)
  assert.ok(camera)
  return camera
}

try {
  const outputPath = join(temporaryDirectory, 'cameraAttachedUi.mjs')
  await writeFile(
    outputPath,
    await transpile(join(packageRoot, 'src/runtime/scene/cameraAttachedUi.ts'))
  )
  const { CameraAttachedUiLayer } = await import(pathToFileURL(outputPath).href)

  // CAMERA-UI-01: perspective camera-local transforms follow the audience camera.
  const cameraParent = new THREE.Group()
  cameraParent.position.set(4, -2, 3)
  cameraParent.rotation.y = 0.35
  const perspective = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 400)
  perspective.position.set(1, 2, 12)
  cameraParent.add(perspective)
  const perspectiveLayer = new CameraAttachedUiLayer(perspective)
  const root = new THREE.Group()
  root.position.set(-3, 1.5, -18)
  assert.equal(perspectiveLayer.add(root), root)
  perspectiveLayer.syncCamera()
  const expected = perspective.localToWorld(root.position.clone())
  const actual = root.getWorldPosition(new THREE.Vector3())
  assert.ok(actual.distanceTo(expected) < 1e-8)
  assert.deepEqual(
    overlayCamera(perspectiveLayer).projectionMatrix.elements,
    perspective.projectionMatrix.elements
  )

  // CAMERA-UI-01: orthographic projection changes are synchronized too.
  const orthographic = new THREE.OrthographicCamera(-10, 10, 6, -6, 0.1, 100)
  const orthographicLayer = new CameraAttachedUiLayer(orthographic)
  orthographic.zoom = 1.8
  orthographic.updateProjectionMatrix()
  orthographicLayer.syncCamera()
  assert.deepEqual(
    overlayCamera(orthographicLayer).projectionMatrix.elements,
    orthographic.projectionMatrix.elements
  )

  // CAMERA-UI-02: the overlay pass clears world depth without changing materials.
  const material = new THREE.MeshBasicMaterial({ color: '#ffffff' })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 1), material)
  perspectiveLayer.add(mesh)
  const events = []
  const renderer = {
    autoClear: true,
    clearDepth: () => events.push('clear-depth'),
    render: (scene, camera) => {
      assert.equal(scene, perspectiveLayer.root)
      assert.equal(camera, overlayCamera(perspectiveLayer))
      events.push('render-ui')
    }
  }
  perspectiveLayer.render(renderer)
  assert.deepEqual(events, ['clear-depth', 'render-ui'])
  assert.equal(renderer.autoClear, true)
  assert.equal(material.depthTest, true)
  assert.equal(material.depthWrite, true)

  // CAMERA-UI-03/04: descendants are inherited and clearing removes every registered root.
  const appended = new THREE.Group()
  root.add(appended)
  assert.equal(perspectiveLayer.contains(appended), true)
  assert.equal(perspectiveLayer.size, 2)
  perspectiveLayer.clear()
  assert.equal(perspectiveLayer.size, 0)
  assert.equal(root.parent, null)
  assert.equal(mesh.parent, null)
  assert.equal(perspectiveLayer.contains(appended), false)

  console.log('camera-attached UI tests passed')
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true })
}
