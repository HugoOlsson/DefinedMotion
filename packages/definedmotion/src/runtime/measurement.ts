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

const boxEdges: readonly (readonly [number, number])[] = [
  [0, 1],
  [0, 2],
  [0, 4],
  [1, 3],
  [1, 5],
  [2, 3],
  [2, 6],
  [3, 7],
  [4, 5],
  [4, 6],
  [5, 7],
  [6, 7]
]

const projectBoxes = (
  worldBoxes: readonly (readonly THREE.Vector3[])[],
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  viewportWidth: number,
  viewportHeight: number
): ScreenProjection => {
  if (worldBoxes.length === 0) return emptyProjection(false)
  camera.updateProjectionMatrix()
  camera.updateWorldMatrix(true, false)
  const farZ = -camera.far
  const nearZ = -camera.near
  const projectable: THREE.Vector3[] = []
  let cornerCount = 0
  let projectableCornerCount = 0

  for (const worldCorners of worldBoxes) {
    const cameraCorners = worldCorners.map((point) =>
      point.clone().applyMatrix4(camera.matrixWorldInverse)
    )
    cornerCount += cameraCorners.length
    for (const point of cameraCorners) {
      if (point.z >= farZ && point.z <= nearZ) {
        projectable.push(point)
        projectableCornerCount += 1
      }
    }
    for (const [fromIndex, toIndex] of boxEdges) {
      const from = cameraCorners[fromIndex]
      const to = cameraCorners[toIndex]
      const deltaZ = to.z - from.z
      if (deltaZ === 0) continue
      for (const planeZ of [farZ, nearZ]) {
        const amount = (planeZ - from.z) / deltaZ
        if (amount > 0 && amount < 1) {
          projectable.push(from.clone().lerp(to, amount))
        }
      }
    }
  }

  if (projectable.length === 0) return emptyProjection(true)
  const pixels = projectable
    .map((point) => point.clone().applyMatrix4(camera.projectionMatrix))
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
  const partiallyBehindCamera = projectableCornerCount !== cornerCount
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
  return projectBoxes([corners(bounds)], camera, viewportWidth, viewportHeight)
}

const localGeometryBounds = (
  object: THREE.Object3D & { geometry?: THREE.BufferGeometry }
): THREE.Box3 | undefined => {
  const instanced = object as THREE.InstancedMesh
  if (instanced.isInstancedMesh) {
    instanced.computeBoundingBox()
    return instanced.boundingBox ?? undefined
  }
  const geometry = object.geometry
  if (!geometry) return undefined
  if (!geometry.boundingBox) geometry.computeBoundingBox()
  return geometry.boundingBox ?? undefined
}

/** Projects each renderable's transformed local bounds without first axis-aligning the group in world space. */
export const projectObjectBounds = (
  object: THREE.Object3D,
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  viewportWidth: number,
  viewportHeight: number
): ScreenProjection => {
  object.updateWorldMatrix(true, true)
  const worldBoxes: THREE.Vector3[][] = []
  object.traverse((descendant) => {
    const bounds = localGeometryBounds(
      descendant as THREE.Object3D & { geometry?: THREE.BufferGeometry }
    )
    if (!bounds || bounds.isEmpty()) return
    worldBoxes.push(corners(bounds).map((point) => point.applyMatrix4(descendant.matrixWorld)))
  })
  return projectBoxes(worldBoxes, camera, viewportWidth, viewportHeight)
}

export const screenBounds = (
  object: THREE.Object3D,
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  viewportWidth: number,
  viewportHeight: number
): ScreenBounds | null =>
  projectObjectBounds(object, camera, viewportWidth, viewportHeight).bounds

export const isVisibleInHierarchy = (object: THREE.Object3D): boolean => {
  let current: THREE.Object3D | null = object
  while (current) {
    if (!current.visible) return false
    current = current.parent
  }
  return true
}
