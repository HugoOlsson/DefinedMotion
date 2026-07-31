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
  /** Seconds. */
  duration?: number
  easing?: Easing
}
```

```ts
moveTo(card, target, {
  duration: 0.6,
  easing: "ease-out",
  space: "local",
})
```

All public animation durations are seconds. Scheduling compiles them once to integer frames using the scene FPS; the timeline and runtime remain entirely frame-based.

Transform helpers accept explicit `"local"` or `"world"` space where applicable. Local space is the default. Mutable target values and targets derived from another object are snapshotted when the plan binds, so changes before the animation starts are reflected automatically.

## Runtime semantics

Duration in seconds is known while the timeline is built and is compiled when scheduled. `bind()` captures current scene values when the animation starts, and `update()` applies deterministic progress on active frames.

Explicit starting values may be supplied when runtime capture is not wanted. Reset discards bound state, and exact seeking reproduces the same binding and result.

Animations starting on the same frame bind before any of them update.

## Entrance and exit behavior

Effects never modify frames before their scheduled start. On their first active frame they apply the value for `progress = 0`, except for an effect whose duration compiles to one frame, which applies its final value.

```text
fadeIn:   hidden at zero opacity → visible at captured opacity
fadeOut:  visible at runtime opacity → hidden with opacity restored
scaleIn:  entrance scale → target scale
scaleOut: runtime scale → exit scale
```

Entrance and exit effects capture their relevant runtime values when they bind. If an object is visible before a later entrance effect, it remains visible until that effect starts.

### Fade lifecycle

`bind()` captures the target object's visibility, the existing materials in its subtree, and each material's current opacity. It does not mutate the object or its materials.

During `update()`, both fades set `transparent = true` on the captured materials. Materials are never cloned or replaced, and transparency remains enabled after the effect completes.

`fadeOut` interpolates from the captured opacities to zero. On its final frame it sets the target object's root `visible = false` and restores every captured opacity while the object is hidden.

`fadeIn` captures the restored opacity values, starts with the target root hidden at zero opacity, then sets it visible and interpolates to the captured values. On its final frame the object is visible with exactly the opacity values it had when the fade bound. A one-frame fade applies only this final state.

This lifecycle makes `fadeOut(object)` followed by `fadeIn(object)` work without retaining restoration state between animation calls. Fade updates remain absolute and idempotent: evaluating an earlier progress after the final progress reproduces the corresponding visibility and opacity.

Shared materials follow ordinary Three.js reference behavior. Other objects sharing a captured material also receive its temporary opacity changes and its persistent `transparent = true` change. The opacity is restored when `fadeOut` completes, but authors who need independent fading must provide independent materials. Documentation must present this as an intentional side effect rather than material isolation.

The fade helpers do not modify `depthWrite`. Their own target root is not rendered while its opacity is exactly zero. Authors of complex transparent 3D geometry remain responsible for any additional depth-ordering requirements.

`opacityTo` also enables transparency on existing materials, but it does not change root visibility or restore the previous opacity. It leaves the requested opacity as the resulting authored state.

Scene reset and exact reconstruction restore authored visibility, opacity, and transparency before replaying scheduled fades, so seeking before a fade does not retain state from a later frame.

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
- document mutations to shared material state;
- define coordinate-space behavior;
- handle durations that compile to one frame without invalid values;
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
