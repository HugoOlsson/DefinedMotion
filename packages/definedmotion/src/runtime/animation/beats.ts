import { SceneRuntimeError } from '../scene/sceneErrors'
import type { AnimationTimeline } from './timeline'

export interface BeatRange {
  readonly start: number
  readonly end: number
}

export type BeatDefinitions = Readonly<Record<string, BeatRange>>

export interface BeatTick {
  readonly localFrame: number
  readonly globalFrame: number
  readonly localTimeMs: number
  readonly beatProgress: number
}

export type BeatTickUpdater = (tick: BeatTick) => unknown

export interface BeatFrameCoordinates {
  readonly name: string
  readonly startFrame: number
  readonly endFrame: number
  readonly localFrame: number
  readonly beatProgress: number
}

export interface BeatAuthoringContext {
  readonly name: string
  readonly startFrame: number
  readonly endFrame: number
  readonly durationFrames: number
  getLocalTimelinePointer(): number
  onEachTick(updater: BeatTickUpdater): void
}

interface DefinedBeat {
  readonly name: string
  readonly startFrame: number
  readonly endFrame: number
}

type RuntimeDependency = (globalFrame: number, timeMs: number) => unknown
type DependencyRegistration = (dependency: RuntimeDependency) => void

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
  typeof value === 'object' && value !== null && 'then' in value

const beatProgressAt = (localFrame: number, durationFrames: number): number =>
  durationFrames === 1 ? 1 : localFrame / (durationFrames - 1)

export class SceneTimeline {
  private beats = new Map<string, DefinedBeat>()
  private activeBeatName?: string
  private definitionsDeclared = false

  constructor(
    private readonly animationTimeline: AnimationTimeline,
    private readonly fps: number,
    private readonly registerDependency: DependencyRegistration,
    private readonly canAuthor: () => boolean = () => true
  ) {}

  defineBeats(definitions: BeatDefinitions): void {
    this.assertAuthoringAllowed('scene.timeline.defineBeats()')
    if (this.definitionsDeclared) {
      throw new SceneRuntimeError(
        'BEATS_ALREADY_DEFINED',
        'scene.timeline.defineBeats() may be called only once per scene build'
      )
    }
    if (typeof definitions !== 'object' || definitions === null) {
      throw new SceneRuntimeError(
        'INVALID_BEAT_DEFINITIONS',
        'scene.timeline.defineBeats() requires an object of named frame ranges'
      )
    }

    const entries = Object.entries(definitions)
    if (entries.length === 0) {
      throw new SceneRuntimeError(
        'EMPTY_BEAT_DEFINITIONS',
        'scene.timeline.defineBeats() requires at least one named beat'
      )
    }

    const beats = entries.map(([name, range]) => {
      if (name.trim() === '') {
        throw new SceneRuntimeError('INVALID_BEAT_NAME', 'Beat names may not be empty')
      }
      if (
        typeof range !== 'object' ||
        range === null ||
        !Number.isInteger(range.start) ||
        !Number.isInteger(range.end) ||
        range.start < 0 ||
        range.end <= range.start
      ) {
        throw new SceneRuntimeError(
          'INVALID_BEAT_RANGE',
          `Beat "${name}" must use non-negative integer frames with end greater than start`
        )
      }
      return {
        name,
        startFrame: range.start,
        endFrame: range.end
      }
    })

    beats.sort(
      (left, right) =>
        left.startFrame - right.startFrame ||
        left.endFrame - right.endFrame ||
        left.name.localeCompare(right.name)
    )
    for (let index = 1; index < beats.length; index++) {
      const previous = beats[index - 1]
      const current = beats[index]
      if (current.startFrame < previous.endFrame) {
        throw new SceneRuntimeError(
          'OVERLAPPING_BEATS',
          `Beat "${current.name}" overlaps beat "${previous.name}"`
        )
      }
    }

    this.beats = new Map(beats.map((beat) => [beat.name, Object.freeze(beat)]))
    this.definitionsDeclared = true
  }

