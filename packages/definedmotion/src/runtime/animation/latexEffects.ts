import * as THREE from 'three'
import { queryLaTeXClass } from '../svg/latexSVGQueries'
import { latexVisualController } from '../visuals/latexInternal'
import type { LatexPart, LatexVisual } from '../visuals/types'
import {
  createLatexHighlightController,
  createLatexMarkController
} from './latexMarkAndHighlight'
import {
  createLatexParticleTransitionController,
  createLatexWriteController
} from './latexTransitionsAndWrite'
import type { AnimationPlan, Easing } from './plan'

export type LatexEffectTarget = LatexVisual | LatexPart

interface LatexEffectOptions {
  /** Seconds. */
  duration?: number
  easing?: Easing
}

export interface LatexMarkOptions extends LatexEffectOptions {
  color?: THREE.ColorRepresentation
  /** Padding on every side as a fraction of the LaTeX visual's authored font size. */
  padding?: number
  /** Bracket stroke thickness as a fraction of the LaTeX visual's authored font size. */
  strokeWidth?: number
  pulses?: number
  scale?: number
  opacity?: number
}

export interface LatexHighlightOptions extends LatexEffectOptions {
  color?: THREE.ColorRepresentation
  pulses?: number
  minMix?: number
  maxMix?: number
}

export interface LatexWriteOptions extends LatexEffectOptions {
  direction?: 'ltr' | 'rtl'
  penWidth?: number
}

export interface LatexMorphOptions extends LatexEffectOptions {
  latex: string
  particleCount?: number
}

export interface LatexParticleTransitionOptions extends LatexEffectOptions {
  particleCount?: number
}

interface MaterialState {
  readonly material: THREE.Material
  readonly opacity: number
  readonly transparent: boolean
}

interface Triangle {
  readonly a: THREE.Vector3
  readonly b: THREE.Vector3
  readonly c: THREE.Vector3
  areaEnd: number
}

const targetVisual = (target: LatexEffectTarget): LatexVisual =>
  'visual' in target ? target.visual : target

const targetClass = (target: LatexEffectTarget): string =>
  'visual' in target ? target.id : '__definedmotion_entire_latex_visual__'

const assertPartExists = (target: LatexEffectTarget): void => {
  if ('visual' in target && !queryLaTeXClass(target.visual, target.id)) {
    throw new Error(`LaTeX part "${target.id}" does not exist in the expression at this frame`)
  }
}

const controllerPlan = (
  duration: number,
  easing: Easing | undefined,
  bindLegacy: () => { updater(progress: number, frame: number, isLast: boolean): unknown }
): AnimationPlan => ({
  duration,
  easing: easing ?? 'ease-in-out',
  bind() {
    const animation = bindLegacy()
    return {
      update({ easedProgress, linearProgress, isLastFrame }) {
        animation.updater(easedProgress, linearProgress, isLastFrame)
      }
    }
  }
})

const materialStates = (root: THREE.Object3D): MaterialState[] => {
  const result: MaterialState[] = []
  const seen = new Set<THREE.Material>()
  root.traverse((object) => {
    const material = (object as THREE.Object3D & { material?: THREE.Material | THREE.Material[] })
      .material
    for (const current of Array.isArray(material) ? material : material ? [material] : []) {
      if (seen.has(current)) continue
      seen.add(current)
      result.push({
        material: current,
        opacity: current.opacity,
        transparent: current.transparent
      })
    }
  })
  return result
}

const setMaterialProgress = (states: readonly MaterialState[], progress: number): void => {
  for (const state of states) {
    state.material.transparent = true
    state.material.opacity = state.opacity * progress
  }
}

const restoreMaterials = (states: readonly MaterialState[]): void => {
  for (const state of states) {
    state.material.opacity = state.opacity
    state.material.transparent = state.transparent
  }
}

