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
wait(durationFrames)

// Custom escape hatch
createAnimation({ durationFrames, bind })
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
  durationFrames?: number
  easing?: Easing
}
```

```ts
moveTo(card, target, {
  durationFrames: scene.secondsToFrames(0.6),
  easing: "ease-out",
  space: "local",
})
```

Transform helpers accept explicit `"local"` or `"world"` space where applicable. Local space is the default. Mutable target values and targets derived from another object are snapshotted when the plan binds, so changes before the animation starts are reflected automatically.

## Runtime semantics

Duration is known while the timeline is built. `bind()` captures current scene values when the animation starts, and `update()` applies deterministic progress on active frames.

Explicit starting values may be supplied when runtime capture is not wanted. Reset discards bound state, and exact seeking reproduces the same binding and result.

Animations starting on the same frame bind before any of them update.

## Entrance and exit behavior

Effects never modify frames before their scheduled start. On their first active frame they apply the value for `progress = 0`, except for a one-frame effect, which applies its final value.

```text
fadeIn:   entrance opacity → target opacity
fadeOut:  runtime opacity → exit opacity
scaleIn:  entrance scale → target scale
scaleOut: runtime scale → exit scale
```

Entrance and exit effects capture their relevant runtime values when they bind. If an object is visible before a later entrance effect, it remains visible until that effect starts.

Fade effects control opacity only; they do not add, remove, show, or hide objects. They mutate the existing materials in the target subtree without cloning or replacing them. If another object shares one of those materials, its opacity changes too. Documentation must warn about this normal Three.js reference behavior; authors who need independent fading must provide independent materials.

Scale effects control scale only. `scaleIn` and `scaleOut` operate around the object's origin, making text, LaTeX, and layout anchors their predictable animation origin.

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
- preserve target properties not controlled by the helper;
- preserve existing material references;
- define coordinate-space behavior;
- handle one-frame durations without invalid values;
- avoid unnecessary per-frame allocation.

Helpers that cannot meet this contract remain advanced utilities or examples.

## API cleanup

The primary API replaces or demotes:

- `zoomIn` and `zoomOut` in favor of `scaleIn` and `scaleOut`;
- public `setOpacity` and `setScale` to internal implementation details;
- duplicate camera helper generations in favor of `camera.*`;
- `fadeInTowardsEnd` to a recipe;
- raw interpolation-array helpers from the public API.

Generic reversal, interpolation-array manipulation, and rescaling of already-created animation objects are not required parts of the new API.

The primary animation documentation presents the complete core set on one short page. Camera, LaTeX, and custom animation are separate sections. A new helper enters the core set only when it is broadly reusable, cannot be expressed clearly through composition, and satisfies the same quality contract.
