import * as THREE from 'three'
import { UserAnimation } from './protocols'
import { easeInOutQuad } from './interpolations'

export const fadeIn = (object: THREE.Mesh, duration: number = 800): UserAnimation => {
  return new UserAnimation(easeInOutQuad(0, 1, duration), (value) => {
    const material = object.material as THREE.Material
    if (!material.transparent) {
      material.transparent = true
    }
    material.opacity = value
  })
}

export const fadeOut = (object: THREE.Mesh, duration: number = 800) =>
  fadeIn(object, duration).reverse()

export const zoomIn = (object: THREE.Mesh, duration: number = 800): UserAnimation => {
  return new UserAnimation(easeInOutQuad(0, 1, duration), (value) => {
    object.scale.set(value, value, value)
  })
}

export const zoomOut = (object: THREE.Mesh, duration: number = 800) =>
  zoomIn(object, duration).reverse()

export const moveTo = (
  current: THREE.Object3D,
  target: THREE.Object3D,
  duration: number = 800
): UserAnimation => {
  // Store initial position and calculate target position
  const startPosition = current.position.clone()
  const targetWorldPosition = new THREE.Vector3()

  // Get target position in world space
  target.getWorldPosition(targetWorldPosition)

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