const random = (seed: number): number => {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

const collectTriangles = (
  group: THREE.Object3D,
  coordinateRoot?: THREE.Object3D
): Triangle[] => {
  group.updateWorldMatrix(true, true)
  coordinateRoot?.updateWorldMatrix(true, true)
  const inverseRoot = coordinateRoot
    ? coordinateRoot.matrixWorld.clone().invert()
    : new THREE.Matrix4()
  const localMatrix = new THREE.Matrix4()
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const triangles: Triangle[] = []
  let totalArea = 0

  group.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return
    const geometry = mesh.geometry as THREE.BufferGeometry
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute | undefined
    if (!positions) return
    localMatrix.multiplyMatrices(inverseRoot, mesh.matrixWorld)
    const indices = geometry.index
    const triangleCount = Math.floor((indices?.count ?? positions.count) / 3)
    for (let index = 0; index < triangleCount; index++) {
      const first = indices ? indices.getX(index * 3) : index * 3
      const second = indices ? indices.getX(index * 3 + 1) : index * 3 + 1
      const third = indices ? indices.getX(index * 3 + 2) : index * 3 + 2
      a.fromBufferAttribute(positions, first).applyMatrix4(localMatrix)
      b.fromBufferAttribute(positions, second).applyMatrix4(localMatrix)
      c.fromBufferAttribute(positions, third).applyMatrix4(localMatrix)
      const area = b.clone().sub(a).cross(c.clone().sub(a)).length() * 0.5
      if (area <= 0) continue
      totalArea += area
      triangles.push({ a: a.clone(), b: b.clone(), c: c.clone(), areaEnd: totalArea })
    }
  })
  return triangles
}

const surfaceSamples = (
  group: THREE.Object3D,
  coordinateRoot: THREE.Object3D | undefined,
  count: number
): Float32Array => {
  const triangles = collectTriangles(group, coordinateRoot)
  if (triangles.length === 0) return new Float32Array()
  const result = new Float32Array(count * 3)
  const totalArea = triangles.at(-1)!.areaEnd
  const point = new THREE.Vector3()
  for (let index = 0; index < count; index++) {
    const area = random(index + 1000) * totalArea
    let low = 0
    let high = triangles.length - 1
    while (low < high) {
      const middle = (low + high) >> 1
      if (triangles[middle].areaEnd >= area) high = middle
      else low = middle + 1
    }
    const triangle = triangles[low]
    let u = random(index * 2)
    let v = random(index * 2 + 1)
    if (u + v > 1) {
      u = 1 - u
      v = 1 - v
    }
    point
      .copy(triangle.a)
      .addScaledVector(triangle.b.clone().sub(triangle.a), u)
      .addScaledVector(triangle.c.clone().sub(triangle.a), v)
    result.set(point.toArray(), index * 3)
  }
  return result
}

const sortedSamples = (positions: Float32Array): Float32Array => {
  const points: number[][] = []
  for (let index = 0; index < positions.length; index += 3) {
    points.push([positions[index], positions[index + 1], positions[index + 2]])
  }
  points.sort((left, right) => left[0] - right[0] || left[1] - right[1])
  return new Float32Array(points.flat())
}

const particleSize = (from: Float32Array, to: Float32Array): number => {
  const bounds = new THREE.Box3()
  const point = new THREE.Vector3()
  for (const positions of [from, to]) {
    for (let index = 0; index < positions.length; index += 3) {
      bounds.expandByPoint(point.fromArray(positions, index))
    }
  }
  return Math.max(bounds.getSize(point).length() * 0.004, 0.01)
}

const firstColor = (object: THREE.Object3D): THREE.Color => {
  let result: THREE.Color | undefined
  object.traverse((child) => {
    if (result) return
    const material = (child as THREE.Mesh).material
    for (const current of Array.isArray(material) ? material : material ? [material] : []) {
      const color = (current as THREE.Material & { color?: THREE.Color }).color
      if (color) {
        result = color.clone()
        return
      }
    }
  })
  return result ?? new THREE.Color(0xffffff)
}

export const mark = (target: LatexEffectTarget, options: LatexMarkOptions = {}): AnimationPlan => {
  const visual = targetVisual(target)
  return controllerPlan(options.duration ?? 2.4, options.easing, () => {
    assertPartExists(target)
    return createLatexMarkController(visual, targetClass(target), {
      color: options.color,
      padding: options.padding,
      strokeWidth: options.strokeWidth,
      pulses: options.pulses,
      scaleAmp: options.scale,
      maxOpacity: options.opacity
    })()
  })
}

export const highlight = (
  target: LatexEffectTarget,
  options: LatexHighlightOptions = {}
): AnimationPlan => {
  const visual = targetVisual(target)
  return controllerPlan(options.duration ?? 1, options.easing, () => {
    assertPartExists(target)
    return createLatexHighlightController(visual, targetClass(target), {
      highlightColor: options.color,
      pulses: options.pulses,
      minMix: options.minMix,
      maxMix: options.maxMix
    })()
  })
}

export const write = (visual: LatexVisual, options: LatexWriteOptions = {}): AnimationPlan =>
  controllerPlan(options.duration ?? 1, options.easing, () =>
    createLatexWriteController(visual, {
      direction: options.direction,
      penWidth: options.penWidth
    })()
  )

