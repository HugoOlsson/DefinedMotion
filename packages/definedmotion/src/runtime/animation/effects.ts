import * as THREE from 'three'
import { SceneRuntimeError } from '../scene/sceneErrors'
import type { AnimationPlan, Easing } from './plan'

export interface AnimationOptions {
  /** Seconds. Defaults to 0.5. */
  duration?: number
  /** Defaults to ease-in-out. */
  easing?: Easing
}

export type TransformSpace = 'local' | 'world'

export interface TransformAnimationOptions extends AnimationOptions {
  space?: TransformSpace
}

export type Vector3Value = THREE.Vector3 | Readonly<{ x: number; y: number; z: number }>
export type RotationValue = THREE.Euler | THREE.Quaternion
export type ScaleValue = number | Vector3Value

export interface MoveAnimationOptions extends TransformAnimationOptions {
  from?: Vector3Value
}

export interface RotateAnimationOptions extends TransformAnimationOptions {
  from?: RotationValue
}

export interface ScaleAnimationOptions extends AnimationOptions {
  from?: ScaleValue
}

export interface ScaleEntranceOptions extends AnimationOptions {
  from?: ScaleValue
  to?: ScaleValue
}

export interface ScaleExitOptions extends AnimationOptions {
  from?: ScaleValue
  to?: ScaleValue
}

export interface OpacityAnimationOptions extends AnimationOptions {
  from?: number
}

const DEFAULT_DURATION = 0.5
const DEFAULT_EASING: Easing = 'ease-in-out'

interface MaterialState {
  readonly material: THREE.Material
  readonly opacity: number
  readonly transparent: boolean
}

const planOptions = (options: AnimationOptions): Pick<AnimationPlan, 'duration' | 'easing'> => ({
  duration: options.duration ?? DEFAULT_DURATION,
  easing: options.easing ?? DEFAULT_EASING
})

const clampOpacityProgress = (progress: number): number => THREE.MathUtils.clamp(progress, 0, 1)

const validateOpacity = (opacity: number, name: string): number => {
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
    throw new SceneRuntimeError(
      'INVALID_OPACITY',
      `${name} must be a finite number from 0 to 1, received ${opacity}`
    )
  }
  return opacity
}

const vector3 = (value: Vector3Value, name: string): THREE.Vector3 => {
  const resolved = new THREE.Vector3(value.x, value.y, value.z)
  if (![resolved.x, resolved.y, resolved.z].every(Number.isFinite)) {
    throw new SceneRuntimeError(
      'INVALID_TRANSFORM_VALUE',
      `${name} must contain finite x, y, and z values`
    )
  }
  return resolved
}

const scaleVector = (value: ScaleValue, name: string): THREE.Vector3 =>
  typeof value === 'number' ? vector3({ x: value, y: value, z: value }, name) : vector3(value, name)

const quaternion = (value: RotationValue, name: string): THREE.Quaternion => {
  const resolved =
    value instanceof THREE.Quaternion
      ? value.clone()
      : value instanceof THREE.Euler
        ? new THREE.Quaternion().setFromEuler(value)
        : undefined
  if (!resolved || !resolved.toArray().every(Number.isFinite) || resolved.lengthSq() === 0) {
    throw new SceneRuntimeError(
      'INVALID_ROTATION_VALUE',
      `${name} must be a finite Three.js Euler or non-zero Quaternion`
    )
  }
  return resolved.normalize()
}

const transformSpace = (space: TransformSpace | undefined): TransformSpace => {
  const resolved = space ?? 'local'
  if (resolved !== 'local' && resolved !== 'world') {
    throw new SceneRuntimeError(
      'INVALID_TRANSFORM_SPACE',
      `Transform space must be "local" or "world", received ${String(resolved)}`
    )
  }
  return resolved
}

const collectMaterialStates = (object: THREE.Object3D): MaterialState[] => {
  const states: MaterialState[] = []
  const seen = new Set<THREE.Material>()
  object.traverse((child) => {
    const material = (
      child as THREE.Object3D & {
        material?: THREE.Material | THREE.Material[]
      }
    ).material
    const materials = Array.isArray(material) ? material : material ? [material] : []
    for (const current of materials) {
      if (seen.has(current)) continue
      seen.add(current)
      states.push({
        material: current,
        opacity: current.opacity,
        transparent: current.transparent
      })
    }
  })
  return states
}

