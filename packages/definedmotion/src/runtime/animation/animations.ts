import * as THREE from 'three'
import { UserAnimation } from './protocols'
import { easeConstant, easeInOutQuad } from './interpolations'
import { updateSVGShape } from '../svg/svgObjectHelpers'



// General function to set the opacity of any Three object
export const setOpacity = <T extends THREE.Object3D>(
  object: T,
  opacity: number,
  enableTransparency: boolean = true,
  hideWhenZero: boolean = true      // <- new optional flag
) => {
  const epsilon = 0.001
  const isVisible = opacity > epsilon

  if (hideWhenZero) {
    object.visible = isVisible
  }

  object.traverse((child: any) => {
    if (!child.material) return

    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material]

    materials.forEach((mat: any) => {
      if (!mat) return

      if (enableTransparency && !mat.transparent) {
        mat.transparent = true
      }

      mat.opacity = opacity

      // 🔑 key line: invisible things don't affect depth
      if ('depthWrite' in mat) {
        mat.depthWrite = isVisible
      }
    })
  })

  return object
}

// General function to set the scale of any Three object
export const setScale = <T extends THREE.Object3D>(
  object: T,
  scale: number | { x?: number; y?: number; z?: number },
  relative: boolean = false
): THREE.Object3D => {
  if (typeof scale === 'number') {
    // Uniform scaling with a single number
    if (relative) {
      object.scale.multiplyScalar(scale)
    } else {
      object.scale.set(scale, scale, scale)
    }
  } else {
    // Non-uniform scaling with an object containing x, y, z properties
    const scaleX = scale.x !== undefined ? scale.x : relative ? 1 : object.scale.x
    const scaleY = scale.y !== undefined ? scale.y : relative ? 1 : object.scale.y
    const scaleZ = scale.z !== undefined ? scale.z : relative ? 1 : object.scale.z

    if (relative) {
      object.scale.x *= scaleX
      object.scale.y *= scaleY
      object.scale.z *= scaleZ
    } else {
      object.scale.set(scaleX, scaleY, scaleZ)
    }
  }

  return object
}

export const fade = (
  object: THREE.Object3D,
  duration: number = 800,
  fromValue: number = 0,
  toValue: number = 1
): UserAnimation => {
  return new UserAnimation(easeInOutQuad(fromValue, toValue, duration), (value) => {
    setOpacity(object, value)
  })
}

export const fadeInTowardsEnd = (object: THREE.Object3D, duration: number = 800): UserAnimation => {
  return new UserAnimation(
    easeConstant(0, duration / 3).concat(easeInOutQuad(0, 1, (2 * duration) / 3)),
    (value) => {
      setOpacity(object, value)
    }
  )
}

export const fadeIn = (object: THREE.Object3D, duration: number = 800) => fade(object, duration)

export const fadeOut = (object: THREE.Object3D, duration: number = 800) =>
  fade(object, duration).reverse()

export const zoomIn = (
  object: THREE.Object3D,
  duration: number = 800,
  endpoint: number = 1
): UserAnimation => {
  return new UserAnimation(easeInOutQuad(0, endpoint, duration), (value) => {
    setScale(object, value)
  })
}

export const zoomOut = (object: THREE.Object3D, duration: number = 800, endpoint: number = 1) =>
  zoomIn(object, duration, endpoint).reverse()


export const moveRotateCameraAnimation3D = (
  camera: THREE.OrthographicCamera | THREE.PerspectiveCamera,
  startPosition: THREE.Vector3,
  startRotation: THREE.Quaternion,
  positionTarget: THREE.Vector3,
  rotationTarget: THREE.Quaternion,
  duration: number = 800
): UserAnimation => {
  const startPosCopy = startPosition.clone()
  const startRotCopy = startRotation.clone()

  // Store the target position (we'll capture the start position when animation begins)
  const targetPosition = positionTarget.clone()

  const posDelta = targetPosition.clone().sub(startPosCopy)

  // Create animation with eased interpolation
  return new UserAnimation(easeInOutQuad(0, 1, duration), (progress) => {
    camera.position.copy(startPosCopy.clone().add(posDelta.clone().multiplyScalar(progress)))
    camera.quaternion.copy(startRotCopy).slerp(rotationTarget, progress)
  })
}

