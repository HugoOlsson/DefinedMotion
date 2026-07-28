import * as THREE from 'three'
import { SceneRuntimeError } from './sceneErrors'

export interface CollisionWatchOptions {
  /** Extra screen-space clearance required around the watched object. */
  paddingPx?: number
  /** Objects whose complete subtrees may intentionally overlap the watched object. */
  ignore?: readonly THREE.Object3D[]
}

export interface CollisionWatch {
  id: string
  object: THREE.Object3D
  paddingPx: number
  ignore: THREE.Object3D[]
}

export class SceneCollisionRegistry {
  private watches = new Map<string, CollisionWatch>()
  private idsByObject = new WeakMap<THREE.Object3D, string>()

  watch<T extends THREE.Object3D>(id: string, object: T, options: CollisionWatchOptions): T {
    const normalizedId = validateCollisionWatchId(id)
    if (!(object instanceof THREE.Object3D)) {
      throw new SceneRuntimeError(
        'INVALID_COLLISION_WATCH_OBJECT',
        `Collision watch "${normalizedId}" must target a Three.js Object3D`
      )
    }
    if (this.watches.has(normalizedId)) {
      throw new SceneRuntimeError(
        'DUPLICATE_COLLISION_WATCH_ID',
        `Collision watch id "${normalizedId}" is already registered in this scene build`
      )
    }
    const previousId = this.idsByObject.get(object)
    if (previousId) {
      throw new SceneRuntimeError(
        'DUPLICATE_COLLISION_WATCH_OBJECT',
        `This object is already watched for collisions as "${previousId}"`
      )
    }

    const normalizedOptions = normalizeCollisionWatchOptions(normalizedId, options)
    this.watches.set(normalizedId, {
      id: normalizedId,
      object,
      paddingPx: normalizedOptions.paddingPx,
      ignore: normalizedOptions.ignore
    })
    this.idsByObject.set(object, normalizedId)
    return object
  }

  snapshot(): CollisionWatch[] {
    return [...this.watches.values()].map((watch) => ({
      ...watch,
      ignore: [...watch.ignore]
    }))
  }

  get size(): number {
    return this.watches.size
  }

  clear(): void {
    this.watches.clear()
    this.idsByObject = new WeakMap()
  }
}

const validateCollisionWatchId = (id: string): string => {
  if (typeof id !== 'string' || id.trim() === '') {
    throw new SceneRuntimeError(
      'INVALID_COLLISION_WATCH_ID',
      'Collision watch id must be a non-empty string'
    )
  }
  if (id !== id.trim()) {
    throw new SceneRuntimeError(
      'INVALID_COLLISION_WATCH_ID',
      'Collision watch id cannot start or end with whitespace'
    )
  }
  if (id.length > 128) {
    throw new SceneRuntimeError(
      'INVALID_COLLISION_WATCH_ID',
      'Collision watch id cannot exceed 128 characters'
    )
  }
  return id
}

const normalizeCollisionWatchOptions = (
  id: string,
  options: CollisionWatchOptions
): { paddingPx: number; ignore: THREE.Object3D[] } => {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new SceneRuntimeError(
      'INVALID_COLLISION_WATCH_OPTIONS',
      `Options for collision watch "${id}" must be an object`
    )
  }

  const paddingPx = options.paddingPx ?? 0
  if (typeof paddingPx !== 'number' || !Number.isFinite(paddingPx) || paddingPx < 0) {
    throw new SceneRuntimeError(
      'INVALID_COLLISION_WATCH_OPTIONS',
      `paddingPx for collision watch "${id}" must be a non-negative finite number`
    )
  }

  const ignore = options.ignore ?? []
  if (
    !Array.isArray(ignore) ||
    ignore.some((object) => !(object instanceof THREE.Object3D))
  ) {
    throw new SceneRuntimeError(
      'INVALID_COLLISION_WATCH_OPTIONS',
      `ignore for collision watch "${id}" must contain only Three.js Object3D values`
    )
  }

  return {
    paddingPx,
    ignore: [...new Set(ignore)]
  }
}
