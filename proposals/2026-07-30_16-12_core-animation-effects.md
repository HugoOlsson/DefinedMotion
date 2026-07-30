# Core animation effects

## Goal

Provide a small canonical set of composable, deterministic animation helpers. Every helper returns the runtime-bound `AnimationPlan` defined by the new animation API.

## Core set

```ts
// Visibility
fadeIn(object, options?)
fadeOut(object, options?)
opacityTo(object, opacity, options?)

// Scale
scaleIn(object, options?)
scaleOut(object, options?)
scaleTo(object, scale, options?)

// Transform
moveTo(object, position, options?)
rotateTo(object, rotation, options?)
matchTransform(object, reference, options?)

// Timeline
wait(duration)

// Custom escape hatch
createAnimation({ duration, bind })
```

Helpers control one concept and compose through `addAnims`:

```ts
scene.addAnims(
  fadeIn(card),
  scaleIn(card),
)
```

Combined helpers such as `fadeAndScaleIn` are recipes, not core primitives.

`transformTo` is initially excluded because synchronized position, rotation, and scale are already expressed by composing `moveTo`, `rotateTo`, and `scaleTo`.

`matchTransform(object, reference)` remains because it provides a distinct object-to-object operation. At bind time, it captures the reference's world position, rotation, and scale and animates the object to that pose.

## Options

All helpers use named options:

```ts
interface AnimationOptions {
  duration?: TimelineDuration
  easing?: Easing
}
```

```ts
moveTo(card, target, {
  duration: seconds(0.6),
  easing: "ease-out",
  space: "local",
})
```

Transform helpers accept explicit `"local"` or `"world"` space where applicable. Local space is the default. Targets supplied as values are copied when the plan is created; targets derived from another object are captured when the plan binds.

## Runtime semantics

Duration is known while the timeline is built. `bind()` captures current scene values when the animation starts, and `update()` applies deterministic progress on active frames.

Explicit starting values may be supplied when runtime capture is not wanted. Reset discards bound state, and exact seeking reproduces the same binding and result.

Animations starting on the same frame bind before any of them update. Plans declare which object properties they control so conflicting concurrent animations can be reported.

## Entrance and exit behavior

`fadeIn` and `scaleIn` establish their pre-start state so an object does not appear in its final state before its entrance.

```text
fadeIn: 0 → authored opacity
scaleIn: authored scale × starting factor → authored scale
```

They preserve authored opacity, scale, visibility, material settings, and pivot behavior. `scaleIn` and `scaleOut` operate around the object's origin, making text, LaTeX, and layout anchors their predictable animation origin.

`fadeOut` and `scaleOut` capture current state when they bind. `fadeOut` hides the object at completion without losing the authored opacity needed by a later entrance.

Ambiguous use of a later entrance effect on an object intended to be visible earlier must produce a clear validation error rather than silently changing its pre-start state.

## Specialized namespaces

Camera effects are grouped separately:

```ts
camera.moveTo(...)
camera.rotateTo(...)
camera.moveToPose(...)
camera.zoomTo(...)
camera.frame(...)
```

LaTeX effects remain grouped under the required specialized API:

```ts
latex.write(...)
latex.mark(...)
latex.highlight(...)
latex.morphTo(...)
latex.particleTransition(...)
```

Specialized helpers still return ordinary `AnimationPlan`s and compose with core effects through `scene.addAnims`.

## Quality contract

Every shipped helper must:

- seek and reset deterministically;
- expose a known duration during planning;
- bind runtime-dependent state only when it starts;
- reach an exact final value;
- preserve authored transform, visibility, opacity, and material state;
- avoid corrupting shared materials;
- define coordinate-space behavior;
- handle one-frame durations without invalid values;
- declare the properties it controls;
- avoid unnecessary per-frame allocation.

Helpers that cannot meet this contract remain advanced utilities or examples.

## API cleanup

The primary API replaces or demotes:

- `zoomIn` and `zoomOut` in favor of `scaleIn` and `scaleOut`;
- public `setOpacity` and `setScale` to internal implementation details;
- duplicate camera helper generations in favor of `camera.*`;
- `fadeInTowardsEnd` to a recipe;
- raw interpolation-array helpers to the advanced API.

The primary animation documentation presents the complete core set on one short page. Camera, LaTeX, and custom animation are separate sections. A new helper enters the core set only when it is broadly reusable, cannot be expressed clearly through composition, and satisfies the same quality contract.
