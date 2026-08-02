import * as THREE from 'three'
import { SceneRuntimeError } from '../scene/sceneErrors'
import type { MeasurableVisual } from './types'

export type CurvePoint = THREE.Vector2 | THREE.Vector3

export interface CurvePath {
  domain?: readonly [number, number]
  pointAt(value: number): CurvePoint
  visibleAt?(value: number): boolean
}

export interface CurveDashOptions {
  length: number
  gap: number
  offset?: number
}

export interface CurveStrokeOptions {
  color: THREE.ColorRepresentation
  width: number
  opacity?: number
  dash?: CurveDashOptions
}

export interface CurveOptions extends CurvePath {
  sampleCount?: number
  closed?: boolean
  normal?: THREE.Vector3
  stroke: CurveStrokeOptions
}

export type CurveVisual = MeasurableVisual<
  THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
> & {
  readonly sampleCount: number
  readonly closed: boolean
  setPath(path: CurvePath): void
}

export interface CurveSnapshot {
  readonly points: Float32Array
  readonly visibility: Float32Array
}

interface CurveController {
  readonly sampleCount: number
  readonly closed: boolean
  readonly segmentCount: number
  readonly normal: THREE.Vector3
  readonly width: number
  readonly positions: Float32Array
  readonly distances?: Float32Array
  readonly weights: Float32Array
  readonly lengths: Float32Array
  readonly scratch: {
    readonly start: THREE.Vector3
    readonly end: THREE.Vector3
    readonly delta: THREE.Vector3
    readonly perpendicular: THREE.Vector3
    readonly a: THREE.Vector3
    readonly b: THREE.Vector3
    readonly c: THREE.Vector3
    readonly d: THREE.Vector3
    readonly anchor: THREE.Vector3
  }
  readonly current: CurveSnapshot
  readonly bounds: THREE.Box2
}

const DEFAULT_SAMPLE_COUNT = 257
const controllers = new WeakMap<CurveVisual, CurveController>()

const finitePositive = (value: number | undefined, name: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new SceneRuntimeError(
      'INVALID_CURVE_OPTION',
      `${name} must be a finite positive number, received ${value}`
    )
  }
  return value
}

const opacity = (value: number | undefined): number => {
  const resolved = value ?? 1
  if (!Number.isFinite(resolved) || resolved < 0 || resolved > 1) {
    throw new SceneRuntimeError(
      'INVALID_CURVE_OPTION',
      `stroke.opacity must be a finite number from 0 to 1, received ${resolved}`
    )
  }
  return resolved
}

const sampleCount = (value: number | undefined, closed: boolean): number => {
  const resolved = value ?? DEFAULT_SAMPLE_COUNT
  const minimum = closed ? 3 : 2
  if (!Number.isInteger(resolved) || resolved < minimum) {
    throw new SceneRuntimeError(
      'INVALID_CURVE_OPTION',
      `sampleCount must be an integer of at least ${minimum}, received ${resolved}`
    )
  }
  return resolved
}

const curveNormal = (value: THREE.Vector3 | undefined): THREE.Vector3 => {
  const resolved = (value ?? new THREE.Vector3(0, 0, 1)).clone()
  if (!resolved.toArray().every(Number.isFinite) || resolved.lengthSq() === 0) {
    throw new SceneRuntimeError(
      'INVALID_CURVE_OPTION',
      'normal must be a finite non-zero Three.js Vector3'
    )
  }
  return resolved.normalize()
}

const dashOptions = (
  value: CurveDashOptions | undefined
): Required<CurveDashOptions> | undefined => {
  if (!value) return undefined
  return {
    length: finitePositive(value.length, 'stroke.dash.length'),
    gap: finitePositive(value.gap, 'stroke.dash.gap'),
    offset:
      value.offset === undefined
        ? 0
        : Number.isFinite(value.offset)
          ? value.offset
          : (() => {
              throw new SceneRuntimeError(
                'INVALID_CURVE_OPTION',
                `stroke.dash.offset must be finite, received ${value.offset}`
              )
            })()
  }
}

