import { SceneRuntimeError } from '../scene/sceneErrors'

export type EasingName =
  | 'linear'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | 'rubberband'

export type EasingFunction = (linearProgress: number) => number
export type Easing = EasingName | EasingFunction

export interface AnimationStartContext {
  readonly startFrame: number
  readonly durationFrames: number
  readonly endFrame: number
}

export interface AnimationUpdate {
  readonly easedProgress: number
  readonly linearProgress: number
  readonly isFirstFrame: boolean
  readonly isLastFrame: boolean
}

export interface BoundAnimation {
  update(update: AnimationUpdate): void
}

export interface AnimationPlan {
  /** Authored duration in seconds. */
  duration: number
  /** Defaults to linear for a raw custom plan. */
  easing?: Easing
  bind(context: AnimationStartContext): BoundAnimation
}

export interface ScheduledAnimationPlan {
  readonly kind: 'plan'
  readonly startFrame: number
  readonly durationFrames: number
  readonly endFrame: number
  readonly bind: AnimationPlan['bind']
  readonly easing: EasingFunction
  bound?: BoundAnimation
}

const easingNames: readonly EasingName[] = [
  'linear',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'rubberband'
]

const namedEasings: Record<EasingName, EasingFunction> = {
  linear: (progress) => progress,
  'ease-in': (progress) => progress * progress,
  'ease-out': (progress) => 1 - (1 - progress) * (1 - progress),
  'ease-in-out': (progress) =>
    progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2,
  rubberband: (progress) => {
    const overshoot = 1.70158
    return (
      1 +
      (overshoot + 1) * Math.pow(progress - 1, 3) +
      overshoot * Math.pow(progress - 1, 2)
    )
  }
}

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
  typeof value === 'object' && value !== null && 'then' in value

export const isAnimationPlan = (value: unknown): value is AnimationPlan => {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<AnimationPlan>
  return typeof candidate.duration === 'number' && typeof candidate.bind === 'function'
}

export const secondsToFrames = (seconds: number, fps: number): number => {
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new SceneRuntimeError(
      'INVALID_TIME_VALUE',
      `Seconds must be a finite non-negative number, received ${seconds}`
    )
  }
  if (!Number.isFinite(fps) || fps <= 0) {
    throw new SceneRuntimeError(
      'INVALID_TIMELINE_FPS',
      `Timeline FPS must be a finite positive number, received ${fps}`
    )
  }
  return Math.round(seconds * fps)
}

export const millisecondsToFrames = (milliseconds: number, fps: number): number => {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) {
    throw new SceneRuntimeError(
      'INVALID_TIME_VALUE',
      `Milliseconds must be a finite non-negative number, received ${milliseconds}`
    )
  }
  return secondsToFrames(milliseconds / 1000, fps)
}

export const resolveEasing = (easing: Easing = 'linear'): EasingFunction => {
  if (typeof easing === 'function') return easing
  const resolved = namedEasings[easing]
  if (resolved) return resolved
  throw new SceneRuntimeError(
    'UNKNOWN_EASING',
    `Unknown easing "${String(easing)}". Expected one of: ${easingNames.join(', ')}`
  )
}

export const compileAnimationPlan = (
  plan: AnimationPlan,
  startFrame: number,
  fps: number
): ScheduledAnimationPlan => {
  if (!isAnimationPlan(plan)) {
    throw new SceneRuntimeError(
      'INVALID_ANIMATION_PLAN',
      'Animation plans must provide a numeric duration and synchronous bind() function'
    )
  }
  if (!Number.isFinite(plan.duration) || plan.duration <= 0) {
    throw new SceneRuntimeError(
      'INVALID_ANIMATION_DURATION',
      `Animation duration must be a finite positive number of seconds, received ${plan.duration}`
    )
  }
  if (!Number.isInteger(startFrame) || startFrame < 0) {
    throw new SceneRuntimeError(
      'INVALID_TIMELINE_POINTER',
      `Animation start frame must be a non-negative integer, received ${startFrame}`
    )
  }

  const durationFrames = secondsToFrames(plan.duration, fps)
  if (durationFrames < 1) {
    throw new SceneRuntimeError(
      'ANIMATION_DURATION_BELOW_ONE_FRAME',
      `Animation duration ${plan.duration} seconds compiles to zero frames at ${fps} FPS`
    )
  }

  return {
    kind: 'plan',
    startFrame,
    durationFrames,
    endFrame: startFrame + durationFrames,
    bind: plan.bind,
    easing: resolveEasing(plan.easing)
  }
}

export const bindScheduledAnimation = (animation: ScheduledAnimationPlan): void => {
  if (animation.bound) return
  const result = animation.bind(
    Object.freeze({
      startFrame: animation.startFrame,
      durationFrames: animation.durationFrames,
      endFrame: animation.endFrame
    })
  )
  if (isPromiseLike(result)) {
    throw new SceneRuntimeError(
      'ASYNC_ANIMATION_BIND',
      'AnimationPlan.bind() must return synchronously'
    )
  }
  if (typeof result !== 'object' || result === null || typeof result.update !== 'function') {
    throw new SceneRuntimeError(
      'INVALID_BOUND_ANIMATION',
      'AnimationPlan.bind() must return an object with a synchronous update() function'
    )
  }
  animation.bound = result
}

export const updateScheduledAnimation = (
  animation: ScheduledAnimationPlan,
  frame: number
): void => {
  if (!animation.bound) {
    throw new SceneRuntimeError(
      'UNBOUND_ANIMATION',
      `Animation starting at frame ${animation.startFrame} was updated before it was bound`
    )
  }

  const localFrame = frame - animation.startFrame
  const isFirstFrame = localFrame === 0
  const isLastFrame = localFrame === animation.durationFrames - 1
  const linearProgress =
    animation.durationFrames === 1 ? 1 : localFrame / (animation.durationFrames - 1)
  const easedProgress =
    isFirstFrame && !isLastFrame
      ? 0
      : isLastFrame
        ? 1
        : animation.easing(linearProgress)

  if (!Number.isFinite(easedProgress)) {
    throw new SceneRuntimeError(
      'INVALID_EASING_RESULT',
      `Animation easing returned ${easedProgress} at linear progress ${linearProgress}`
    )
  }

  const result = animation.bound.update(
    Object.freeze({
      easedProgress,
      linearProgress,
      isFirstFrame,
      isLastFrame
    })
  )
  if (isPromiseLike(result)) {
    throw new SceneRuntimeError(
      'ASYNC_ANIMATION_UPDATE',
      'BoundAnimation.update() must complete synchronously'
    )
  }
}
