import * as THREE from 'three'
import { SceneRuntimeError } from '../scene/sceneErrors'
import {
  moveTo as moveObjectTo,
  rotateTo as rotateObjectTo,
  type AnimationOptions,
  type RotationValue,
  type TransformAnimationOptions,
  type Vector3Value
} from './effects'
import type { AnimationPlan } from './plan'

export type AnimatedCamera = THREE.PerspectiveCamera | THREE.OrthographicCamera

export interface CameraPose {
  position: Vector3Value
  rotation: RotationValue
}

export interface CameraFrameOptions extends AnimationOptions {
  padding?: number
}

const planOptions = (options: AnimationOptions): Pick<AnimationPlan, 'duration' | 'easing'> => ({
  duration: options.duration ?? 0.5,
  easing: options.easing ?? 'ease-in-out'
})

const moveTo = (
  cameraObject: AnimatedCamera,
  position: Vector3Value,
  options: TransformAnimationOptions = {}
): AnimationPlan => moveObjectTo(cameraObject, position, options)

const rotateTo = (
  cameraObject: AnimatedCamera,
  rotation: RotationValue,
  options: TransformAnimationOptions = {}
): AnimationPlan => rotateObjectTo(cameraObject, rotation, options)

const moveToPose = (
  cameraObject: AnimatedCamera,
  pose: CameraPose,
  options: TransformAnimationOptions = {}
): AnimationPlan => ({
  ...planOptions(options),
  bind(context) {
    const move = moveObjectTo(cameraObject, pose.position, options).bind(context)
    const rotate = rotateObjectTo(cameraObject, pose.rotation, options).bind(context)
    return {
      update(update) {
        move.update(update)
        rotate.update(update)
        cameraObject.updateMatrixWorld()
      }
    }
  }
})

const zoomTo = (
  cameraObject: AnimatedCamera,
  target: number,
  options: AnimationOptions = {}
): AnimationPlan => ({
  ...planOptions(options),
  bind() {
    if (!Number.isFinite(target) || target <= 0) {
      throw new SceneRuntimeError(
        'INVALID_CAMERA_ZOOM',
        `camera.zoomTo() target must be a positive finite number, received ${target}`
      )
    }
    const from = cameraObject instanceof THREE.OrthographicCamera ? cameraObject.zoom : cameraObject.fov
    return {
      update({ easedProgress }) {
        const value = THREE.MathUtils.lerp(from, target, easedProgress)
        if (cameraObject instanceof THREE.OrthographicCamera) cameraObject.zoom = value
        else cameraObject.fov = value
        cameraObject.updateProjectionMatrix()
      }
    }
  }
})

const frame = (
  cameraObject: AnimatedCamera,
  object: THREE.Object3D,
  options: CameraFrameOptions = {}
): AnimationPlan => ({
  ...planOptions(options),
  bind(context) {
    const padding = options.padding ?? 1.15
    if (!Number.isFinite(padding) || padding <= 0) {
      throw new SceneRuntimeError(
        'INVALID_CAMERA_FRAME_PADDING',
        `camera.frame() padding must be a positive finite number, received ${padding}`
      )
    }

    object.updateWorldMatrix(true, true)
    cameraObject.updateWorldMatrix(true, false)
    const bounds = new THREE.Box3().setFromObject(object)
    if (bounds.isEmpty()) {
      throw new SceneRuntimeError(
        'EMPTY_CAMERA_FRAME_TARGET',
        'camera.frame() target must contain projectable geometry'
      )
    }

    const center = bounds.getCenter(new THREE.Vector3())
    const sphere = bounds.getBoundingSphere(new THREE.Sphere())
    const forward = cameraObject.getWorldDirection(new THREE.Vector3()).normalize()
    let distance = cameraObject.getWorldPosition(new THREE.Vector3()).distanceTo(center)
    let targetZoom: number | undefined

    if (cameraObject instanceof THREE.PerspectiveCamera) {
      const verticalHalfFov = THREE.MathUtils.degToRad(cameraObject.fov * 0.5)
      const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * cameraObject.aspect)
      const limitingHalfFov = Math.min(verticalHalfFov, horizontalHalfFov)
      distance = (sphere.radius * padding) / Math.max(Math.sin(limitingHalfFov), 1e-6)
    } else {
      const inverseCamera = cameraObject.matrixWorld.clone().invert()
      const cameraBounds = new THREE.Box3()
      for (const x of [bounds.min.x, bounds.max.x]) {
        for (const y of [bounds.min.y, bounds.max.y]) {
          for (const z of [bounds.min.z, bounds.max.z]) {
            cameraBounds.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(inverseCamera))
          }
        }
      }
      const size = cameraBounds.getSize(new THREE.Vector3())
      const width = Math.max(size.x * padding, 1e-9)
      const height = Math.max(size.y * padding, 1e-9)
      targetZoom = Math.min(
        (cameraObject.right - cameraObject.left) / width,
        (cameraObject.top - cameraObject.bottom) / height
      )
    }

    const targetPosition = center.clone().addScaledVector(forward, -distance)
    const move = moveObjectTo(cameraObject, targetPosition, {
      duration: options.duration,
      easing: options.easing,
      space: 'world'
    }).bind(context)
    const fromZoom = cameraObject instanceof THREE.OrthographicCamera ? cameraObject.zoom : undefined

    return {
      update(update) {
        move.update(update)
        if (
          cameraObject instanceof THREE.OrthographicCamera &&
          fromZoom !== undefined &&
          targetZoom !== undefined
        ) {
          cameraObject.zoom = THREE.MathUtils.lerp(fromZoom, targetZoom, update.easedProgress)
          cameraObject.updateProjectionMatrix()
        }
        cameraObject.updateMatrixWorld()
      }
    }
  }
})

export const camera = { moveTo, rotateTo, moveToPose, zoomTo, frame }
