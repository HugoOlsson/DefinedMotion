import * as THREE from 'three'

export interface ScreenBounds {
  readonly left: number
  readonly right: number
  readonly top: number
  readonly bottom: number
  readonly width: number
  readonly height: number
}

export interface ScreenProjection {
  readonly bounds: ScreenBounds | null
  readonly inFrame: boolean
  readonly fullyInFrame: boolean
  readonly behindCamera: boolean
  readonly partiallyBehindCamera: boolean
}

const finiteVector = (vector: THREE.Vector3): boolean =>
  Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z)

const corners = (bounds: THREE.Box3): THREE.Vector3[] => {
  const { min, max } = bounds
  return [
    new THREE.Vector3(min.x, min.y, min.z),
    new THREE.Vector3(min.x, min.y, max.z),
    new THREE.Vector3(min.x, max.y, min.z),
    new THREE.Vector3(min.x, max.y, max.z),
    new THREE.Vector3(max.x, min.y, min.z),
    new THREE.Vector3(max.x, min.y, max.z),
    new THREE.Vector3(max.x, max.y, min.z),
    new THREE.Vector3(max.x, max.y, max.z)
  ]
}

export const worldBounds = (object: THREE.Object3D): THREE.Box3 => {
  object.updateWorldMatrix(true, true)
  const bounds = new THREE.Box3().setFromObject(object)
  return finiteVector(bounds.min) && finiteVector(bounds.max) ? bounds : new THREE.Box3()
}

export const ownWorldBounds = (
  object: THREE.Object3D & { geometry?: THREE.BufferGeometry }
): THREE.Box3 => {
  object.updateWorldMatrix(true, false)
  const instanced = object as THREE.InstancedMesh
  if (instanced.isInstancedMesh) {
    instanced.computeBoundingBox()
    return instanced.boundingBox?.clone().applyMatrix4(object.matrixWorld) ?? new THREE.Box3()
  }
  const geometry = object.geometry
  if (!geometry) return new THREE.Box3()
  if (!geometry.boundingBox) geometry.computeBoundingBox()
  return geometry.boundingBox?.clone().applyMatrix4(object.matrixWorld) ?? new THREE.Box3()
}

const emptyProjection = (behindCamera: boolean): ScreenProjection => ({
  bounds: null,
  inFrame: false,
  fullyInFrame: false,
  behindCamera,
  partiallyBehindCamera: false
})

export const projectWorldBounds = (
  bounds: THREE.Box3,
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  viewportWidth: number,
  viewportHeight: number
): ScreenProjection => {
  if (bounds.isEmpty()) return emptyProjection(false)
  camera.updateProjectionMatrix()
  camera.updateWorldMatrix(true, false)
  const allCorners = corners(bounds)
  const projectable = allCorners.filter((corner) => {
    const cameraZ = corner.clone().applyMatrix4(camera.matrixWorldInverse).z
    return cameraZ <= -camera.near && cameraZ >= -camera.far
  })
  if (projectable.length === 0) return emptyProjection(true)
  const pixels = projectable
    .map((corner) => corner.clone().project(camera))
    .filter(finiteVector)
    .map((point) => ({
      x: ((point.x + 1) / 2) * viewportWidth,
      y: ((1 - point.y) / 2) * viewportHeight
    }))
  if (pixels.length === 0) return emptyProjection(true)
  const left = Math.min(...pixels.map(({ x }) => x))
  const right = Math.max(...pixels.map(({ x }) => x))
  const top = Math.min(...pixels.map(({ y }) => y))
  const bottom = Math.max(...pixels.map(({ y }) => y))
  const partiallyBehindCamera = projectable.length !== allCorners.length
  return {
    bounds: { left, right, top, bottom, width: right - left, height: bottom - top },
    inFrame: right >= 0 && left <= viewportWidth && bottom >= 0 && top <= viewportHeight,
    fullyInFrame:
      !partiallyBehindCamera &&
      left >= 0 &&
      right <= viewportWidth &&
      top >= 0 &&
      bottom <= viewportHeight,
    behindCamera: false,
    partiallyBehindCamera
  }
}

export const screenBounds = (
  object: THREE.Object3D,
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  viewportWidth: number,
  viewportHeight: number
): ScreenBounds | null =>
  projectWorldBounds(worldBounds(object), camera, viewportWidth, viewportHeight).bounds

export const isVisibleInHierarchy = (object: THREE.Object3D): boolean => {
  let current: THREE.Object3D | null = object
  while (current) {
    if (!current.visible) return false
    current = current.parent
  }
  return true
}
