import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import * as THREE from 'three'
import ts from 'typescript'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const sourceRoot = join(packageRoot, 'src/runtime')
const temporaryDirectory = await mkdtemp(join(packageRoot, '.core-effects-test-'))

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

const compileModules = async () => {
  const animationDirectory = join(temporaryDirectory, 'animation')
  const sceneDirectory = join(temporaryDirectory, 'scene')
  await mkdir(animationDirectory)
  await mkdir(sceneDirectory)

  await writeFile(
    join(sceneDirectory, 'sceneErrors.mjs'),
    await transpile(join(sourceRoot, 'scene/sceneErrors.ts'))
  )
  const planOutput = (await transpile(join(sourceRoot, 'animation/plan.ts'))).replace(
    '../scene/sceneErrors',
    '../scene/sceneErrors.mjs'
  )
  await writeFile(join(animationDirectory, 'plan.mjs'), planOutput)

  const timelineOutput = (await transpile(join(sourceRoot, 'animation/timeline.ts')))
    .replace('./plan', './plan.mjs')
    .replace('../scene/sceneErrors', '../scene/sceneErrors.mjs')
  await writeFile(join(animationDirectory, 'timeline.mjs'), timelineOutput)

  const effectsOutput = (await transpile(join(sourceRoot, 'animation/effects.ts')))
    .replace('./plan', './plan.mjs')
    .replace('../scene/sceneErrors', '../scene/sceneErrors.mjs')
  await writeFile(join(animationDirectory, 'effects.mjs'), effectsOutput)

  const cameraEffectsOutput = (await transpile(join(sourceRoot, 'animation/cameraEffects.ts')))
    .replace('./effects', './effects.mjs')
    .replace('../scene/sceneErrors', '../scene/sceneErrors.mjs')
  await writeFile(join(animationDirectory, 'cameraEffects.mjs'), cameraEffectsOutput)

  await writeFile(
    join(animationDirectory, 'latexTransitionsAndWrite.mjs'),
    await transpile(join(sourceRoot, 'animation/latexTransitionsAndWrite.ts'))
  )

  const [effectsModule, cameraEffectsModule, latexEffectsModule, timelineModule] = await Promise.all([
    import(pathToFileURL(join(animationDirectory, 'effects.mjs')).href),
    import(pathToFileURL(join(animationDirectory, 'cameraEffects.mjs')).href),
    import(pathToFileURL(join(animationDirectory, 'latexTransitionsAndWrite.mjs')).href),
    import(pathToFileURL(join(animationDirectory, 'timeline.mjs')).href)
  ])
  return { ...effectsModule, ...cameraEffectsModule, ...latexEffectsModule, ...timelineModule }
}

