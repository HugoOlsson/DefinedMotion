import * as THREE from 'three'
import type { AnchorX, AnchorY } from './types'

const corners = (box: THREE.Box3): THREE.Vector3[] => [
  new THREE.Vector3(box.min.x, box.min.y, box.min.z),
  new THREE.Vector3(box.min.x, box.min.y, box.max.z),
  new THREE.Vector3(box.min.x, box.max.y, box.min.z),
  new THREE.Vector3(box.min.x, box.max.y, box.max.z),
  new THREE.Vector3(box.max.x, box.min.y, box.min.z),
  new THREE.Vector3(box.max.x, box.min.y, box.max.z),
  new THREE.Vector3(box.max.x, box.max.y, box.min.z),
  new THREE.Vector3(box.max.x, box.max.y, box.max.z)
]

export const getObjectLocalBounds = (root: THREE.Object3D): THREE.Box2 | null => {
  const bounds = new THREE.Box2()
  let hasBounds = false

  const visit = (object: THREE.Object3D, parentMatrix: THREE.Matrix4, isRoot: boolean): void => {
    object.updateMatrix()
    const localMatrix = isRoot
      ? parentMatrix
      : new THREE.Matrix4().multiplyMatrices(parentMatrix, object.matrix)
    const geometry = (
      object as THREE.Object3D & {
        geometry?: THREE.BufferGeometry
      }
    ).geometry
    if (geometry) {
      if (!geometry.boundingBox) geometry.computeBoundingBox()
      const geometryBounds = geometry.boundingBox
      if (geometryBounds && !geometryBounds.isEmpty()) {
        for (const point of corners(geometryBounds)) {
          point.applyMatrix4(localMatrix)
          if (Number.isFinite(point.x) && Number.isFinite(point.y)) {
            bounds.expandByPoint(new THREE.Vector2(point.x, point.y))
            hasBounds = true
          }
        }
      }
    }
    for (const child of object.children) visit(child, localMatrix, false)
  }

  visit(root, new THREE.Matrix4(), true)
  return hasBounds ? bounds : null
}

export const anchorOffset = (
  bounds: THREE.Box2,
  anchorX: AnchorX,
  anchorY: AnchorY
): THREE.Vector2 => {
  const x =
    anchorX === 'left'
      ? -bounds.min.x
      : anchorX === 'right'
        ? -bounds.max.x
        : -(bounds.min.x + bounds.max.x) / 2
  const y =
    anchorY === 'top'
      ? -bounds.max.y
      : anchorY === 'bottom'
        ? -bounds.min.y
        : -(bounds.min.y + bounds.max.y) / 2
  return new THREE.Vector2(x, y)
}

export const resolveAnchorX = (anchor: AnchorX | undefined): AnchorX => {
  const resolved = anchor ?? 'center'
  if (resolved !== 'left' && resolved !== 'center' && resolved !== 'right') {
    throw new Error(`anchorX must be "left", "center", or "right", received ${String(resolved)}`)
  }
  return resolved
}

export const resolveAnchorY = (anchor: AnchorY | undefined): AnchorY => {
  const resolved = anchor ?? 'middle'
  if (resolved !== 'top' && resolved !== 'middle' && resolved !== 'bottom') {
    throw new Error(`anchorY must be "top", "middle", or "bottom", received ${String(resolved)}`)
  }
  return resolved
}
