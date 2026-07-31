import {
  bindScheduledAnimation,
  compileAnimationPlan,
  isAnimationPlan,
  updateScheduledAnimation,
  type AnimationPlan,
  type ScheduledAnimationPlan
} from './plan'
import { SceneRuntimeError } from '../scene/sceneErrors'

export interface ScheduledAnimationRange {
  readonly startFrame: number
  readonly endFrame: number
}

type ScheduledAnimation = ScheduledAnimationPlan
export type AnimationInput = AnimationPlan

interface AuthoringRange {
  readonly name: string
  readonly startFrame: number
  readonly endFrame: number
}

export class AnimationTimeline {
  private pointer = 0
  private reservedEndFrame = 0
  private animations: ScheduledAnimation[] = []
  private authoringRange?: AuthoringRange

  constructor(private readonly fps: number) {}

  getPointer(): number {
    return this.pointer
  }

  setPointer(frame: number): void {
    if (!Number.isInteger(frame) || frame < 0) {
      throw new SceneRuntimeError(
        'INVALID_TIMELINE_POINTER',
        `Timeline pointer must be a non-negative integer, received ${frame}`
      )
    }
    if (
      this.authoringRange &&
      (frame < this.authoringRange.startFrame || frame > this.authoringRange.endFrame)
    ) {
      throw new SceneRuntimeError(
        'TIMELINE_POINTER_OUTSIDE_BEAT',
        `Timeline pointer ${frame} is outside beat "${this.authoringRange.name}" ` +
          `[${this.authoringRange.startFrame}, ${this.authoringRange.endFrame})`
      )
    }
    this.pointer = frame
  }

  add(...animations: AnimationInput[]): void {
    if (animations.length === 0) {
      throw new SceneRuntimeError(
        'EMPTY_ANIMATION_GROUP',
        'addAnims() requires at least one animation'
      )
    }

    let longestDuration = 0
    const scheduledAnimations: ScheduledAnimation[] = []
    for (const animation of animations) {
      if (!isAnimationPlan(animation)) {
        throw new SceneRuntimeError(
          'INVALID_ANIMATION',
          'addAnims() requires AnimationPlan values'
        )
      }
      const scheduled = compileAnimationPlan(animation, this.pointer, this.fps)
      this.assertAnimationRangeAllowed(scheduled.startFrame, scheduled.endFrame)
      scheduledAnimations.push(scheduled)
      longestDuration = Math.max(longestDuration, scheduled.durationFrames)
    }

    this.animations.push(...scheduledAnimations)
    this.pointer += longestDuration
    this.reservedEndFrame = Math.max(this.reservedEndFrame, this.pointer)
  }

  reservePointerAdvance(durationFrames: number): void {
    if (!Number.isInteger(durationFrames) || durationFrames < 0) {
      throw new SceneRuntimeError(
        'INVALID_ANIMATION_DURATION',
        `Reserved animation duration must be a non-negative integer, received ${durationFrames}`
      )
    }
    const nextPointer = this.pointer + durationFrames
    this.assertAnimationRangeAllowed(this.pointer, nextPointer)
    this.pointer = nextPointer
    this.reservedEndFrame = Math.max(this.reservedEndFrame, this.pointer)
  }

  withAuthoringRange<T>(
    name: string,
    startFrame: number,
    endFrame: number,
    operation: () => T
  ): T {
    if (this.authoringRange) {
      throw new SceneRuntimeError(
        'NESTED_BEAT_AUTHORING',
        `Cannot author beat "${name}" while beat "${this.authoringRange.name}" is active`
      )
    }
    const savedPointer = this.pointer
    this.authoringRange = { name, startFrame, endFrame }
    this.pointer = startFrame
    try {
      return operation()
    } finally {
      this.pointer = savedPointer
      this.authoringRange = undefined
    }
  }

  assertFrameCanBeScheduled(frame: number, operation: string): void {
    if (
      this.authoringRange &&
      (frame < this.authoringRange.startFrame || frame >= this.authoringRange.endFrame)
    ) {
      throw new SceneRuntimeError(
        'SCHEDULED_FRAME_OUTSIDE_BEAT',
        `${operation} targets frame ${frame}, outside beat "${this.authoringRange.name}" ` +
          `[${this.authoringRange.startFrame}, ${this.authoringRange.endFrame})`
      )
    }
  }

  getEndFrame(): number {
    return this.animations.reduce(
      (latest, animation) => Math.max(latest, animation.endFrame),
      this.reservedEndFrame
    )
  }

  getAnimationCrossingFrame(frame: number): ScheduledAnimationRange | undefined {
    const crossing = this.animations.find(
      (animation) => animation.startFrame < frame && frame < animation.endFrame
    )
    return crossing
      ? { startFrame: crossing.startFrame, endFrame: crossing.endFrame }
      : undefined
  }

  async runFrame(frame: number): Promise<void> {
    const active = this.animations.filter(
      (animation) => animation.startFrame <= frame && frame < animation.endFrame
    )

    for (const animation of active) if (!animation.bound) bindScheduledAnimation(animation)

    for (const animation of active) updateScheduledAnimation(animation, frame)
  }

  reset(): void {
    this.pointer = 0
    this.reservedEndFrame = 0
    this.animations = []
    this.authoringRange = undefined
  }

  private assertAnimationRangeAllowed(startFrame: number, endFrame: number): void {
    if (
      this.authoringRange &&
      (startFrame < this.authoringRange.startFrame || endFrame > this.authoringRange.endFrame)
    ) {
      throw new SceneRuntimeError(
        'ANIMATION_OUTSIDE_BEAT',
        `Animation [${startFrame}, ${endFrame}) crosses beat "${this.authoringRange.name}" ` +
          `[${this.authoringRange.startFrame}, ${this.authoringRange.endFrame})`
      )
    }
  }
}