const restoreMaterials = (states: readonly MaterialState[]): void => {
  for (const state of states) {
    state.material.opacity = state.opacity
    state.material.transparent = state.transparent
  }
}

const localPositionFromWorld = (object: THREE.Object3D, world: THREE.Vector3): THREE.Vector3 => {
  if (!object.parent) return world
  object.parent.updateWorldMatrix(true, false)
  return object.parent.worldToLocal(world)
}

const localQuaternionFromWorld = (
  object: THREE.Object3D,
  world: THREE.Quaternion
): THREE.Quaternion => {
  if (!object.parent) return world
  object.parent.updateWorldMatrix(true, false)
  const parentWorld = object.parent.getWorldQuaternion(new THREE.Quaternion())
  return parentWorld.invert().multiply(world).normalize()
}

const matricesApproximatelyEqual = (left: THREE.Matrix4, right: THREE.Matrix4): boolean => {
  let largest = 1
  let difference = 0
  for (let index = 0; index < 16; index++) {
    largest = Math.max(largest, Math.abs(left.elements[index]), Math.abs(right.elements[index]))
    difference = Math.max(difference, Math.abs(left.elements[index] - right.elements[index]))
  }
  return difference <= largest * 1e-7
}

export const fadeIn = (
  object: THREE.Object3D,
  options: AnimationOptions = {}
): AnimationPlan => ({
    ...planOptions(options),
    bind() {
      const materials = collectMaterialStates(object)
      return {
        update({ easedProgress, isLastFrame }) {
          if (isLastFrame) {
            object.visible = true
            restoreMaterials(materials)
            return
          }
          const progress = clampOpacityProgress(easedProgress)
          let hasVisibleOpacity = materials.length === 0 && progress > 0
          for (const state of materials) {
            state.material.transparent = true
            state.material.opacity = state.opacity * progress
            hasVisibleOpacity ||= state.material.opacity > 0
          }
          object.visible = hasVisibleOpacity
        }
      }
    }
  })

export const fadeOut = (
  object: THREE.Object3D,
  options: AnimationOptions = {}
): AnimationPlan => ({
    ...planOptions(options),
    bind() {
      const wasVisible = object.visible
      const materials = collectMaterialStates(object)
      return {
        update({ easedProgress, isLastFrame }) {
          if (isLastFrame) {
            object.visible = false
            restoreMaterials(materials)
            return
          }
          const progress = clampOpacityProgress(easedProgress)
          let hasVisibleOpacity = materials.length === 0
          for (const state of materials) {
            state.material.transparent = true
            state.material.opacity = state.opacity * (1 - progress)
            hasVisibleOpacity ||= state.material.opacity > 0
          }
          object.visible = wasVisible && hasVisibleOpacity
        }
      }
    }
  })

export const opacityTo = (
  object: THREE.Object3D,
  opacity: number,
  options: OpacityAnimationOptions = {}
): AnimationPlan => {
  validateOpacity(opacity, 'opacityTo() target')
  return {
    ...planOptions(options),
    bind() {
      const materials = collectMaterialStates(object)
      const explicitFrom =
        options.from === undefined ? undefined : validateOpacity(options.from, 'opacityTo() from')
      return {
        update({ easedProgress, isLastFrame }) {
          const progress = clampOpacityProgress(easedProgress)
          for (const state of materials) {
            const from = explicitFrom ?? state.opacity
            state.material.opacity = from + (opacity - from) * progress
            state.material.transparent = isLastFrame && opacity === 1 ? state.transparent : true
          }
        }
      }
    }
  }
}

export const scaleTo = (
  object: THREE.Object3D,
  target: ScaleValue,
  options: ScaleAnimationOptions = {}
): AnimationPlan => ({
  ...planOptions(options),
  bind() {
    const from =
      options.from === undefined
        ? object.scale.clone()
        : scaleVector(options.from, 'scaleTo() from')
    const to = scaleVector(target, 'scaleTo() target')
    return {
      update({ easedProgress }) {
        object.scale.lerpVectors(from, to, easedProgress)
      }
    }
  }
})