const domain = (path: CurvePath): readonly [number, number] => {
  const resolved = path.domain ?? [0, 1]
  const [start, end] = resolved
  if (![start, end].every(Number.isFinite) || end <= start) {
    throw new SceneRuntimeError(
      'INVALID_CURVE_PATH',
      `Curve domain must contain two finite increasing values, received [${start}, ${end}]`
    )
  }
  return [start, end]
}

const point3 = (value: CurvePoint, parameter: number): THREE.Vector3 => {
  const point =
    value instanceof THREE.Vector3
      ? value
      : value instanceof THREE.Vector2
        ? new THREE.Vector3(value.x, value.y, 0)
        : undefined
  if (!point || !point.toArray().every(Number.isFinite)) {
    throw new SceneRuntimeError(
      'INVALID_CURVE_PATH',
      `pointAt(${parameter}) must return a finite Three.js Vector2 or Vector3`
    )
  }
  return point
}

const createSnapshot = (count: number, segmentCount: number): CurveSnapshot => ({
  points: new Float32Array(count * 3),
  visibility: new Float32Array(segmentCount)
})

export const sampleCurvePath = (
  path: CurvePath,
  count: number,
  closed: boolean,
  target: CurveSnapshot = createSnapshot(count, closed ? count : count - 1)
): CurveSnapshot => {
  const [start, end] = domain(path)
  const span = end - start
  const denominator = closed ? count : count - 1
  for (let index = 0; index < count; index++) {
    const parameter = start + (index / denominator) * span
    const point = point3(path.pointAt(parameter), parameter)
    const offset = index * 3
    target.points[offset] = point.x
    target.points[offset + 1] = point.y
    target.points[offset + 2] = point.z
  }
  for (let index = 0; index < target.visibility.length; index++) {
    const parameter = start + ((index + 0.5) / denominator) * span
    const visible = path.visibleAt?.(parameter) ?? true
    if (typeof visible !== 'boolean') {
      throw new SceneRuntimeError(
        'INVALID_CURVE_PATH',
        `visibleAt(${parameter}) must return a boolean`
      )
    }
    target.visibility[index] = visible ? 1 : 0
  }
  return target
}

const controllerFor = (visual: CurveVisual): CurveController => {
  const controller = controllers.get(visual)
  if (!controller) {
    throw new SceneRuntimeError(
      'INVALID_CURVE_VISUAL',
      'curve.morphTo() requires a visual created by createCurve()'
    )
  }
  return controller
}

const pointFromSamples = (
  samples: Float32Array,
  index: number,
  target: THREE.Vector3
): THREE.Vector3 => {
  const offset = index * 3
  return target.set(samples[offset], samples[offset + 1], samples[offset + 2])
}

const writeVertex = (positions: Float32Array, offset: number, point: THREE.Vector3): number => {
  positions[offset] = point.x
  positions[offset + 1] = point.y
  positions[offset + 2] = point.z
  return offset + 3
}

const configureDashMaterial = (
  material: THREE.MeshBasicMaterial,
  dash: Required<CurveDashOptions> | undefined
): void => {
  if (!dash) return
  const period = dash.length + dash.gap
  material.onBeforeCompile = (shader) => {
    shader.uniforms.definedMotionDashLength = { value: dash.length }
    shader.uniforms.definedMotionDashPeriod = { value: period }
    shader.uniforms.definedMotionDashOffset = { value: dash.offset }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float curveDistance;\nvarying float vCurveDistance;'
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvCurveDistance = curveDistance;'
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying float vCurveDistance;\n' +
          'uniform float definedMotionDashLength;\n' +
          'uniform float definedMotionDashPeriod;\n' +
          'uniform float definedMotionDashOffset;'
      )
      .replace(
        '#include <dithering_fragment>',
        'if (mod(vCurveDistance + definedMotionDashOffset, definedMotionDashPeriod) >= ' +
          'definedMotionDashLength) discard;\n#include <dithering_fragment>'
      )
  }
  material.customProgramCacheKey = () => 'definedmotion-curve-local-dash-v1'
}

