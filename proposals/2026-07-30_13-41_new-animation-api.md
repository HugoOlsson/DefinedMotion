# New animation API

## Goal

Use one animation scheduling operation with an explicitly controllable frame pointer:

```ts
scene.getTimelinePointer(): number
scene.setTimelinePointer(frame: number): void
scene.addAnims(...animations: AnimationPlan[]): void
```

This should cover sequential, parallel, background, overlapping, and explicitly positioned animations without separate scheduling methods for each case.

## Runtime-bound animations

Animations are created while the timeline is built, but values that depend on scene state are captured when the animation actually starts:

```ts
interface AnimationPlan {
  durationFrames: number
  bind(context: AnimationStartContext): BoundAnimation
}

interface BoundAnimation {
  update(progress: number): void
}
```

The plan contains schedule-time information such as duration. `bind()` runs once at the animation's start frame and creates its updater using the scene state at that moment.

For example, `moveTo()` knows its duration immediately but snapshots both mutable endpoints when it starts:

```ts
function moveTo(object, target, durationFrames): AnimationPlan {
  return {
    durationFrames,

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

Runtime capture is the default for mutable endpoint values. If `target` refers to another object's position, movement before this animation starts is therefore reflected automatically. An author who needs an endpoint frozen during scene construction can pass an explicit snapshot such as `target.clone()`.

`bind()` snapshots the target once. Changes before the start frame affect the endpoint; changes after binding do not turn `moveTo()` into a continuous following constraint.

When several animations start on the same frame, all of them must bind before any of them update. This ensures that parallel animations observe the same pre-animation scene state.

`update(progress)` sets the complete animation state for that progress and must not depend on earlier calls. Bound state is discarded when the scene resets. During exact seeking, DefinedMotion traces the preceding frames and calls `bind()` at the same animation start frame, reproducing the same captured values. `bind()` must therefore only perform replay-safe scene-local work, not external side effects.

The same plan may be scheduled more than once. Every scheduled occurrence owns a separate bound instance.

## Frames and duration

Frames are the only timeline source of truth. `durationFrames` is an integer of at least `1`, and an animation starting at `startFrame` occupies the end-exclusive range:

```text
[startFrame, startFrame + durationFrames)
```

The last included frame receives `progress = 1`. A one-frame animation receives only `progress = 1`. Instantaneous changes use `scene.do()` rather than a zero-frame animation.

Convenience conversion is scene-dependent because the timeline FPS belongs to the scene:

```ts
scene.secondsToFrames(0.6)
scene.millisecondsToFrames(500)
```

Both helpers round to the nearest integer frame and may return `0`. Animation construction rejects a `durationFrames` value below `1`; instantaneous changes use `scene.do()`. Once converted, scheduling and animation plans contain frames only.

## Why this replaces `addDeferredAnims`

`addDeferredAnims` exists because an eagerly created animation may capture values too early:

```ts
scene.addAnims(moveTo(box, pointA))
scene.addDeferredAnims(() => moveTo(box, pointB))
```

When the timeline is built, `box` has not reached `pointA`. The deferred factory waits until the second animation starts, allowing it to capture the position produced by the first animation.

The current scheduler must call that factory once during planning to discover the animation's duration and again at runtime to create the real animation. This combines two separate concerns:

1. The timeline needs the duration while it is being built.
2. The animation needs current scene values when it starts.

`AnimationPlan` separates them. Its duration is available immediately, while `bind()` performs the runtime capture:

```ts
scene.addAnims(moveTo(box, pointA))
scene.addAnims(moveTo(box, pointB))
```

Both calls use the same API. The second `moveTo` binds after the first has completed, so it starts from `pointA` without a deferred factory or double execution.

Custom state-dependent animations use the same mechanism:

```ts
scene.addAnims({
  durationFrames: 60,

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

The duration and other scheduling configuration must remain fixed when the plan is created because later timeline positions depend on them. Mutable starting values and endpoints are snapshotted in `bind()`.

## Frame execution order

Each frame runs in this order:

1. `scene.do()` actions.
2. Bind all animations starting on the frame.
3. Update active animations in registration order.
4. Run `onEachTick`.
5. Resolve layout and derived updates.

This order allows an object added by `do()` to be animated on the same frame while ensuring parallel animations bind against the same pre-animation state.

Registration order is scheduling order. If several animations write the same state, the later registered update naturally wins for that frame. DefinedMotion does not require animations to declare property ownership or reject competing writers.

## Pointer behavior

`addAnims(...animations)` schedules every argument at the current pointer, then advances the pointer by the longest animation:

```ts
scene.addAnims(fadeIn(title), moveTo(card, target)) // parallel
scene.addAnims(scaleIn(diagram))                    // starts after both have ended
```

Repeated calls are sequential. Passing multiple animations in one call is the safe way to create a parallel group because `addAnims` advances past its longest member.

The pointer may be saved and restored to schedule sequential background work:

```ts
const resumeAt = scene.getTimelinePointer()

scene.addAnims(backgroundEnter)
scene.addAnims(backgroundMove)

scene.setTimelinePointer(resumeAt)
scene.addAnims(foreground)
```

It may also be moved to an explicit frame:

```ts
const resumeAt = scene.getTimelinePointer()

scene.setTimelinePointer(1200)
scene.addAnims(annotation)

scene.setTimelinePointer(resumeAt)
```

`setTimelinePointer()` only changes where subsequent work is scheduled. It does not remove or alter previously scheduled animations. Scene duration is the latest scheduled work or declared beat end, independent of the final pointer value.

## Replaced APIs

- `addDeferredAnims` is replaced by runtime `bind()`.
- `addSequentialBackgroundAnims` is replaced by saving and restoring the pointer.
- `insertAnimsAt` is replaced by temporarily setting the pointer to an explicit frame.

`scene.do()` remains the discrete action primitive, and `onEachTick` remains the escape hatch for continuous procedural behavior. Beats use the normal scene scheduling operations and expose only read-only local coordinates.
