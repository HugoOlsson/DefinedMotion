import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import * as THREE from 'three'
import ts from 'typescript'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const sourceRoot = join(packageRoot, 'src/runtime')
const temporaryDirectory = await mkdtemp(join(packageRoot, '.curve-test-'))

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

const segmentVertices = (visual, index) => {
  const values = visual.geometry.getAttribute('position').array
  return Array.from(values.slice(index * 18, index * 18 + 18))
}

const segmentIsCollapsed = (visual, index) => {
  const values = segmentVertices(visual, index)
  for (let offset = 3; offset < values.length; offset += 3) {
    if (
      values[offset] !== values[0] ||
      values[offset + 1] !== values[1] ||
      values[offset + 2] !== values[2]
    ) {
      return false
    }
  }
  return true
}

try {
  const sceneDirectory = join(temporaryDirectory, 'scene')
  const visualsDirectory = join(temporaryDirectory, 'visuals')
  const animationDirectory = join(temporaryDirectory, 'animation')
  await mkdir(sceneDirectory)
  await mkdir(visualsDirectory)
  await mkdir(animationDirectory)

  await writeFile(
    join(sceneDirectory, 'sceneErrors.mjs'),
    await transpile(join(sourceRoot, 'scene/sceneErrors.ts'))
  )
  await writeFile(
    join(visualsDirectory, 'curve.mjs'),
    (await transpile(join(sourceRoot, 'visuals/curve.ts'))).replace(
      '../scene/sceneErrors',
      '../scene/sceneErrors.mjs'
    )
  )
  await writeFile(
    join(animationDirectory, 'curveEffects.mjs'),
    (await transpile(join(sourceRoot, 'animation/curveEffects.ts'))).replace(
      '../visuals/curve',
      '../visuals/curve.mjs'
    )
  )

  const [{ createCurve }, { curve }] = await Promise.all([
    import(pathToFileURL(join(visualsDirectory, 'curve.mjs')).href),
    import(pathToFileURL(join(animationDirectory, 'curveEffects.mjs')).href)
  ])

  // CURVE-01: ribbon width is stable and dashes use interpolated local arc length,
  // independent of whether a sampled segment crosses several dash boundaries.
  {
    const solid = createCurve({
      sampleCount: 11,
      domain: [0, 10],
      pointAt: (value) => new THREE.Vector2(value, 0),
      stroke: { color: '#55dec9', width: 2 }
    })
    const bounds = solid.getLocalBounds()
    assert.equal(bounds.min.y, -1)
    assert.equal(bounds.max.y, 1)
    assert.equal(solid.material.transparent, false)
    assert.equal(solid.material.depthWrite, true)
    const dashed = createCurve({
      sampleCount: 2,
      domain: [0, 10],
      pointAt: (value) => new THREE.Vector2(value, 0),
      stroke: {
        color: '#55dec9',
        width: 1,
        dash: { length: 1, gap: 1 }
      }
    })
    assert.equal(segmentIsCollapsed(dashed, 0), false)
    assert.deepEqual(
      Array.from(dashed.geometry.getAttribute('curveDistance').array),
      [0, 0, 10, 10, 0, 10]
    )
    const shader = {
      uniforms: {},
      vertexShader: '#include <common>\n#include <begin_vertex>',
      fragmentShader: '#include <common>\n#include <dithering_fragment>'
    }
    dashed.material.onBeforeCompile(shader)
    assert.equal(shader.uniforms.definedMotionDashLength.value, 1)
    assert.equal(shader.uniforms.definedMotionDashPeriod.value, 2)
    assert.match(shader.vertexShader, /vCurveDistance = curveDistance/)
    assert.match(shader.fragmentShader, /mod\(vCurveDistance/)
    assert.match(shader.fragmentShader, /discard/)

    const uneven = createCurve({
      sampleCount: 3,
      domain: [0, 1],
      pointAt: (value) => new THREE.Vector2(value < 0.5 ? value * 18 : 9 + (value - 0.5) * 2, 0),
      stroke: {
        color: '#55dec9',
        width: 1,
        dash: { length: 1, gap: 1 }
      }
    })
    assert.deepEqual(
      Array.from(uneven.geometry.getAttribute('curveDistance').array),
      [0, 0, 9, 9, 0, 9, 9, 9, 10, 10, 9, 10]
    )
    const translucent = createCurve({
      sampleCount: 3,
      pointAt: (value) => new THREE.Vector2(value, 0),
      stroke: { color: '#55dec9', width: 1, opacity: 0.5 }
    })
    assert.equal(translucent.material.transparent, true)
    assert.equal(translucent.material.depthWrite, false)
  }

  // CURVE-02: visibility masks produce separated finite runs.
  {
    const masked = createCurve({
      sampleCount: 5,
      domain: [-1, 1],
      pointAt: (value) => new THREE.Vector2(value, value * value),
      visibleAt: (value) => value < 0,
      stroke: { color: '#55dec9', width: 0.1 }
    })
    assert.equal(segmentIsCollapsed(masked, 0), false)
    assert.equal(segmentIsCollapsed(masked, 1), false)
    assert.equal(segmentIsCollapsed(masked, 2), true)
    assert.equal(segmentIsCollapsed(masked, 3), true)
    assert.ok(Array.from(masked.geometry.getAttribute('position').array).every(Number.isFinite))
  }

  // CURVE-03: setPath reuses geometry buffers and updates measurement immediately.
  {
    const visual = createCurve({
      sampleCount: 5,
      pointAt: (value) => new THREE.Vector2(value, 0),
      stroke: { color: '#55dec9', width: 0.2 }
    })
    const attribute = visual.geometry.getAttribute('position')
    const firstVersion = visual.userData.boundsVersion
    const firstBounds = visual.getLocalBounds()
    visual.setPath({ pointAt: (value) => new THREE.Vector2(value * 4, value * 2) })
    assert.equal(visual.geometry.getAttribute('position'), attribute)
    assert.ok(visual.userData.boundsVersion > firstVersion)
    assert.ok(visual.getLocalBounds().max.x > firstBounds.max.x)
    assert.ok(visual.getLocalBounds().max.y > firstBounds.max.y)
  }

  // CURVE-04: morphTo samples mutable destinations when bind runs and reaches them exactly.
  {
    const visual = createCurve({
      sampleCount: 5,
      pointAt: (value) => new THREE.Vector2(value, 0),
      stroke: { color: '#55dec9', width: 0.2 }
    })
    let targetY = 1
    const plan = curve.morphTo(
      visual,
      { pointAt: (value) => new THREE.Vector2(value, targetY) },
      { duration: 1, easing: 'linear' }
    )
    targetY = 3
    const bound = plan.bind({ startFrame: 0, durationFrames: 2, endFrame: 2 })
    targetY = 7
    bound.update({
      easedProgress: 1,
      linearProgress: 1,
      isFirstFrame: false,
      isLastFrame: true
    })
    const bounds = visual.getLocalBounds()
    assert.ok(Math.abs(bounds.min.y - 2.9) < 1e-6)
    assert.ok(Math.abs(bounds.max.y - 3.1) < 1e-6)
  }

  // CURVE-05: mask changes narrow continuously during a morph.
  {
    const visual = createCurve({
      sampleCount: 3,
      pointAt: (value) => new THREE.Vector2(value, 0),
      stroke: { color: '#55dec9', width: 1 }
    })
    const plan = curve.morphTo(
      visual,
      {
        pointAt: (value) => new THREE.Vector2(value, 0),
        visibleAt: () => false
      },
      { duration: 1 }
    )
    const bound = plan.bind({ startFrame: 0, durationFrames: 3, endFrame: 3 })
    bound.update({
      easedProgress: 0.5,
      linearProgress: 0.5,
      isFirstFrame: false,
      isLastFrame: false
    })
    const bounds = visual.getLocalBounds()
    assert.ok(Math.abs(bounds.getSize(new THREE.Vector2()).y - 0.5) < 1e-6)
  }

  // CURVE-06: open and closed paths use deterministic segment counts and validate topology.
  {
    const path = {
      domain: [0, Math.PI * 2],
      pointAt: (value) => new THREE.Vector2(Math.cos(value), Math.sin(value)),
      stroke: { color: '#55dec9', width: 0.1 }
    }
    const open = createCurve({ ...path, sampleCount: 5 })
    const closed = createCurve({ ...path, sampleCount: 5, closed: true })
    const defaultSampled = createCurve(path)
    assert.equal(open.geometry.drawRange.count, 4 * 6)
    assert.equal(closed.geometry.drawRange.count, 5 * 6)
    assert.equal(defaultSampled.sampleCount, 257)
    assert.equal(defaultSampled.geometry.drawRange.count, 256 * 6)
    assert.throws(
      () => createCurve({ ...path, sampleCount: 2, closed: true }),
      /sampleCount must be an integer of at least 3/
    )
  }

  // CURVE-07: very small valid segments are not mistaken for segments parallel to the normal.
  {
    const radius = 1e-5
    const tinyCircle = createCurve({
      sampleCount: 97,
      domain: [0, Math.PI * 2],
      closed: true,
      pointAt: (value) =>
        new THREE.Vector2(Math.cos(value) * radius, Math.sin(value) * radius),
      stroke: { color: '#55dec9', width: 0.1 }
    })
    assert.ok(
      Array.from(tinyCircle.geometry.getAttribute('position').array).every(Number.isFinite)
    )
    assert.equal(segmentIsCollapsed(tinyCircle, 0), false)
  }

  console.log('curve primitive tests passed')
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true })
}