const renderCurve = (visual: CurveVisual, controller: CurveController): void => {
  const {
    current,
    segmentCount,
    sampleCount: count,
    normal,
    width,
    positions,
    distances,
    weights,
    lengths,
    scratch
  } = controller
  const { start, end, delta, perpendicular, a, b, c, d, anchor } = scratch
  let hasVisibleAnchor = false

  for (let index = 0; index < segmentCount; index++) {
    pointFromSamples(current.points, index, start)
    pointFromSamples(current.points, (index + 1) % count, end)
    const length = start.distanceTo(end)
    lengths[index] = length
    const weight = THREE.MathUtils.clamp(current.visibility[index], 0, 1)
    weights[index] = weight
    if (!hasVisibleAnchor && weight > 0 && length > 1e-10) {
      anchor.copy(start)
      hasVisibleAnchor = true
    }
  }

  if (!hasVisibleAnchor) pointFromSamples(current.points, 0, anchor)
  let vertexOffset = 0
  let distanceOffset = 0
  let cumulativeDistance = 0

  for (let index = 0; index < segmentCount; index++) {
    pointFromSamples(current.points, index, start)
    pointFromSamples(current.points, (index + 1) % count, end)
    const weight = weights[index]
    const segmentEndDistance = cumulativeDistance + lengths[index]
    if (distances) {
      distances[distanceOffset++] = cumulativeDistance
      distances[distanceOffset++] = cumulativeDistance
      distances[distanceOffset++] = segmentEndDistance
      distances[distanceOffset++] = segmentEndDistance
      distances[distanceOffset++] = cumulativeDistance
      distances[distanceOffset++] = segmentEndDistance
    }
    if (weight <= 0 || lengths[index] <= 1e-10) {
      for (let vertex = 0; vertex < 6; vertex++) {
        positions[vertexOffset++] = anchor.x
        positions[vertexOffset++] = anchor.y
        positions[vertexOffset++] = anchor.z
      }
      cumulativeDistance = segmentEndDistance
      continue
    }
    delta.subVectors(end, start)
    perpendicular.crossVectors(normal, delta)
    const deltaLengthSq = delta.lengthSq()
    if (perpendicular.lengthSq() <= deltaLengthSq * 1e-12) {
      throw new SceneRuntimeError(
        'INVALID_CURVE_PATH',
        `Curve segment ${index} is parallel to the configured normal`
      )
    }
    perpendicular.normalize().multiplyScalar((width * weight) / 2)
    a.copy(start).add(perpendicular)
    b.copy(start).sub(perpendicular)
    c.copy(end).add(perpendicular)
    d.copy(end).sub(perpendicular)
    vertexOffset = writeVertex(positions, vertexOffset, a)
    vertexOffset = writeVertex(positions, vertexOffset, b)
    vertexOffset = writeVertex(positions, vertexOffset, c)
    vertexOffset = writeVertex(positions, vertexOffset, c)
    vertexOffset = writeVertex(positions, vertexOffset, b)
    vertexOffset = writeVertex(positions, vertexOffset, d)
    cumulativeDistance = segmentEndDistance
  }

  const attribute = visual.geometry.getAttribute('position') as THREE.BufferAttribute
  attribute.needsUpdate = true
  const distanceAttribute = visual.geometry.getAttribute('curveDistance') as
    | THREE.BufferAttribute
    | undefined
  if (distanceAttribute) distanceAttribute.needsUpdate = true
  visual.geometry.setDrawRange(0, segmentCount * 6)
  visual.geometry.computeBoundingBox()
  visual.geometry.computeBoundingSphere()
  const box = visual.geometry.boundingBox
  if (!box || box.isEmpty()) {
    controller.bounds.setFromCenterAndSize(
      new THREE.Vector2(anchor.x, anchor.y),
      new THREE.Vector2()
    )
  } else {
    controller.bounds.min.set(box.min.x, box.min.y)
    controller.bounds.max.set(box.max.x, box.max.y)
  }
  visual.userData.boundsVersion = (visual.userData.boundsVersion ?? 0) + 1
}

export const captureCurveSnapshot = (visual: CurveVisual): CurveSnapshot => {
  const current = controllerFor(visual).current
  return {
    points: current.points.slice(),
    visibility: current.visibility.slice()
  }
}

export const sampleTargetCurvePath = (visual: CurveVisual, path: CurvePath): CurveSnapshot => {
  const controller = controllerFor(visual)
  return sampleCurvePath(path, controller.sampleCount, controller.closed)
}