export const particleTransition = (
  from: LatexVisual,
  to: LatexVisual,
  options: LatexParticleTransitionOptions = {}
): AnimationPlan =>
  controllerPlan(options.duration ?? 1, options.easing, () =>
    createLatexParticleTransitionController(from, to, {
      particleCount: options.particleCount
    })()
  )

export const morphTo = async (
  visual: LatexVisual,
  options: LatexMorphOptions
): Promise<AnimationPlan> => {
  if (typeof options !== 'object' || options === null) {
    throw new Error('latex.morphTo() requires an options object')
  }
  const controller = latexVisualController(visual)
  const prepared = controller.prepare(options.latex)
  const duration = options.duration ?? 1
  const count = options.particleCount ?? 2500
  if (!Number.isInteger(count) || count <= 0) {
    controller.discard(prepared)
    throw new Error(`particleCount must be a positive integer, received ${count}`)
  }

  return {
    duration,
    easing: options.easing ?? 'ease-in-out',
    bind() {
      const source = controller.currentContent()
      const sourceBounds = visual.getLocalBounds()
      const targetBounds = prepared.bounds.clone()
      const transitionBounds = new THREE.Box2()
      const sourceMaterials = materialStates(source)
      const inheritedAppearance = sourceMaterials[0]
      const fromPositions = sortedSamples(surfaceSamples(source, visual, count))
      const toPositions = sortedSamples(surfaceSamples(prepared.content, undefined, count))
      const canUseParticles = fromPositions.length > 0 && toPositions.length > 0
      const geometry = new THREE.BufferGeometry()
      const currentPositions = canUseParticles
        ? new Float32Array(fromPositions)
        : new Float32Array()
      geometry.setAttribute('position', new THREE.BufferAttribute(currentPositions, 3))
      const particleMaterial = new THREE.PointsMaterial({
        color: firstColor(source),
        size: canUseParticles ? particleSize(fromPositions, toPositions) : 0.01,
        transparent: true,
        opacity: 0,
        depthWrite: false
      })
      const particles = new THREE.Points(geometry, particleMaterial)
      particles.name = 'DefinedMotionLatexMorphParticles'
      const deltas = new Float32Array(fromPositions.length)
      for (let index = 0; index < deltas.length; index++) {
        deltas[index] = toPositions[index] - fromPositions[index]
      }
      let targetMaterials: MaterialState[] = []
      let started = false

      return {
        update({ easedProgress, isLastFrame }) {
          if (!started) {
            if (inheritedAppearance) {
              for (const state of materialStates(prepared.content)) {
                state.material.opacity = inheritedAppearance.opacity
                state.material.transparent = inheritedAppearance.transparent
              }
            }
            targetMaterials = materialStates(prepared.content)
            controller.stage(prepared)
            if (canUseParticles) visual.add(particles)
            started = true
          }
          const progress = THREE.MathUtils.clamp(easedProgress, 0, 1)
          transitionBounds.min.lerpVectors(sourceBounds.min, targetBounds.min, progress)
          transitionBounds.max.lerpVectors(sourceBounds.max, targetBounds.max, progress)
          controller.setTransitionBounds(transitionBounds)
          if (canUseParticles) {
            const positions = geometry.getAttribute('position') as THREE.BufferAttribute
            const values = positions.array as Float32Array
            for (let index = 0; index < values.length; index++) {
              values[index] = fromPositions[index] + deltas[index] * progress
            }
            positions.needsUpdate = true
            if (progress < 0.15) {
              const phase = progress / 0.15
              setMaterialProgress(sourceMaterials, 1 - phase)
              setMaterialProgress(targetMaterials, 0)
              particleMaterial.opacity = phase
            } else if (progress < 0.95) {
              setMaterialProgress(sourceMaterials, 0)
              setMaterialProgress(targetMaterials, 0)
              particleMaterial.opacity = 1
            } else {
              const phase = (progress - 0.95) / 0.05
              setMaterialProgress(sourceMaterials, 0)
              setMaterialProgress(targetMaterials, phase)
              particleMaterial.opacity = 1 - phase
            }
          } else {
            setMaterialProgress(sourceMaterials, 1 - progress)
            setMaterialProgress(targetMaterials, progress)
          }

          if (isLastFrame) {
            restoreMaterials(targetMaterials)
            particles.removeFromParent()
            geometry.dispose()
            particleMaterial.dispose()
            controller.complete(prepared)
          }
        }
      }
    }
  }
}

export const latex = Object.freeze({
  mark,
  highlight,
  write,
  morphTo,
  particleTransition
})