  beat(name: string, callback: (beat: BeatAuthoringContext) => unknown): void {
    this.assertAuthoringAllowed('scene.timeline.beat()')
    const beat = this.requireBeat(name)
    if (this.activeBeatName) {
      throw new SceneRuntimeError(
        'NESTED_BEAT_AUTHORING',
        `Cannot author beat "${name}" while beat "${this.activeBeatName}" is active`
      )
    }
    if (typeof callback !== 'function') {
      throw new SceneRuntimeError(
        'INVALID_BEAT_CALLBACK',
        `Beat "${name}" requires a synchronous authoring callback`
      )
    }

    let contextIsActive = true
    const durationFrames = beat.endFrame - beat.startFrame
    const context: BeatAuthoringContext = Object.freeze({
      name: beat.name,
      startFrame: beat.startFrame,
      endFrame: beat.endFrame,
      durationFrames,
      getLocalTimelinePointer: () => {
        this.assertContextActive(name, contextIsActive)
        return this.animationTimeline.getPointer() - beat.startFrame
      },
      onEachTick: (updater: BeatTickUpdater) => {
        this.assertContextActive(name, contextIsActive)
        if (typeof updater !== 'function') {
          throw new SceneRuntimeError(
            'INVALID_BEAT_TICK_UPDATER',
            `beat.onEachTick() for "${name}" requires a callback`
          )
        }
        this.registerDependency((globalFrame) => {
          if (globalFrame < beat.startFrame || globalFrame >= beat.endFrame) return
          const localFrame = globalFrame - beat.startFrame
          return updater(
            Object.freeze({
              localFrame,
              globalFrame,
              localTimeMs: (localFrame / this.fps) * 1000,
              beatProgress: beatProgressAt(localFrame, durationFrames)
            })
          )
        })
      }
    })

    this.activeBeatName = name
    try {
      const result = this.animationTimeline.withAuthoringRange(
        name,
        beat.startFrame,
        beat.endFrame,
        () => callback(context)
      )
      if (isPromiseLike(result)) {
        void Promise.resolve(result).catch(() => {})
        throw new SceneRuntimeError(
          'ASYNC_BEAT_AUTHORING',
          `Beat "${name}" authoring callback must complete synchronously`
        )
      }
    } finally {
      contextIsActive = false
      this.activeBeatName = undefined
    }
  }

  getBeatAtFrame(frame: number): BeatFrameCoordinates | undefined {
    if (!Number.isInteger(frame) || frame < 0) {
      throw new SceneRuntimeError(
        'INVALID_TIMELINE_FRAME',
        `Beat inspection frame must be a non-negative integer, received ${frame}`
      )
    }
    for (const beat of this.beats.values()) {
      if (beat.startFrame <= frame && frame < beat.endFrame) {
        const durationFrames = beat.endFrame - beat.startFrame
        const localFrame = frame - beat.startFrame
        return {
          name: beat.name,
          startFrame: beat.startFrame,
          endFrame: beat.endFrame,
          localFrame,
          beatProgress: beatProgressAt(localFrame, durationFrames)
        }
      }
    }
    return undefined
  }

  getBeatRange(name: string): BeatRange {
    const beat = this.requireBeat(name)
    return { start: beat.startFrame, end: beat.endFrame }
  }

  getDeclaredEndFrame(): number {
    let endFrame = 0
    for (const beat of this.beats.values()) endFrame = Math.max(endFrame, beat.endFrame)
    return endFrame
  }

  assertGlobalRuntimeRegistrationAllowed(operation: string): void {
    if (this.activeBeatName) {
      throw new SceneRuntimeError(
        'GLOBAL_RUNTIME_REGISTRATION_IN_BEAT',
        `${operation} is global and cannot be registered inside beat "${this.activeBeatName}"; ` +
          'use beat.onEachTick() instead'
      )
    }
  }

  reset(): void {
    this.beats.clear()
    this.activeBeatName = undefined
    this.definitionsDeclared = false
  }

  private requireBeat(name: string): DefinedBeat {
    const beat = this.beats.get(name)
    if (!beat) {
      throw new SceneRuntimeError('UNKNOWN_BEAT', `Unknown timeline beat "${name}"`)
    }
    return beat
  }

  private assertContextActive(name: string, active: boolean): void {
    if (!active) {
      throw new SceneRuntimeError(
        'BEAT_CONTEXT_OUTSIDE_CALLBACK',
        `Beat context for "${name}" may only be used inside its authoring callback`
      )
    }
  }

  private assertAuthoringAllowed(operation: string): void {
    if (!this.canAuthor()) {
      throw new SceneRuntimeError(
        'BEAT_AUTHORING_OUTSIDE_BUILD',
        `${operation} may only be called while the scene is building`
      )
    }
  }
}
