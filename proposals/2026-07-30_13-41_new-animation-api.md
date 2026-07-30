# New animation API

## Goal

Use one animation scheduling operation with an explicitly controllable frame pointer:

```ts
getTimelinePointer(): number
setTimelinePointer(frame: number): void
addAnims(...animations: AnimationPlan[]): void
```

This should cover sequential, parallel, background, overlapping, and explicitly positioned animations without separate scheduling methods for each case.

## Runtime-bound animations

Animations are created while the timeline is built, but values that depend on scene state are captured when the animation actually starts:

```ts
interface AnimationPlan {
  duration: number
  bind(context: AnimationStartContext): BoundAnimation
}

interface BoundAnimation {
  update(progress: number): void
}
```

The plan contains schedule-time information such as duration. `bind()` runs once at the animation's start frame and creates its updater using the scene state at that moment.

For example, `moveTo()` can know its target and duration immediately while delaying its starting-position capture:

```ts
function moveTo(object, target, duration): AnimationPlan {
  return {
    duration,

    bind() {
      const from = object.position.clone()
      const to = target.clone()

      return {
        update(progress) {
          object.position.lerpVectors(from, to, progress)
        }
      }
    }
  }
}
```

Runtime state should be the normal default, but an animation may still use explicit endpoints when required. The animation primitive defines which values are fixed when the plan is created and which are captured by `bind()`.

When several animations start on the same frame, all of them must bind before any of them update. This ensures that parallel animations observe the same pre-animation scene state.

Bound state is discarded when the scene resets. During exact seeking, DefinedMotion traces the preceding frames and calls `bind()` at the same animation start frame, reproducing the same captured values. `bind()` must therefore only perform replay-safe scene-local work, not external side effects.

## Why this replaces `addDeferredAnims`

`addDeferredAnims` exists because an eagerly created animation may capture values too early:

```ts
addAnims(moveTo(box, pointA))
addDeferredAnims(() => moveTo(box, pointB))
```

When the timeline is built, `box` has not reached `pointA`. The deferred factory waits until the second animation starts, allowing it to capture the position produced by the first animation.

The current scheduler must call that factory once during planning to discover the animation's duration and again at runtime to create the real animation. This combines two separate concerns:

1. The timeline needs the duration while it is being built.
2. The animation needs current scene values when it starts.

`AnimationPlan` separates them. Its duration is available immediately, while `bind()` performs the runtime capture:

```ts
addAnims(moveTo(box, pointA))
addAnims(moveTo(box, pointB))
```

Both calls use the same API. The second `moveTo` binds after the first has completed, so it starts from `pointA` without a deferred factory or double execution.

Custom state-dependent animations use the same mechanism:

```ts
addAnims({
  duration: 60,

  bind() {
    const from = object.position.clone()
    const to = calculateTargetFromCurrentScene()

    return {
      update(progress) {
        object.position.lerpVectors(from, to, progress)
      }
    }
  }
})
```

The duration must remain fixed when the plan is created because later timeline positions depend on it. Starting values and targets may be resolved in `bind()`.

## Pointer behavior

`addAnims(...animations)` schedules every argument at the current pointer, then advances the pointer by the longest animation:

```ts
addAnims(fadeIn(title), moveTo(card, target)) // parallel
addAnims(scaleIn(diagram))                    // starts after both have ended
```

Repeated calls are sequential. Passing multiple animations in one call is the safe way to create a parallel group because `addAnims` advances past its longest member.

The pointer may be saved and restored to schedule sequential background work:

```ts
const resumeAt = getTimelinePointer()

addAnims(backgroundEnter)
addAnims(backgroundMove)

setTimelinePointer(resumeAt)
addAnims(foreground)
```

It may also be moved to an explicit frame:

```ts
const resumeAt = getTimelinePointer()

setTimelinePointer(1200)
addAnims(annotation)

setTimelinePointer(resumeAt)
```

`setTimelinePointer()` only changes where subsequent work is scheduled. It does not remove or alter previously scheduled animations. Scene duration is the latest scheduled animation end, independent of the final pointer value.

## Replaced APIs

- `addDeferredAnims` is replaced by runtime `bind()`.
- `addSequentialBackgroundAnims` is replaced by saving and restoring the pointer.
- `insertAnimsAt` is replaced by temporarily setting the pointer to an explicit frame.

`onEachTick` remains separate for continuous procedural behavior. Beat windows can expose the same three operations with a pointer relative to the beat's window on the global timeline.
