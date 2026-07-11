import * as THREE from 'three'
import type {
  InspectBounds3D,
  InspectCameraResult,
  InspectObjectResult,
  InspectScreenBounds,
  InspectTransform,
  QuaternionTuple,
  Vector3Tuple
} from '../../automation/types'
import type {
  AnimatedScene,
  ExposedObjectMetadata,
  ExposedSceneObject
} from './lib/scene/sceneClass'

const MAX_INSPECT_OBJECTS = 500

export interface SceneInspection {
  camera: InspectCameraResult
  objects: InspectObjectResult[]
  totalExposedObjects: number
  objectsTruncated: boolean
}

export const inspectScene = (scene: AnimatedScene): SceneInspection => {
  scene.scene.updateMatrixWorld(true)
  scene.camera.updateProjectionMatrix()
  scene.camera.updateMatrixWorld(true)

  const exposedObjects = scene
    .getExposedObjects()
    .sort((left, right) => left.id.localeCompare(right.id))
  const exposedIds = new Map(exposedObjects.map(({ id, object }) => [object, id]))
  const objects = exposedObjects
    .slice(0, MAX_INSPECT_OBJECTS)
    .map((exposed) => inspectObject(scene, exposed, exposedIds))

  return {
    camera: inspectCamera(scene.camera),
    objects,
    totalExposedObjects: exposedObjects.length,
    objectsTruncated: exposedObjects.length > objects.length
  }
}

const inspectObject = (
  scene: AnimatedScene,
  exposed: ExposedSceneObject,
  exposedIds: Map<THREE.Object3D, string>
): InspectObjectResult => {
  const { object } = exposed
  object.updateWorldMatrix(true, true)

  const attached = isAttachedToScene(object, scene.scene)
  const visible = attached && isEffectivelyVisible(object, scene.scene)
  const worldBounds = getWorldBounds(object)
  const projected = projectBounds(worldBounds, scene.camera, scene.width, scene.height)
  const parentId = findExposedParentId(object, exposedIds)

  return {
    id: exposed.id,
    type: object.type,
    ...(object.name ? { name: object.name } : {}),
    ...(parentId ? { parentId } : {}),
    metadata: cloneMetadata(exposed.metadata),
    attached,
    visible,
    inFrame: visible && projected.inFrame,
    fullyInFrame: visible && projected.fullyInFrame,
    behindCamera: projected.behindCamera,
    partiallyBehindCamera: projected.partiallyBehindCamera,
    localTransform: localTransform(object),
    worldTransform: worldTransform(object),
    worldBounds,
    screenBounds: projected.bounds
  }
}

const inspectCamera = (
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera
): InspectCameraResult => {
  const position = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()
  const scale = new THREE.Vector3()
  camera.matrixWorld.decompose(position, quaternion, scale)
  const rotation = new THREE.Euler().setFromQuaternion(quaternion, 'XYZ')
  const direction = new THREE.Vector3()
  camera.getWorldDirection(direction)

  const common = {
    position: vector3(position),
    rotation: euler3(rotation),
    quaternion: quaternion4(quaternion),
    direction: vector3(direction),
    near: finite(camera.near),
    far: finite(camera.far),
    zoom: finite(camera.zoom)
  }

  if (camera instanceof THREE.OrthographicCamera) {
    return {
      type: 'orthographic',
      ...common,
      left: finite(camera.left),
      right: finite(camera.right),
      top: finite(camera.top),
      bottom: finite(camera.bottom)
    }
  }

  return {
    type: 'perspective',
    ...common,
    fov: finite(camera.fov),
    aspect: finite(camera.aspect)
  }
}

const localTransform = (object: THREE.Object3D): InspectTransform => ({
  position: vector3(object.position),
  rotation: euler3(object.rotation),
  quaternion: quaternion4(object.quaternion),
  scale: vector3(object.scale)
})

const worldTransform = (object: THREE.Object3D): InspectTransform => {
  const position = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()
  const scale = new THREE.Vector3()
  object.matrixWorld.decompose(position, quaternion, scale)
  return {
    position: vector3(position),
    rotation: euler3(new THREE.Euler().setFromQuaternion(quaternion, 'XYZ')),
    quaternion: quaternion4(quaternion),
    scale: vector3(scale)
  }
}

const getWorldBounds = (object: THREE.Object3D): InspectBounds3D | null => {
  const box = new THREE.Box3().setFromObject(object)
  if (box.isEmpty() || !isFiniteVector(box.min) || !isFiniteVector(box.max)) return null
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  return {
    min: vector3(box.min),
    max: vector3(box.max),
    size: vector3(size),
    center: vector3(center)
  }
}

