import type * as THREE from 'three'
import type { BeatFrameCoordinates } from '../animation/beats'
import type { ScreenBounds } from '../measurement'

export interface VerificationFrameRange {
  readonly start: number
  readonly end: number
}

export interface VerificationOptions {
  readonly during?: string
  readonly frames?: VerificationFrameRange
}

export interface VerificationContext {
  readonly globalFrame: number
  readonly viewport: {
    readonly width: number
    readonly height: number
  }
  readonly beat?: Pick<BeatFrameCoordinates, 'name' | 'localFrame' | 'beatProgress'>
  screenBounds(object: THREE.Object3D, camera?: THREE.Camera): ScreenBounds | null
  worldBounds(object: THREE.Object3D): THREE.Box3
  isVisibleInHierarchy(object: THREE.Object3D): boolean
  assert(condition: boolean, message: string, details?: Record<string, unknown>): void
}

export type VerificationCheck = (context: VerificationContext) => void

export interface SceneVerification {
  readonly id: string
  readonly options: VerificationOptions
  readonly check: VerificationCheck
}

export class SceneVerificationRegistry {
  private readonly verifications = new Map<string, SceneVerification>()

  register(id: string, options: VerificationOptions, check: VerificationCheck): void {
    if (typeof id !== 'string' || id.trim() === '' || id !== id.trim()) {
      throw new Error('Verification IDs must be non-empty strings without surrounding whitespace')
    }
    if (this.verifications.has(id)) {
      throw new Error(`Verification ID "${id}" is already registered in this scene`)
    }
    if (typeof options !== 'object' || options === null) {
      throw new Error(`Verification "${id}" requires an options object`)
    }
    if (
      options.during !== undefined &&
      (typeof options.during !== 'string' || options.during.trim() === '')
    ) {
      throw new Error(`Verification "${id}" has an empty beat name`)
    }
    const frames = options.frames
    if (
      frames !== undefined &&
      (!Number.isInteger(frames.start) ||
        !Number.isInteger(frames.end) ||
        frames.start < 0 ||
        frames.end <= frames.start)
    ) {
      throw new Error(
        `Verification "${id}" must use a non-negative end-exclusive frame range with end greater than start`
      )
    }
    if (typeof check !== 'function') throw new Error(`Verification "${id}" requires a callback`)
    this.verifications.set(
      id,
      Object.freeze({
        id,
        options: Object.freeze({
          ...(options.during !== undefined ? { during: options.during } : {}),
          ...(frames ? { frames: Object.freeze({ ...frames }) } : {})
        }),
        check
      })
    )
  }

  snapshot(): SceneVerification[] {
    return [...this.verifications.values()].sort((left, right) => left.id.localeCompare(right.id))
  }

  clear(): void {
    this.verifications.clear()
  }
}
