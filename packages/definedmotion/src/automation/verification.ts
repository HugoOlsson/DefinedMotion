import * as THREE from 'three'
import { AutomationCommandError } from './errors'
import type {
  VerificationAutomationRequest,
  VerificationDefinitionResult,
  VerificationFailure
} from './types'
import {
  isVisibleInHierarchy,
  screenBounds as measureScreenBounds,
  worldBounds
} from '../runtime/measurement'
import type {
  AnimatedScene,
  SceneVerification,
  VerificationContext
} from '../runtime/scene/sceneClass'

interface ResolvedVerification {
  readonly verification: SceneVerification
  readonly startFrame: number
  readonly endFrame: number
}

export interface VerificationRun {
  readonly checkedFrames: number
  readonly executedCheckCount: number
  readonly definitions: VerificationDefinitionResult[]
  readonly failures: VerificationFailure[]
}

const promiseLike = (value: unknown): value is PromiseLike<unknown> =>
  typeof value === 'object' && value !== null && 'then' in value

const jsonDetails = (
  details: Record<string, unknown> | undefined
): Record<string, unknown> | undefined => {
  if (details === undefined) return undefined
  try {
    return JSON.parse(JSON.stringify(details)) as Record<string, unknown>
  } catch {
    return { detailsError: 'Verification details were not JSON-serializable' }
  }
}

const resolveVerifications = (
  request: VerificationAutomationRequest,
  scene: AnimatedScene
): ResolvedVerification[] => {
  const available = scene.getVerifications()
  const byId = new Map(available.map((verification) => [verification.id, verification]))
  const selected =
    request.tests?.map((id) => {
      const verification = byId.get(id)
      if (!verification) {
        throw new AutomationCommandError(
          'UNKNOWN_VERIFICATION',
          `Unknown verification "${id}". Available verifications: ${available.map(({ id }) => id).join(', ') || '(none)'}`
        )
      }
      return verification
    }) ?? available

  const resolved = selected.map((verification) => {
    let startFrame = 0
    let endFrame = scene.totalSceneTicks
    if (verification.options.during) {
      let beat
      try {
        beat = scene.timeline.getBeatRange(verification.options.during)
      } catch {
        throw new AutomationCommandError(
          'UNKNOWN_VERIFICATION_BEAT',
          `Verification "${verification.id}" references unknown beat "${verification.options.during}"`
        )
      }
      startFrame = Math.max(startFrame, beat.start)
      endFrame = Math.min(endFrame, beat.end)
    }
    if (verification.options.frames) {
      startFrame = Math.max(startFrame, verification.options.frames.start)
      endFrame = Math.min(endFrame, verification.options.frames.end)
    }
    if (startFrame >= endFrame) {
      throw new AutomationCommandError(
        'EMPTY_VERIFICATION_RANGE',
        `Verification "${verification.id}" has no eligible frames in this scene`
      )
    }
    return { verification, startFrame, endFrame }
  })

  if (request.frame !== undefined) {
    const eligible = resolved.filter(
      ({ startFrame, endFrame }) => startFrame <= request.frame! && request.frame! < endFrame
    )
    if (eligible.length === 0) {
      throw new AutomationCommandError(
        'NO_ELIGIBLE_VERIFICATIONS',
        `No selected verification is eligible at frame ${request.frame}`
      )
    }
    return eligible
  }
  return resolved
}

const definitionsFor = (
  resolved: readonly ResolvedVerification[]
): VerificationDefinitionResult[] =>
  resolved.map(({ verification, startFrame, endFrame }) => ({
    id: verification.id,
    ...(verification.options.during ? { during: verification.options.during } : {}),
    startFrame,
    endFrame
  }))

export const runVerifications = async (
  request: VerificationAutomationRequest,
  scene: AnimatedScene
): Promise<VerificationRun> => {
  if (request.list) {
    await scene.seekExact(0)
    const resolved = resolveVerifications(request, scene)
    return {
      checkedFrames: 0,
      executedCheckCount: 0,
      definitions: definitionsFor(resolved),
      failures: []
    }
  }

  let resolved: ResolvedVerification[] | undefined
  const failures = new Map<string, VerificationFailure>()
  let executedCheckCount = 0
  const checkedFrames = await scene.visitExactFrames(({ frame }) => {
    resolved ??= resolveVerifications(request, scene)
    const eligible = resolved.filter(
      ({ verification, startFrame, endFrame }) =>
        !failures.has(verification.id) &&
        startFrame <= frame &&
        frame < endFrame &&
        (request.frame === undefined || request.frame === frame)
    )
    for (const { verification } of eligible) {
      let assertion: Omit<VerificationFailure, 'testId' | 'globalFrame' | 'beat'> | undefined
      const beat = scene.timeline.getBeatAtFrame(frame)
      const context: VerificationContext = Object.freeze({
        globalFrame: frame,
        viewport: Object.freeze({ width: scene.width, height: scene.height }),
        ...(beat
          ? {
              beat: Object.freeze({
                name: beat.name,
                localFrame: beat.localFrame,
                beatProgress: beat.beatProgress
              })
            }
          : {}),
        screenBounds(object: THREE.Object3D, camera: THREE.Camera = scene.camera) {
          if (!('near' in camera) || !('far' in camera)) {
            throw new Error('screenBounds() requires a perspective or orthographic camera')
          }
          return measureScreenBounds(
            object,
            camera as THREE.PerspectiveCamera | THREE.OrthographicCamera,
            scene.width,
            scene.height
          )
        },
        worldBounds,
        isVisibleInHierarchy,
        assert(condition, message, details) {
          if (condition || assertion) return
          assertion = {
            message,
            ...(details ? { details: jsonDetails(details) } : {})
          }
        }
      })
      try {
        const result = verification.check(context)
        if (promiseLike(result)) {
          void Promise.resolve(result).catch(() => {})
          throw new Error('Verification callbacks must be synchronous')
        }
      } catch (error) {
        assertion ??= {
          message: `Verification callback threw: ${error instanceof Error ? error.message : String(error)}`
        }
      }
      executedCheckCount++
      if (assertion) {
        failures.set(verification.id, {
          testId: verification.id,
          globalFrame: frame,
          ...assertion,
          ...(beat
            ? {
                beat: {
                  name: beat.name,
                  localFrame: beat.localFrame,
                  beatProgress: beat.beatProgress
                }
              }
            : {})
        })
      }
    }
    if (request.frame !== undefined && frame >= request.frame) return false
  })

  resolved ??= resolveVerifications(request, scene)
  return {
    checkedFrames,
    executedCheckCount,
    definitions: definitionsFor(resolved),
    failures: [...failures.values()]
  }
}