interface ProjectedBounds {
  bounds: InspectScreenBounds | null
  inFrame: boolean
  fullyInFrame: boolean
  behindCamera: boolean
  partiallyBehindCamera: boolean
}

const projectBounds = (
  bounds: InspectBounds3D | null,
  camera: THREE.Camera & { near: number },
  width: number,
  height: number
): ProjectedBounds => {
  if (!bounds) return emptyProjection(false)

  const corners = boxCorners(bounds)
  const frontCorners = corners.filter(
    (corner) => corner.clone().applyMatrix4(camera.matrixWorldInverse).z <= -camera.near
  )
  if (frontCorners.length === 0) return emptyProjection(true)

  const pixels = frontCorners
    .map((corner) => corner.clone().project(camera))
    .filter(isFiniteVector)
    .map((point) => ({
      x: ((point.x + 1) / 2) * width,
      y: ((1 - point.y) / 2) * height
    }))
  if (pixels.length === 0) return emptyProjection(true)

  const minX = Math.min(...pixels.map(({ x }) => x))
  const maxX = Math.max(...pixels.map(({ x }) => x))
  const minY = Math.min(...pixels.map(({ y }) => y))
  const maxY = Math.max(...pixels.map(({ y }) => y))
  const screenBounds = {
    x: finite(minX),
    y: finite(minY),
    width: finite(maxX - minX),
    height: finite(maxY - minY)
  }
  const partiallyBehindCamera = frontCorners.length !== corners.length
  return {
    bounds: screenBounds,
    inFrame: maxX >= 0 && minX <= width && maxY >= 0 && minY <= height,
    fullyInFrame:
      !partiallyBehindCamera && minX >= 0 && maxX <= width && minY >= 0 && maxY <= height,
    behindCamera: false,
    partiallyBehindCamera
  }
}

const emptyProjection = (behindCamera: boolean): ProjectedBounds => ({
  bounds: null,
  inFrame: false,
  fullyInFrame: false,
  behindCamera,
  partiallyBehindCamera: false
})

const boxCorners = (bounds: InspectBounds3D): THREE.Vector3[] => {
  const [minX, minY, minZ] = bounds.min
  const [maxX, maxY, maxZ] = bounds.max
  return [
    new THREE.Vector3(minX, minY, minZ),
    new THREE.Vector3(minX, minY, maxZ),
    new THREE.Vector3(minX, maxY, minZ),
    new THREE.Vector3(minX, maxY, maxZ),
    new THREE.Vector3(maxX, minY, minZ),
    new THREE.Vector3(maxX, minY, maxZ),
    new THREE.Vector3(maxX, maxY, minZ),
    new THREE.Vector3(maxX, maxY, maxZ)
  ]
}

const isAttachedToScene = (object: THREE.Object3D, root: THREE.Scene): boolean => {
  let current: THREE.Object3D | null = object
  while (current) {
    if (current === root) return true
    current = current.parent
  }
  return false
}

const isEffectivelyVisible = (object: THREE.Object3D, root: THREE.Scene): boolean => {
  let current: THREE.Object3D | null = object
  while (current) {
    if (!current.visible) return false
    if (current === root) return true
    current = current.parent
  }
  return false
}

const findExposedParentId = (
  object: THREE.Object3D,
  exposedIds: Map<THREE.Object3D, string>
): string | undefined => {
  let parent = object.parent
  while (parent) {
    const id = exposedIds.get(parent)
    if (id) return id
    parent = parent.parent
  }
  return undefined
}

const cloneMetadata = (metadata: ExposedSceneObject['metadata']): ExposedObjectMetadata => ({
  ...(metadata.description !== undefined ? { description: metadata.description } : {}),
  ...(metadata.tags !== undefined ? { tags: [...metadata.tags] } : {}),
  ...(metadata.data !== undefined ? { data: { ...metadata.data } } : {})
})

const vector3 = (vector: THREE.Vector3): Vector3Tuple => [
  finite(vector.x),
  finite(vector.y),
  finite(vector.z)
]

const euler3 = (euler: THREE.Euler): Vector3Tuple => [
  finite(euler.x),
  finite(euler.y),
  finite(euler.z)
]

const quaternion4 = (quaternion: THREE.Quaternion): QuaternionTuple => [
  finite(quaternion.x),
  finite(quaternion.y),
  finite(quaternion.z),
  finite(quaternion.w)
]

const finite = (value: number): number => {
  const rounded = Math.round(value * 1_000_000) / 1_000_000
  return Object.is(rounded, -0) ? 0 : rounded
}

const isFiniteVector = (vector: THREE.Vector3): boolean =>
  Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z)
