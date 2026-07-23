import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import * as THREE from 'three'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const sourcePath = join(packageRoot, 'src/runtime/positioning.ts')
const sceneErrorsSourcePath = join(packageRoot, 'src/runtime/scene/sceneErrors.ts')
const temporaryDirectory = await mkdtemp(join(packageRoot, '.positioning-test-'))

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

const compilePositioningModule = async () => {
  const sceneDirectory = join(temporaryDirectory, 'scene')
  await mkdir(sceneDirectory)
  await writeFile(join(sceneDirectory, 'sceneErrors.mjs'), await transpile(sceneErrorsSourcePath))

  const outputPath = join(temporaryDirectory, 'positioning.mjs')
  const positioningOutput = (await transpile(sourcePath)).replace(
    './scene/sceneErrors',
    './scene/sceneErrors.mjs'
  )
  await writeFile(outputPath, positioningOutput)

  const [positioningModule, sceneErrorsModule] = await Promise.all([
    import(`${pathToFileURL(outputPath).href}?test=${Date.now()}`),
    import(pathToFileURL(join(sceneDirectory, 'sceneErrors.mjs')).href)
  ])
  return { ...positioningModule, SceneRuntimeError: sceneErrorsModule.SceneRuntimeError }
}

const cube = (name, size = 2) => {
  const object = new THREE.Mesh(
    new THREE.BoxGeometry(size, size, size),
    new THREE.MeshBasicMaterial()
  )
  object.name = name
  return object
}

const bounds = (object) => new THREE.Box3().setFromObject(object)

const directionalGap = (dependent, reference, axis, direction) => {
  const dependentBounds = bounds(dependent)
  const referenceBounds = bounds(reference)
  const component = axis === 'x' ? 0 : axis === 'y' ? 1 : 2
  return direction === 1
    ? dependentBounds.min.getComponent(component) - referenceBounds.max.getComponent(component)
    : referenceBounds.min.getComponent(component) - dependentBounds.max.getComponent(component)
}

