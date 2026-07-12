import * as THREE from 'three'
import { SceneRuntimeError } from './sceneErrors'
import {
  normalizeExposedMetadata,
  type ExposedObjectMetadata,
  validateExposedId
} from './sceneExposure'

export type InspectionCamera = THREE.PerspectiveCamera | THREE.OrthographicCamera
export type ExposedCameraMetadata = ExposedObjectMetadata

export interface ExposedSceneCamera {
  id: string
  camera: InspectionCamera
  metadata: ExposedCameraMetadata
}

const MAX_EXPOSED_CAMERAS = 50
export const MAIN_CAMERA_ID = 'main'

export class SceneCameraRegistry {
  private cameras = new Map<string, ExposedSceneCamera>()
  private idsByCamera = new WeakMap<THREE.Camera, string>()

  expose<T extends InspectionCamera>(id: string, camera: T, metadata: ExposedCameraMetadata): T {
    const normalizedId = validateExposedId(id)
    if (normalizedId === MAIN_CAMERA_ID) {
      throw new SceneRuntimeError(
        'RESERVED_CAMERA_ID',
        `Inspection camera id "${MAIN_CAMERA_ID}" is reserved for the authored scene camera`
      )
    }
    if (
      !(camera instanceof THREE.PerspectiveCamera || camera instanceof THREE.OrthographicCamera)
    ) {
      throw new SceneRuntimeError(
        'INVALID_EXPOSED_CAMERA',
        `Inspection camera "${normalizedId}" must be a Three.js PerspectiveCamera or OrthographicCamera`
      )
    }
    if (this.cameras.size >= MAX_EXPOSED_CAMERAS) {
      throw new SceneRuntimeError(
        'TOO_MANY_EXPOSED_CAMERAS',
        `A scene can expose at most ${MAX_EXPOSED_CAMERAS} inspection cameras`
      )
    }
    if (this.cameras.has(normalizedId)) {
      throw new SceneRuntimeError(
        'DUPLICATE_EXPOSED_CAMERA_ID',
        `Inspection camera id "${normalizedId}" is already registered in this scene build`
      )
    }
    const previousId = this.idsByCamera.get(camera)
    if (previousId) {
      throw new SceneRuntimeError(
        'DUPLICATE_EXPOSED_CAMERA',
        `This camera is already exposed as "${previousId}"`
      )
    }

    this.cameras.set(normalizedId, {
      id: normalizedId,
      camera,
      metadata: normalizeExposedMetadata(metadata, normalizedId)
    })
    this.idsByCamera.set(camera, normalizedId)
    return camera
  }

  snapshot(): ExposedSceneCamera[] {
    return [...this.cameras.values()]
  }

  get(id: string): ExposedSceneCamera | undefined {
    return this.cameras.get(id)
  }

  get size(): number {
    return this.cameras.size
  }

  clear(): void {
    this.cameras.clear()
    this.idsByCamera = new WeakMap()
  }
}