const approximately = (actual, expected, message) => {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} !== ${expected}`)
}

try {
  const {
    AnimationTimeline,
    camera,
    createAnimation,
    createLatexParticleTransitionController,
    fadeIn,
    fadeOut,
    matchTransform,
    moveTo,
    opacityTo,
    rotateTo,
    scaleIn,
    scaleOut,
    scaleTo,
    wait
  } = await compileModules()

  // EFFECT-11: LaTeX particle transitions restore authored material state.
  {
    const parent = new THREE.Group()
    const fromMaterial = new THREE.MeshBasicMaterial({ opacity: 0.6, transparent: false })
    fromMaterial.depthWrite = true
    const toMaterial = new THREE.MeshBasicMaterial({ opacity: 0.35, transparent: false })
    toMaterial.depthWrite = false
    const from = new THREE.Group()
    const to = new THREE.Group()
    from.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 1), fromMaterial))
    to.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 2), toMaterial))
    parent.add(from, to)

    const transition = createLatexParticleTransitionController(from, to, {
      particleCount: 20
    })()
    transition.updater(0, 0, false)
    transition.updater(1, 1, true)

    assert.equal(from.visible, false)
    assert.equal(to.visible, true)
    assert.equal(fromMaterial.opacity, 0.6)
    assert.equal(fromMaterial.transparent, false)
    assert.equal(fromMaterial.depthWrite, true)
    assert.equal(toMaterial.opacity, 0.35)
    assert.equal(toMaterial.transparent, false)
    assert.equal(toMaterial.depthWrite, false)
  }

  // EFFECT-10: camera plans share late binding and update projection-specific zoom.
  {
    const timeline = new AnimationTimeline(2)
    const cameraObject = new THREE.PerspectiveCamera(75, 1, 0.1, 100)
    const pose = {
      position: new THREE.Vector3(2, 3, 4),
      rotation: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.5, 0))
    }
    timeline.add(
      camera.moveToPose(cameraObject, pose, { duration: 1, easing: 'linear' }),
      camera.zoomTo(cameraObject, 40, { duration: 1, easing: 'linear' })
    )
    pose.position.x = 6
    await timeline.runFrame(0)
    await timeline.runFrame(1)
    assert.deepEqual(cameraObject.position.toArray(), [6, 3, 4])
    approximately(cameraObject.quaternion.angleTo(pose.rotation), 0, 'camera pose rotation')
    assert.equal(cameraObject.fov, 40)

    const framingTimeline = new AnimationTimeline(2)
    const framingCamera = new THREE.PerspectiveCamera(60, 1, 0.1, 100)
    framingCamera.position.set(0, 0, 10)
    framingCamera.lookAt(0, 0, 0)
    framingCamera.updateMatrixWorld(true)
    const framingTarget = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2))
    framingTarget.position.set(4, 1, 0)
    framingTarget.updateMatrixWorld(true)
    framingTimeline.add(
      camera.frame(framingCamera, framingTarget, { duration: 1, easing: 'linear', padding: 1 })
    )
    await framingTimeline.runFrame(0)
    await framingTimeline.runFrame(1)
    const targetCenter = new THREE.Box3()
      .setFromObject(framingTarget)
      .getCenter(new THREE.Vector3())
    const cameraDirection = framingCamera.getWorldDirection(new THREE.Vector3())
    const directionToTarget = targetCenter.clone().sub(framingCamera.position).normalize()
    assert.ok(cameraDirection.distanceTo(directionToTarget) < 1e-9)
  }

  // EFFECT-01: fadeOut hides the root and restores authored material state.
  {
    const timeline = new AnimationTimeline(3)
    const material = new THREE.MeshBasicMaterial({ opacity: 0.8, transparent: false })
    material.depthWrite = false
    const object = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material)
    const sharedObject = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material)
    timeline.add(fadeOut(object, { duration: 1, easing: 'linear' }))
    await timeline.runFrame(0)
    assert.equal(object.visible, true)
    assert.equal(material.opacity, 0.8)
    assert.equal(material.transparent, true)
    assert.equal(sharedObject.material.opacity, 0.8)
    await timeline.runFrame(1)
    approximately(material.opacity, 0.4, 'middle fade opacity')
    await timeline.runFrame(2)
    assert.equal(object.visible, false)
    assert.equal(material.opacity, 0.8)
    assert.equal(material.transparent, false)
    assert.equal(material.depthWrite, false)
    assert.equal(object.material, material)
    assert.equal(sharedObject.material, material)
  }

  // EFFECT-02: fadeIn needs no state shared with the preceding fadeOut occurrence.
  {
    const timeline = new AnimationTimeline(2)
    const material = new THREE.MeshBasicMaterial({ opacity: 0.6, transparent: false })
    const object = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material)
    timeline.add(fadeOut(object, { duration: 1, easing: 'linear' }))
    timeline.add(fadeIn(object, { duration: 1, easing: 'linear' }))
    await timeline.runFrame(0)
    await timeline.runFrame(1)
    assert.equal(object.visible, false)
    assert.equal(material.opacity, 0.6)
    await timeline.runFrame(2)
    assert.equal(object.visible, false)
    assert.equal(material.opacity, 0)
    assert.equal(material.transparent, true)
    await timeline.runFrame(3)
    assert.equal(object.visible, true)
    assert.equal(material.opacity, 0.6)
    assert.equal(material.transparent, false)
  }

  // EFFECT-03: one-frame fades apply only their exact final lifecycle state.
  {
    const timeline = new AnimationTimeline(10)
    const material = new THREE.MeshBasicMaterial({ opacity: 0.7, transparent: false })
    const object = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material)
    timeline.add(fadeOut(object, { duration: 0.1 }))
    await timeline.runFrame(0)
    assert.equal(object.visible, false)
    assert.equal(material.opacity, 0.7)
    assert.equal(material.transparent, false)
  }

  // EFFECT-04: opacityTo owns opacity/transparency but not root visibility.
  {
    const timeline = new AnimationTimeline(2)
    const material = new THREE.MeshBasicMaterial({ opacity: 1, transparent: false })
    const object = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material)
    object.visible = false
    timeline.add(opacityTo(object, 0.5, { duration: 1, easing: 'linear' }))
    await timeline.runFrame(0)
    await timeline.runFrame(1)
    assert.equal(object.visible, false)
    assert.equal(material.opacity, 0.5)
    assert.equal(material.transparent, true)
  }

  // EFFECT-05: scale helpers capture runtime targets and control scale only.
  {
    const timeline = new AnimationTimeline(2)
    const object = new THREE.Object3D()
    object.scale.set(2, 3, 4)
    timeline.add(scaleIn(object, { duration: 1, easing: 'linear' }))
    timeline.add(scaleOut(object, { duration: 1, easing: 'linear' }))
    await timeline.runFrame(0)
    assert.deepEqual(object.scale.toArray(), [0, 0, 0])
    await timeline.runFrame(1)
    assert.deepEqual(object.scale.toArray(), [2, 3, 4])
    await timeline.runFrame(2)
    assert.deepEqual(object.scale.toArray(), [2, 3, 4])
    await timeline.runFrame(3)
    assert.deepEqual(object.scale.toArray(), [0, 0, 0])
  }

  // EFFECT-06: local move/rotation targets are read when the occurrence binds.
  {
    const timeline = new AnimationTimeline(2)
    const object = new THREE.Object3D()
    const position = new THREE.Vector3(2, 0, 0)
    const rotation = new THREE.Euler(0, 0, Math.PI / 2)
    timeline.add(
      moveTo(object, position, { duration: 1, easing: 'linear' }),
      rotateTo(object, rotation, { duration: 1, easing: 'linear' })
    )
    position.x = 4
    rotation.z = Math.PI
    await timeline.runFrame(0)
    await timeline.runFrame(1)
    assert.deepEqual(object.position.toArray(), [4, 0, 0])
    approximately(object.rotation.z, Math.PI, 'runtime rotation target')
  }

  // EFFECT-07: world-space targets convert once through the parent at bind time.
  {
    const timeline = new AnimationTimeline(2)
    const parent = new THREE.Object3D()
    parent.position.x = 10
    const object = new THREE.Object3D()
    parent.add(object)
    parent.updateMatrixWorld(true)
    timeline.add(
      moveTo(object, new THREE.Vector3(14, 0, 0), {
        duration: 1,
        easing: 'linear',
        space: 'world'
      })
    )
    await timeline.runFrame(0)
    await timeline.runFrame(1)
    assert.deepEqual(object.position.toArray(), [4, 0, 0])
  }

  // EFFECT-08: matchTransform reproduces a reference world pose across parents.
  {
    const timeline = new AnimationTimeline(2)
    const targetParent = new THREE.Object3D()
    targetParent.position.set(5, 0, 0)
    const object = new THREE.Object3D()
    targetParent.add(object)
    const reference = new THREE.Object3D()
    reference.position.set(8, 2, 0)
    reference.rotation.z = 0.4
    reference.scale.set(2, 2, 2)
    targetParent.updateMatrixWorld(true)
    reference.updateMatrixWorld(true)
    timeline.add(matchTransform(object, reference, { duration: 1, easing: 'linear' }))
    reference.position.x = 9
    await timeline.runFrame(0)
    await timeline.runFrame(1)
    object.updateWorldMatrix(true, false)
    reference.updateWorldMatrix(true, false)
    const actualPosition = new THREE.Vector3().setFromMatrixPosition(object.matrixWorld)
    const expectedPosition = new THREE.Vector3().setFromMatrixPosition(reference.matrixWorld)
    assert.ok(actualPosition.distanceTo(expectedPosition) < 1e-9)
    assert.deepEqual(object.scale.toArray(), [2, 2, 2])
  }

  // EFFECT-08: world poses that require shear are rejected instead of approximated.
  {
    const timeline = new AnimationTimeline(2)
    const parent = new THREE.Object3D()
    parent.rotation.z = 0.5
    parent.scale.set(2, 1, 1)
    const object = new THREE.Object3D()
    parent.add(object)
    const reference = new THREE.Object3D()
    reference.rotation.z = -0.4
    reference.scale.set(1, 2, 1)
    parent.updateMatrixWorld(true)
    reference.updateMatrixWorld(true)
    timeline.add(matchTransform(object, reference, { duration: 1 }))
    await assert.rejects(
      () => timeline.runFrame(0),
      (error) => error?.code === 'MATCH_TRANSFORM_REQUIRES_SHEAR'
    )
  }

  // EFFECT-09: wait and createAnimation remain ordinary plans.
  {
    const timeline = new AnimationTimeline(10)
    let value = 0
    timeline.add(wait(0.2))
    timeline.add(
      createAnimation({
        duration: 0.1,
        bind: () => ({ update: () => (value = 1) })
      })
    )
    assert.equal(timeline.getEndFrame(), 3)
    await timeline.runFrame(2)
    assert.equal(value, 1)
  }

  // Direct scaleTo remains available for explicit scale targets.
  {
    const timeline = new AnimationTimeline(2)
    const object = new THREE.Object3D()
    timeline.add(scaleTo(object, new THREE.Vector3(2, 3, 4), { duration: 1 }))
    await timeline.runFrame(0)
    await timeline.runFrame(1)
    assert.deepEqual(object.scale.toArray(), [2, 3, 4])
  }

  console.log('core animation effects tests passed')
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true })
}