export const moveCameraAnimation3D = (
  camera: THREE.OrthographicCamera | THREE.PerspectiveCamera,
  startPosition: THREE.Vector3,
  positionTarget: THREE.Vector3,
  duration: number = 800
): UserAnimation => {
  // Store the target position (we'll capture the start position when animation begins)
  const targetPosition = positionTarget.clone()

  const posDelta = targetPosition.clone().sub(startPosition)

  // Create animation with eased interpolation
  return new UserAnimation(easeInOutQuad(0, 1, duration), (progress) => {
    camera.position.copy(startPosition.clone().add(posDelta.clone().multiplyScalar(progress)))
  })
}


export const updateSVGAnim = (currentSVGObject: THREE.Group, toSvg: string, durationMs: number = 300, targetWidth?: number) => {
    const interpolation = easeInOutQuad(-1,1, durationMs)
    const middleValue = interpolation[Math.ceil(interpolation.length/2)]
    return new UserAnimation(interpolation, (value) => {
        
        if (value === middleValue) {
          updateSVGShape(currentSVGObject, toSvg, {targetWidth: targetWidth})
        }
        setOpacity(currentSVGObject, Math.abs(value))
    })
}


// New camera movement toolkit

const cameraAnimStandardDuration = 800

const Interpolation01 = (duration?: number) =>
  easeInOutQuad(0, 1, duration ?? cameraAnimStandardDuration)

/** Move camera position to a target. */
export function moveCameraToAnim(
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  cfg: { position: THREE.Vector3 },
  duration?: number
): () => UserAnimation {
  return () => {
    const start = camera.position.clone()
    const end = cfg.position.clone()
    const I = Interpolation01(duration)
    const delta = new THREE.Vector3().subVectors(end, start)
    return new UserAnimation(I, (t) => {
      camera.position.copy(start).addScaledVector(delta, t)
      camera.updateMatrixWorld()
    })
  }
}

/** Rotate camera to a quaternion target. */
export function rotateCameraToAnim(
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  cfg: { rotation: THREE.Quaternion },
  duration?: number
): () => UserAnimation {
  return () => {
    const startQ = camera.quaternion.clone()
    const endQ = cfg.rotation.clone()
    const I = Interpolation01(duration)
    return new UserAnimation(I, (t) => {
      camera.quaternion.copy(startQ).slerp(endQ, t)
      camera.updateMatrixWorld()
    })
  }
}

/** Move and (optionally) rotate to a quaternion in one go. */
export function flyCameraToAnim(
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  cfg: { position: THREE.Vector3; rotation?: THREE.Quaternion },
  duration?: number
): () => UserAnimation {
  return () => {
    // positions
    const startPos = camera.position.clone()
    const endPos = cfg.position.clone()
    const posDelta = new THREE.Vector3().subVectors(endPos, startPos)

    // rotations
    const startQ = camera.quaternion.clone()
    const endQ = cfg.rotation ? cfg.rotation.clone() : startQ.clone()

    const I = Interpolation01(duration)
    return new UserAnimation(I, (t) => {
      camera.position.copy(startPos).addScaledVector(posDelta, t)
      camera.quaternion.copy(startQ).slerp(endQ, t)
      camera.updateMatrixWorld()
    })
  }
}

/** Zoom: Orthographic -> animate .zoom, Perspective -> animate .fov. */
export function zoomCameraToAnim(
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  cfg: { zoom?: number; fov?: number }, // Ortho: zoom, Persp: fov
  duration?: number
): () => UserAnimation {
  return () => {
    const I = Interpolation01(duration)

    if (camera instanceof THREE.OrthographicCamera) {
      const start = camera.zoom
      const end = cfg.zoom ?? start
      const delta = end - start
      return new UserAnimation(I, (t) => {
        camera.zoom = start + delta * t
        camera.updateProjectionMatrix()
      })
    } else {
      const persp = camera as THREE.PerspectiveCamera
      const start = persp.fov
      const end = cfg.fov ?? start
      const delta = end - start
      return new UserAnimation(I, (t) => {
        persp.fov = start + delta * t
        persp.updateProjectionMatrix()
      })
    }
  }
}