const approximately = (actual, expected, message) => {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${message}: expected ${expected}, received ${actual}`
  )
}

try {
  const { Axis, SceneRuntimeError, PositioningSystem } = await compilePositioningModule()

  {
    const scene = new THREE.Scene()
    const reference = cube('reference')
    const dependent = cube('dependent')
    scene.add(reference, dependent)

    const positioning = new PositioningSystem()
    positioning.place(dependent).rightOf(reference, {
      gap: { initial: 4, range: [2, 6] }
    })

    positioning.solve(scene)
    approximately(directionalGap(dependent, reference, Axis.X, 1), 4, 'initial gap')

    reference.position.x = 2
    positioning.solve(scene)
    approximately(dependent.position.x, 6, 'dependent remains still inside range')
    approximately(directionalGap(dependent, reference, Axis.X, 1), 2, 'minimum valid gap')

    reference.position.x = 2 + 5e-8
    positioning.solve(scene)
    approximately(dependent.position.x, 6, 'sub-epsilon violation does not cause correction')

    reference.position.x = 3
    positioning.solve(scene)
    approximately(dependent.position.x, 7, 'dependent moves by only the violated amount')
    approximately(directionalGap(dependent, reference, Axis.X, 1), 2, 'restored minimum gap')

    reference.position.x = -2
    positioning.solve(scene)
    approximately(directionalGap(dependent, reference, Axis.X, 1), 6, 'restored maximum gap')
  }

  {
    const scene = new THREE.Scene()
    const reference = cube('exact-reference')
    const dependent = cube('exact-dependent')
    scene.add(reference, dependent)

    const positioning = new PositioningSystem()
    positioning.place(dependent).rightOf(reference, { gap: 4 })
    positioning.solve(scene)

    reference.position.x = 2
    positioning.solve(scene)
    approximately(directionalGap(dependent, reference, Axis.X, 1), 4, 'exact gap follows')
    approximately(dependent.position.x, 8, 'exact dependent position')
  }

  {
    const scene = new THREE.Scene()
    const reference = cube('changing-bounds-reference')
    const dependent = cube('changing-bounds-dependent')
    const chained = cube('changing-bounds-chain', 1)
    scene.add(reference, dependent, chained)

    const positioning = new PositioningSystem()
    positioning.place(chained).above(dependent, { gap: 0.75 })
    positioning.place(dependent).rightOf(reference, { gap: 1.5 })
    positioning.solve(scene)

    reference.scale.set(2.5, 1.4, 0.8)
    reference.rotation.z = 0.35
    positioning.solve(scene)
    approximately(
      directionalGap(dependent, reference, Axis.X, 1),
      1.5,
      'gap follows scale and rotation changes'
    )
    approximately(
      directionalGap(chained, dependent, Axis.Y, 1),
      0.75,
      'dependent chain follows changed bounds'
    )

    reference.geometry = new THREE.BoxGeometry(8, 1.5, 3)
    positioning.solve(scene)
    approximately(
      directionalGap(dependent, reference, Axis.X, 1),
      1.5,
      'gap follows geometry replacement'
    )
    approximately(
      directionalGap(chained, dependent, Axis.Y, 1),
      0.75,
      'chain remains valid after geometry replacement'
    )
  }

  {
    const scene = new THREE.Scene()
    const reference = cube('once-reference')
    const middle = cube('once-middle')
    const end = cube('once-end')
    const persistent = cube('persistent-dependent')
    scene.add(reference, middle, end, persistent)

    const positioning = new PositioningSystem()
    positioning.placeOnce(end).rightOf(middle, { gap: 3 })
    positioning.placeOnce(middle).rightOf(reference, {
      gap: { initial: 2, range: [1, 4] }
    })
    positioning.place(persistent).above(reference, { gap: 1 })
    positioning.solve(scene)

    approximately(directionalGap(middle, reference, Axis.X, 1), 2, 'one-shot initial gap')
    approximately(directionalGap(end, middle, Axis.X, 1), 3, 'one-shot dependency order')
    approximately(middle.position.x, 4, 'one-shot middle position')
    approximately(end.position.x, 9, 'one-shot end position')

    reference.position.set(5, 2, 0)
    const originalSetFromObject = THREE.Box3.prototype.setFromObject
    let measurements = 0
    THREE.Box3.prototype.setFromObject = function (...args) {
      measurements++
      return originalSetFromObject.apply(this, args)
    }
    try {
      positioning.solve(scene)
    } finally {
      THREE.Box3.prototype.setFromObject = originalSetFromObject
    }

    approximately(middle.position.x, 4, 'one-shot middle no longer follows')
    approximately(end.position.x, 9, 'one-shot end no longer follows')
    approximately(
      directionalGap(persistent, reference, Axis.Y, 1),
      1,
      'persistent constraint still follows'
    )
    assert.equal(measurements, 2, 'completed one-shot objects are no longer measured')
  }

  {
    const scene = new THREE.Scene()
    const floor = cube('floor')
    const middle = cube('middle')
    const end = cube('end')
    scene.add(floor, middle, end)

    const positioning = new PositioningSystem()
    positioning.place(end).rightOf(middle, { gap: 3 })
    positioning.place(middle).rightOf(floor, { gap: 2 })
    positioning.solve(scene)

    approximately(directionalGap(middle, floor, Axis.X, 1), 2, 'first chain gap')
    approximately(directionalGap(end, middle, Axis.X, 1), 3, 'second chain gap')
    approximately(middle.position.x, 4, 'middle chain position')
    approximately(end.position.x, 9, 'end chain position')
  }

  {
    const scene = new THREE.Scene()
    const plot = cube('plot', 4)
    const title = cube('title', 2)
    plot.position.x = 10
    scene.add(plot, title)

    const positioning = new PositioningSystem()
    positioning.place(title).above(plot, { gap: 5 }).centerWith(plot, { axis: Axis.X })
    positioning.solve(scene)

    approximately(directionalGap(title, plot, Axis.Y, 1), 5, 'title vertical gap')
    approximately(bounds(title).getCenter(new THREE.Vector3()).x, 10, 'title center alignment')
  }

  {
    const scene = new THREE.Scene()
    const reference = cube('parented-reference')
    const parent = new THREE.Group()
    parent.position.set(5, 2, 0)
    parent.rotation.z = Math.PI / 2
    parent.scale.setScalar(2)
    const dependent = cube('parented-dependent')
    parent.add(dependent)
    scene.add(reference, parent)

    const positioning = new PositioningSystem()
    positioning.place(dependent).rightOf(reference, { gap: 3 })
    positioning.solve(scene)

    approximately(
      directionalGap(dependent, reference, Axis.X, 1),
      3,
      'world gap under a transformed parent'
    )
  }

  {
    const scene = new THREE.Scene()
    const reference = cube('z-reference')
    const dependent = cube('z-dependent')
    scene.add(reference, dependent)

    const positioning = new PositioningSystem()
    positioning.place(dependent).negativeZOf(reference, { gap: 7 })
    positioning.solve(scene)
    approximately(directionalGap(dependent, reference, Axis.Z, -1), 7, 'negative Z gap')
  }

  {
    const scene = new THREE.Scene()
    const first = cube('first')
    const second = cube('second')
    const third = cube('third')
    scene.add(first, second, third)

    const positioning = new PositioningSystem()
    positioning.place(second).rightOf(first, { gap: 1 })
    positioning.place(third).rightOf(second, { gap: 1 })

    const originalSetFromObject = THREE.Box3.prototype.setFromObject
    let measurements = 0
    THREE.Box3.prototype.setFromObject = function (...args) {
      measurements++
      return originalSetFromObject.apply(this, args)
    }
    try {
      positioning.solve(scene)
    } finally {
      THREE.Box3.prototype.setFromObject = originalSetFromObject
    }
    assert.equal(measurements, 3, 'each constrained object must be measured once per tick')
  }

  {
    const first = cube('cycle-a')
    const second = cube('cycle-b')
    const positioning = new PositioningSystem()
    positioning.place(first).rightOf(second, { gap: 1 })
    positioning.place(second).rightOf(first, { gap: 1 })
    assert.throws(
      () => positioning.compile(),
      (error) =>
        error instanceof SceneRuntimeError &&
        error.code === 'POSITIONING_CYCLE' &&
        /cycle/.test(error.message) &&
        error.message.includes('cycle-a') &&
        error.message.includes('cycle-b')
    )
  }

  {
    const plotAssembly = new THREE.Group()
    plotAssembly.name = 'plot-assembly'
    const title = cube('nested-title')
    plotAssembly.add(title)
    const positioning = new PositioningSystem()
    positioning.place(title).above(plotAssembly, { gap: 1 })
    assert.throws(
      () => positioning.compile(),
      (error) =>
        error instanceof SceneRuntimeError &&
        error.code === 'POSITIONING_SUBTREE_CONFLICT' &&
        /separate content group/.test(error.message)
    )
  }

  for (const registrationOrder of ['ancestor-first', 'descendant-first']) {
    const ancestorReference = cube(`${registrationOrder}-ancestor-reference`)
    const descendantReference = cube(`${registrationOrder}-descendant-reference`)
    const ancestor = new THREE.Group()
    ancestor.name = `${registrationOrder}-ancestor`
    const descendant = cube(`${registrationOrder}-descendant`)
    ancestor.add(descendant)

    const positioning = new PositioningSystem()
    const positionAncestor = () =>
      positioning.place(ancestor).rightOf(ancestorReference, { gap: 1 })
    const positionDescendant = () =>
      positioning.place(descendant).above(descendantReference, { gap: 1 })

    if (registrationOrder === 'ancestor-first') {
      positionAncestor()
      positionDescendant()
    } else {
      positionDescendant()
      positionAncestor()
    }

    assert.throws(
      () => positioning.compile(),
      (error) =>
        error instanceof SceneRuntimeError &&
        error.code === 'POSITIONING_NESTED_DEPENDENTS' &&
        /sibling groups/.test(error.message) &&
        error.message.includes(ancestor.name) &&
        error.message.includes(descendant.name)
    )
  }

  for (const method of ['place', 'placeOnce']) {
    for (const matrixProperty of ['matrixAutoUpdate', 'matrixWorldAutoUpdate']) {
      const reference = cube(`${method}-${matrixProperty}-reference`)
      const dependent = cube(`${method}-${matrixProperty}-dependent`)
      dependent[matrixProperty] = false

      const positioning = new PositioningSystem()
      positioning[method](dependent).rightOf(reference, { gap: 1 })

      assert.throws(
        () => positioning.compile(),
        (error) =>
          error instanceof SceneRuntimeError &&
          error.code === 'POSITIONING_MANUAL_MATRIX' &&
          /automatic matrices/.test(error.message) &&
          error.message.includes(dependent.name)
      )
    }
  }

  {
    const scene = new THREE.Scene()
    const reference = cube('runtime-matrix-reference')
    const dependent = cube('runtime-matrix-dependent')
    scene.add(reference, dependent)

    const positioning = new PositioningSystem()
    positioning.place(dependent).rightOf(reference, { gap: 1 })
    positioning.compile()
    dependent.matrixAutoUpdate = false

    assert.throws(
      () => positioning.solve(scene),
      (error) => error instanceof SceneRuntimeError && error.code === 'POSITIONING_MANUAL_MATRIX'
    )
  }

  {
    const reference = cube('axis-reference')
    const dependent = cube('axis-dependent')
    const positioning = new PositioningSystem()
    positioning.place(dependent).above(reference, { gap: 1 }).centerWith(reference, {
      axis: Axis.Y
    })
    assert.throws(
      () => positioning.compile(),
      (error) =>
        error instanceof SceneRuntimeError &&
        error.code === 'POSITIONING_AXIS_CONFLICT' &&
        /more than one.*Y axis/.test(error.message)
    )
  }

  {
    const reference = cube('gap-reference')
    const dependent = cube('gap-dependent')
    const positioning = new PositioningSystem()

    assert.throws(
      () =>
        positioning.place(dependent).rightOf(reference, {
          gap: { initial: 2, range: [3, 1] }
        }),
      (error) => error instanceof SceneRuntimeError && error.code === 'POSITIONING_INVALID_GAP'
    )
    assert.throws(
      () => positioning.place(dependent).rightOf(reference, { gap: { initial: 2 } }),
      (error) => error instanceof SceneRuntimeError && error.code === 'POSITIONING_INVALID_GAP'
    )
  }

  {
    const reference = cube('invalid-axis-reference')
    const dependent = cube('invalid-axis-dependent')
    const positioning = new PositioningSystem()

    assert.throws(
      () => positioning.place(dependent).centerWith(reference, { axis: 'screen-x' }),
      (error) => error instanceof SceneRuntimeError && error.code === 'POSITIONING_INVALID_AXIS'
    )
    assert.throws(
      () => positioning.place(null),
      (error) => error instanceof SceneRuntimeError && error.code === 'POSITIONING_INVALID_OBJECT'
    )
    assert.throws(
      () => positioning.placeOnce(null),
      (error) => error instanceof SceneRuntimeError && error.code === 'POSITIONING_INVALID_OBJECT'
    )
  }

  console.log('Positioning tests passed')
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true })
}
