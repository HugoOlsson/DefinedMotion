# Animation effects

Import the canonical effects from `definedmotion/animation`:

```ts
scene.addAnims(
  fadeIn(card, { duration: 0.5 }),
  scaleIn(card, { duration: 0.5 })
)
scene.addAnims(moveTo(card, target, { duration: 0.8, easing: 'ease-out' }))
```

The core set is `fadeIn`, `fadeOut`, `opacityTo`, `scaleIn`, `scaleOut`, `scaleTo`, `moveTo`, `rotateTo`, `matchTransform`, `wait`, and `createAnimation`.

Durations are seconds. Effect defaults are `0.5` seconds and `ease-in-out`; raw custom plans default to linear. Easing names are `linear`, `ease-in`, `ease-out`, `ease-in-out`, and `rubberband`.

All changing scene values are captured when the plan binds. Mutable targets and referenced objects therefore reflect changes made before the animation starts. `moveTo` and `rotateTo` use parent-local coordinates unless `space: 'world'` is set. `matchTransform` captures the reference's visible world pose and rejects a pose that would require shear.

Fades temporarily set existing subtree materials to `transparent = true`. They do not clone materials or change `depthWrite`; objects sharing a material share the temporary fade. `fadeIn` and `fadeOut` restore authored opacity and transparency at their completed endpoint.

Scale effects operate around the object's origin, so choose text, LaTeX, and layout anchors deliberately.
