import * as THREE from 'three'
import { UserAnimation } from './protocols'
import { easeConstant, easeInOutQuad } from './interpolations'

export const setOpacity = <T extends THREE.Object3D>(
  object: T,
  opacity: number,
  enableTransparency: boolean = true
) => {
  // Apply opacity to the object and all its children recursively
  object.traverse((child: any) => {
    if (child.material) {
      const materials = child.material instanceof Array ? child.material : [child.material]

      materials.forEach((mat) => {
        if (enableTransparency && !mat.transparent) {
          mat.transparent = true
        }
        mat.opacity = opacity
      })
    }
  })

  return object
}

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

export const fadeIn = (object: THREE.Object3D, duration: number = 800): UserAnimation => {
  return new UserAnimation(easeInOutQuad(0, 1, duration), (value) => {
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

export const fadeOut = (object: THREE.Object3D, duration: number = 800) =>
  fadeIn(object, duration).reverse()

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

export const moveToAnimation = (
  current: THREE.Object3D,
  target: THREE.Vector3,
  duration: number = 800
): UserAnimation => {
  // Store initial position and calculate target position
  const startPosition = current.position.clone()
  const targetWorldPosition = target

  // Convert to current object's parent space if needed
  const targetLocalPosition = new THREE.Vector3()
  if (current.parent) {
    current.parent.worldToLocal(targetLocalPosition.copy(targetWorldPosition))
  } else {
    targetLocalPosition.copy(targetWorldPosition)
  }

  // Calculate movement delta
  const delta = new THREE.Vector3().subVectors(targetLocalPosition, startPosition)

  // Create animation with eased interpolation
  return new UserAnimation(easeInOutQuad(0, 1, duration), (progress) => {
    current.position.copy(startPosition.clone().add(delta.clone().multiplyScalar(progress)))
    current.updateMatrixWorld()
  })
}

export const moveCameraAnimation = (
  camera: THREE.OrthographicCamera | THREE.PerspectiveCamera,
  target: THREE.Vector3,
  duration: number = 800
): UserAnimation => {
  // Store the target position (we'll capture the start position when animation begins)
  const targetPosition = new THREE.Vector3(
    target.x,
    target.y,
    camera.position.z // Keep the same z position
  )

  // We'll capture these values when the animation starts
  let startPosition: THREE.Vector3
  let delta: THREE.Vector3

  // Create animation with eased interpolation
  return new UserAnimation(easeInOutQuad(0, 1, duration), (progress) => {
    // On first frame, capture the current camera position
    if (progress === 0) {
      startPosition = camera.position.clone()

      // Calculate movement delta (only for x and y)
      delta = new THREE.Vector3(
        targetPosition.x - startPosition.x,
        targetPosition.y - startPosition.y,
        0 // No change in z
      )
    }

    camera.position.x = startPosition.x + delta.x * progress
    camera.position.y = startPosition.y + delta.y * progress
    camera.updateMatrixWorld()
  })
}

export const moveCameraAnimation3D = (
  camera: THREE.OrthographicCamera | THREE.PerspectiveCamera,
  positionTarget: THREE.Vector3,
  rotationTarget: THREE.Quaternion,
  duration: number = 800
): UserAnimation => {
  // Store the target position (we'll capture the start position when animation begins)
  const targetPosition = positionTarget.clone()

  // We'll capture these values when the animation starts
  let startPosition: THREE.Vector3
  let posDelta: THREE.Vector3
  let startRotation: THREE.Quaternion

  // Create animation with eased interpolation
  return new UserAnimation(easeInOutQuad(0, 1, duration), (progress) => {
    // On first frame, capture the current camera position
    if (progress === 0) {
      startPosition = camera.position.clone()
      startRotation = camera.quaternion.clone()
      // Calculate movement delta (only for x and y)
      posDelta = targetPosition.clone().sub(startPosition)
    }
    camera.position.copy(startPosition.clone().add(posDelta.clone().multiplyScalar(progress)))
    camera.quaternion.copy(startRotation).slerp(rotationTarget, progress)
  })
}

export const rotateCamera3D = (
  camera: THREE.OrthographicCamera | THREE.PerspectiveCamera,
  rotationTarget: THREE.Quaternion,
  duration: number = 800
): UserAnimation => {
  let startRotation: THREE.Quaternion

  // Create animation with eased interpolation
  return new UserAnimation(easeInOutQuad(0, 1, duration), (progress) => {
    // On first frame, capture the current camera position
    if (progress === 0) {
      startRotation = camera.quaternion.clone()
      // Calculate movement delta (only for x and y)
    }
    camera.quaternion.copy(startRotation).slerp(rotationTarget, progress)
  })
}
