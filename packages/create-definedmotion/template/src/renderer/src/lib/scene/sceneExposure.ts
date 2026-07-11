import * as THREE from 'three'
import { SceneRuntimeError } from './sceneErrors'

export type ExposedObjectDataValue = string | number | boolean | null

export interface ExposedObjectMetadata {
  description?: string
  tags?: string[]
  data?: Record<string, ExposedObjectDataValue>
}

export interface ExposedSceneObject {
  id: string
  object: THREE.Object3D
  metadata: ExposedObjectMetadata
}

export class SceneExposureRegistry {
  private objects = new Map<string, ExposedSceneObject>()
  private idsByObject = new WeakMap<THREE.Object3D, string>()

  expose<T extends THREE.Object3D>(id: string, object: T, metadata: ExposedObjectMetadata): T {
    const normalizedId = validateId(id)
    if (!(object instanceof THREE.Object3D)) {
      throw new SceneRuntimeError(
        'INVALID_EXPOSED_OBJECT',
        `Exposed object "${normalizedId}" must be a Three.js Object3D`
      )
    }
    if (this.objects.has(normalizedId)) {
      throw new SceneRuntimeError(
        'DUPLICATE_EXPOSED_ID',
        `Exposed object id "${normalizedId}" is already registered in this scene build`
      )
    }
    const previousId = this.idsByObject.get(object)
    if (previousId) {
      throw new SceneRuntimeError(
        'DUPLICATE_EXPOSED_OBJECT',
        `This object is already exposed as "${previousId}"`
      )
    }

    this.objects.set(normalizedId, {
      id: normalizedId,
      object,
      metadata: normalizeMetadata(metadata, normalizedId)
    })
    this.idsByObject.set(object, normalizedId)
    return object
  }

  snapshot(): ExposedSceneObject[] {
    return [...this.objects.values()]
  }

  get size(): number {
    return this.objects.size
  }

  clear(): void {
    this.objects.clear()
    this.idsByObject = new WeakMap()
  }
}

const validateId = (id: string): string => {
  if (typeof id !== 'string' || id.trim() === '') {
    throw new SceneRuntimeError(
      'INVALID_EXPOSED_ID',
      'Exposed object id must be a non-empty string'
    )
  }
  if (id !== id.trim()) {
    throw new SceneRuntimeError(
      'INVALID_EXPOSED_ID',
      'Exposed object id cannot start or end with whitespace'
    )
  }
  if (id.length > 128) {
    throw new SceneRuntimeError(
      'INVALID_EXPOSED_ID',
      'Exposed object id cannot exceed 128 characters'
    )
  }
  return id
}

const normalizeMetadata = (metadata: ExposedObjectMetadata, id: string): ExposedObjectMetadata => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new SceneRuntimeError(
      'INVALID_EXPOSED_METADATA',
      `Metadata for exposed object "${id}" must be an object`
    )
  }
  const normalized: ExposedObjectMetadata = {}
  if (metadata.description !== undefined) {
    if (typeof metadata.description !== 'string' || metadata.description.length > 2000) {
      throw new SceneRuntimeError(
        'INVALID_EXPOSED_METADATA',
        `Description for exposed object "${id}" must be a string of at most 2000 characters`
      )
    }
    normalized.description = metadata.description
  }
  if (metadata.tags !== undefined) {
    if (
      !Array.isArray(metadata.tags) ||
      metadata.tags.length > 50 ||
      metadata.tags.some((tag) => typeof tag !== 'string' || tag.trim() === '' || tag.length > 64)
    ) {
      throw new SceneRuntimeError(
        'INVALID_EXPOSED_METADATA',
        `Tags for exposed object "${id}" must contain at most 50 non-empty strings of at most 64 characters`
      )
    }
    normalized.tags = [...new Set(metadata.tags)]
  }
  if (metadata.data !== undefined) {
    if (
      !metadata.data ||
      typeof metadata.data !== 'object' ||
      Array.isArray(metadata.data) ||
      Object.entries(metadata.data).length > 50 ||
      Object.entries(metadata.data).some(
        ([key, value]) =>
          key.trim() === '' ||
          key.length > 64 ||
          (value !== null && !['string', 'number', 'boolean'].includes(typeof value)) ||
          (typeof value === 'number' && !Number.isFinite(value))
      )
    ) {
      throw new SceneRuntimeError(
        'INVALID_EXPOSED_METADATA',
        `Data for exposed object "${id}" must contain at most 50 finite JSON primitive values`
      )
    }
    normalized.data = { ...metadata.data }
  }
  return normalized
}
