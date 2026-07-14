import type { AutomationCameraSummary, InspectObjectMetadata } from './types'
import { AutomationCommandError } from './errors'
import { inspectCamera } from './sceneInspection'
import {
  MAIN_CAMERA_ID,
  type AnimatedScene,
  type InspectionCamera
} from '../runtime/scene/sceneClass'

export interface ResolvedInspectionCamera {
  id: string
  isMain: boolean
  camera: InspectionCamera
  metadata: InspectObjectMetadata
}

export const listInspectionCameras = (scene: AnimatedScene): ResolvedInspectionCamera[] => [
  {
    id: MAIN_CAMERA_ID,
    isMain: true,
    camera: scene.camera,
    metadata: {
      description: 'The authored camera used by the animation',
      tags: ['authored-camera']
    }
  },
  ...scene
    .getExposedCameras()
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(({ id, camera, metadata }) => ({
      id,
      isMain: false,
      camera,
      metadata: cloneMetadata(metadata)
    }))
]

export const resolveInspectionCamera = (
  scene: AnimatedScene,
  id: string = MAIN_CAMERA_ID
): ResolvedInspectionCamera => {
  const cameras = listInspectionCameras(scene)
  const resolved = cameras.find((camera) => camera.id === id)
  if (resolved) return resolved
  throw new AutomationCommandError(
    'UNKNOWN_CAMERA',
    `Unknown camera "${id}". Available cameras at frame ${scene.sceneRenderTick}: ${cameras.map((camera) => camera.id).join(', ')}`
  )
}

export const cameraSummary = (camera: ResolvedInspectionCamera): AutomationCameraSummary => {
  camera.camera.updateWorldMatrix(true, false)
  camera.camera.updateProjectionMatrix()
  return {
    id: camera.id,
    isMain: camera.isMain,
    metadata: cloneMetadata(camera.metadata),
    camera: inspectCamera(camera.camera)
  }
}

export const listCameraSummaries = (scene: AnimatedScene): AutomationCameraSummary[] => {
  scene.scene.updateMatrixWorld(true)
  return listInspectionCameras(scene).map(cameraSummary)
}

const cloneMetadata = (metadata: InspectObjectMetadata): InspectObjectMetadata => ({
  ...(metadata.description !== undefined ? { description: metadata.description } : {}),
  ...(metadata.tags !== undefined ? { tags: [...metadata.tags] } : {}),
  ...(metadata.data !== undefined ? { data: { ...metadata.data } } : {})
})
