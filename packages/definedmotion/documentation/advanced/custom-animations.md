# Custom animations

Use `createAnimation` when a core helper cannot express a property change:

```ts
const reveal = createAnimation({
  duration: 0.8,
  easing: 'ease-out',
  bind() {
    const from = object.customValue
    const to = target.customValue
    return {
      update({ easedProgress, linearProgress, isFirstFrame, isLastFrame }) {
        object.customValue = THREE.MathUtils.lerp(from, to, easedProgress)
      }
    }
  }
})
```

`duration` is authored in seconds and compiles to an end-exclusive integer frame range. `bind()` runs synchronously when the animation first becomes active and captures all runtime-dependent values. Every same-frame plan binds before any updates run.

`update()` is synchronous. Use the explicit first/last booleans for lifecycle work, `easedProgress` for the authored curve, and `linearProgress` for calculations that must ignore easing. A one-frame plan receives both progress values as `1` and both endpoint booleans as true.

Reset discards bound state, so exact reconstruction binds again from the rebuilt scene.