export const applyCurveMorph = (
  visual: CurveVisual,
  from: CurveSnapshot,
  to: CurveSnapshot,
  progress: number
): void => {
  const controller = controllerFor(visual)
  if (
    from.points.length !== controller.current.points.length ||
    to.points.length !== controller.current.points.length ||
    from.visibility.length !== controller.current.visibility.length ||
    to.visibility.length !== controller.current.visibility.length
  ) {
    throw new SceneRuntimeError(
      'INCOMPATIBLE_CURVE_TOPOLOGY',
      "Curve snapshots must use the visual's existing sample count and topology"
    )
  }
  const visibilityProgress = THREE.MathUtils.clamp(progress, 0, 1)
  for (let index = 0; index < controller.current.points.length; index++) {
    controller.current.points[index] = THREE.MathUtils.lerp(
      from.points[index],
      to.points[index],
      progress
    )
  }
  for (let index = 0; index < controller.current.visibility.length; index++) {
    controller.current.visibility[index] = THREE.MathUtils.lerp(
      from.visibility[index],
      to.visibility[index],
      visibilityProgress
    )
  }
  renderCurve(visual, controller)
}

export const createCurve = (options: CurveOptions): CurveVisual => {
  if (!options || typeof options !== 'object') {
    throw new SceneRuntimeError('INVALID_CURVE_OPTION', 'createCurve() requires an options object')
  }
  const closed = options.closed ?? false
  if (typeof closed !== 'boolean') {
    throw new SceneRuntimeError('INVALID_CURVE_OPTION', 'closed must be a boolean')
  }
  if (!options.stroke || typeof options.stroke !== 'object') {
    throw new SceneRuntimeError('INVALID_CURVE_OPTION', 'stroke must be an options object')
  }
  const count = sampleCount(options.sampleCount, closed)
  const segmentCount = closed ? count : count - 1
  const width = finitePositive(options.stroke?.width, 'stroke.width')
  const strokeOpacity = opacity(options.stroke?.opacity)
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(segmentCount * 6 * 3)
  const attribute = new THREE.BufferAttribute(positions, 3)
  attribute.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', attribute)
  const dash = dashOptions(options.stroke.dash)
  const distances = dash ? new Float32Array(segmentCount * 6) : undefined
  if (distances) {
    const distanceAttribute = new THREE.BufferAttribute(distances, 1)
    distanceAttribute.setUsage(THREE.DynamicDrawUsage)
    geometry.setAttribute('curveDistance', distanceAttribute)
  }
  const material = new THREE.MeshBasicMaterial({
    color: options.stroke.color,
    transparent: strokeOpacity < 1,
    opacity: strokeOpacity,
    side: THREE.DoubleSide,
    depthWrite: strokeOpacity === 1
  })
  configureDashMaterial(material, dash)
  const visual = new THREE.Mesh(geometry, material) as CurveVisual
  visual.name = 'DefinedMotionCurve'
  visual.userData.definedMotionVisual = 'curve'
  Object.defineProperties(visual, {
    sampleCount: { enumerable: true, value: count },
    closed: { enumerable: true, value: closed }
  })
  const current = createSnapshot(count, segmentCount)
  const controller: CurveController = {
    sampleCount: count,
    closed,
    segmentCount,
    normal: curveNormal(options.normal),
    width,
    positions,
    distances,
    weights: new Float32Array(segmentCount),
    lengths: new Float32Array(segmentCount),
    scratch: {
      start: new THREE.Vector3(),
      end: new THREE.Vector3(),
      delta: new THREE.Vector3(),
      perpendicular: new THREE.Vector3(),
      a: new THREE.Vector3(),
      b: new THREE.Vector3(),
      c: new THREE.Vector3(),
      d: new THREE.Vector3(),
      anchor: new THREE.Vector3()
    },
    current,
    bounds: new THREE.Box2()
  }
  controllers.set(visual, controller)
  visual.getLocalBounds = () => controller.bounds.clone()
  visual.setPath = (path) => {
    sampleCurvePath(path, count, closed, current)
    renderCurve(visual, controller)
  }
  visual.setPath(options)
  return visual
}
