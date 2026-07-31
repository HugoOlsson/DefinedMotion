import type { UserAnimation } from './protocols'
import {
  bindScheduledAnimation,
  compileAnimationPlan,
  isAnimationPlan,
  updateScheduledAnimation,
  type AnimationPlan,
  type ScheduledAnimationPlan
} from './plan'
import { SceneRuntimeError } from '../scene/sceneErrors'

interface ScheduledLegacyAnimation {
  readonly kind: 'legacy'
  readonly startFrame: number
  readonly endFrame: number
  readonly animation: UserAnimation
}

type ScheduledAnimation = ScheduledAnimationPlan | ScheduledLegacyAnimation
export type AnimationInput = AnimationPlan | UserAnimation

const isLegacyAnimation = (value: unknown): value is UserAnimation => {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<UserAnimation>
  return Array.isArray(candidate.interpolation) && typeof candidate.updater === 'function'
}

export class AnimationTimeline {
  private pointer = 0
  private reservedEndFrame = 0
  private animations: ScheduledAnimation[] = []

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
    for (const animation of animations) {
      if (isAnimationPlan(animation)) {
        const scheduled = compileAnimationPlan(animation, this.pointer, this.fps)
        this.animations.push(scheduled)
        longestDuration = Math.max(longestDuration, scheduled.durationFrames)
      } else if (isLegacyAnimation(animation)) {
        this.scheduleLegacyAt(this.pointer, animation)
        longestDuration = Math.max(longestDuration, animation.interpolation.length)
      } else {
        throw new SceneRuntimeError(
          'INVALID_ANIMATION',
          'addAnims() received neither an AnimationPlan nor a legacy animation'
        )
      }
    }

    this.pointer += longestDuration
    this.reservedEndFrame = Math.max(this.reservedEndFrame, this.pointer)
  }

  insertLegacyAt(frame: number, ...animations: UserAnimation[]): void {
    if (!Number.isInteger(frame) || frame < 0) {
      throw new SceneRuntimeError(
        'INVALID_TIMELINE_POINTER',
        `Animation insertion frame must be a non-negative integer, received ${frame}`
      )
    }
    for (const animation of animations) this.scheduleLegacyAt(frame, animation)
  }

  addSequentialLegacy(...animations: UserAnimation[]): void {
    let offset = 0
    for (const animation of animations) {
      this.scheduleLegacyAt(this.pointer + offset, animation)
      offset += animation.interpolation.length
    }
  }

  reservePointerAdvance(durationFrames: number): void {
    if (!Number.isInteger(durationFrames) || durationFrames < 0) {
      throw new SceneRuntimeError(
        'INVALID_ANIMATION_DURATION',
        `Reserved animation duration must be a non-negative integer, received ${durationFrames}`
      )
    }
    this.pointer += durationFrames
    this.reservedEndFrame = Math.max(this.reservedEndFrame, this.pointer)
  }

  getEndFrame(): number {
    return this.animations.reduce(
      (latest, animation) => Math.max(latest, animation.endFrame),
      this.reservedEndFrame
    )
  }

  async runFrame(frame: number): Promise<void> {
    const active = this.animations.filter(
      (animation) => animation.startFrame <= frame && frame < animation.endFrame
    )

    for (const animation of active) {
      if (animation.kind === 'plan' && !animation.bound) bindScheduledAnimation(animation)
    }

    for (const animation of active) {
      if (animation.kind === 'plan') {
        updateScheduledAnimation(animation, frame)
      } else {
        const localFrame = frame - animation.startFrame
        await animation.animation.updater(
          animation.animation.interpolation[localFrame],
          frame,
          localFrame === animation.animation.interpolation.length - 1
        )
      }
    }
  }

  reset(): void {
    this.pointer = 0
    this.reservedEndFrame = 0
    this.animations = []
  }

  private scheduleLegacyAt(frame: number, animation: UserAnimation): void {
    if (!isLegacyAnimation(animation)) {
      throw new SceneRuntimeError(
        'INVALID_ANIMATION',
        'Expected a legacy animation with interpolation and updater values'
      )
    }
    this.animations.push({
      kind: 'legacy',
      startFrame: frame,
      endFrame: frame + animation.interpolation.length,
      animation
    })
  }
}