export const scaleIn = (
  object: THREE.Object3D,
  options: ScaleEntranceOptions = {}
): AnimationPlan => ({
  ...planOptions(options),
  bind() {
    const from = scaleVector(options.from ?? 0, 'scaleIn() from')
    const to =
      options.to === undefined ? object.scale.clone() : scaleVector(options.to, 'scaleIn() to')
    return {
      update({ easedProgress }) {
        object.scale.lerpVectors(from, to, easedProgress)
      }
    }
  }
})

export const scaleOut = (
  object: THREE.Object3D,
  options: ScaleExitOptions = {}
): AnimationPlan => ({
  ...planOptions(options),
  bind() {
    const from =
      options.from === undefined
        ? object.scale.clone()
        : scaleVector(options.from, 'scaleOut() from')
    const to = scaleVector(options.to ?? 0, 'scaleOut() to')
    return {
      update({ easedProgress }) {
        object.scale.lerpVectors(from, to, easedProgress)
      }
    }
  }
})

export const moveTo = (
  object: THREE.Object3D,
  target: Vector3Value,
  options: MoveAnimationOptions = {}
): AnimationPlan => ({
  ...planOptions(options),
  bind() {
    const space = transformSpace(options.space)
    const fromValue =
      options.from === undefined ? object.position.clone() : vector3(options.from, 'moveTo() from')
    const targetValue = vector3(target, 'moveTo() target')
    const from =
      space === 'world'
        ? options.from === undefined
          ? object.position.clone()
          : localPositionFromWorld(object, fromValue)
        : fromValue
    const to = space === 'world' ? localPositionFromWorld(object, targetValue) : targetValue
    return {
      update({ easedProgress }) {
        object.position.lerpVectors(from, to, easedProgress)
      }
    }
  }
})

export const rotateTo = (
  object: THREE.Object3D,
  target: RotationValue,
  options: RotateAnimationOptions = {}
): AnimationPlan => ({
  ...planOptions(options),
  bind() {
    const space = transformSpace(options.space)
    const fromValue =
      options.from === undefined
        ? object.quaternion.clone()
        : quaternion(options.from, 'rotateTo() from')
    const targetValue = quaternion(target, 'rotateTo() target')
    const from =
      space === 'world'
        ? options.from === undefined
          ? object.quaternion.clone()
          : localQuaternionFromWorld(object, fromValue)
        : fromValue
    const to = space === 'world' ? localQuaternionFromWorld(object, targetValue) : targetValue
    return {
      update({ easedProgress }) {
        object.quaternion.slerpQuaternions(from, to, easedProgress)
      }
    }
  }
})

export const matchTransform = (
  object: THREE.Object3D,
  reference: THREE.Object3D,
  options: AnimationOptions = {}
): AnimationPlan => ({
  ...planOptions(options),
  bind() {
    reference.updateWorldMatrix(true, false)
    let targetMatrix = reference.matrixWorld.clone()
    if (object.parent) {
      object.parent.updateWorldMatrix(true, false)
      const determinant = object.parent.matrixWorld.determinant()
      if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) {
        throw new SceneRuntimeError(
          'NON_INVERTIBLE_PARENT_TRANSFORM',
          'matchTransform() cannot convert through a non-invertible parent transform'
        )
      }
      targetMatrix = object.parent.matrixWorld.clone().invert().multiply(targetMatrix)
    }

    const toPosition = new THREE.Vector3()
    const toRotation = new THREE.Quaternion()
    const toScale = new THREE.Vector3()
    targetMatrix.decompose(toPosition, toRotation, toScale)
    const recomposed = new THREE.Matrix4().compose(toPosition, toRotation, toScale)
    if (!matricesApproximatelyEqual(targetMatrix, recomposed)) {
      throw new SceneRuntimeError(
        'MATCH_TRANSFORM_REQUIRES_SHEAR',
        'matchTransform() cannot represent the reference world pose without shear'
      )
    }

    const fromPosition = object.position.clone()
    const fromRotation = object.quaternion.clone()
    const fromScale = object.scale.clone()
    return {
      update({ easedProgress }) {
        object.position.lerpVectors(fromPosition, toPosition, easedProgress)
        object.quaternion.slerpQuaternions(fromRotation, toRotation, easedProgress)
        object.scale.lerpVectors(fromScale, toScale, easedProgress)
      }
    }
  }
})

export const wait = (duration: number): AnimationPlan => ({
  duration,
  easing: 'linear',
  bind: () => ({ update() {} })
})

export const createAnimation = (animation: AnimationPlan): AnimationPlan => animation
