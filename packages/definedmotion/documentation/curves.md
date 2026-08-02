# Curves

`createCurve` renders a portable thick parametric path as a measured triangle ribbon.

```ts
import { createCurve } from 'definedmotion/rendering'

const orbit = createCurve({
  domain: [0, Math.PI * 2],
  sampleCount: 289,
  pointAt: (angle) =>
    new THREE.Vector3(Math.cos(angle) * 3, Math.sin(angle) * 3, 0),
  stroke: {
    color: '#55dec9',
    width: 0.045
  }
})
```

`sampleCount` is fixed for the visual. Open curves include both domain endpoints. A closed curve omits the duplicate endpoint and connects its last sample to its first. Stroke width, opacity, dash length, and dash gap use curve-local units. `normal` defaults to local positive Z and defines the plane used to expand the ribbon.

Use `visibleAt` to split a path into selected runs. The meaning belongs to the scene:

```ts
const positive = createCurve({
  ...options,
  visibleAt: (angle) => Math.cos(mode * angle) >= 0
})

const negative = createCurve({
  ...options,
  visibleAt: (angle) => Math.cos(mode * angle) < 0,
  stroke: {
    color: '#55dec9',
    width: 0.04,
    opacity: 0.5,
    dash: { length: 0.15, gap: 0.12 }
  }
})
```

## Immediate updates

`setPath()` synchronously resamples into the existing geometry buffers and updates measured bounds. It is appropriate for exact procedural animation:

```ts
beat.onEachTick(({ beatProgress }) => {
  const mode = modeFromProgress(beatProgress)
  positive.setPath(positivePath(mode))
  negative.setPath(negativePath(mode))
})
```

## Timeline morphs

`curve.morphTo()` returns a normal late-bound animation plan:

```ts
import { curve } from 'definedmotion/animation'

scene.addAnims(
  curve.morphTo(positive, positivePath(3), {
    duration: 0.8,
    easing: 'ease-in-out'
  })
)
```

The target path is sampled when the animation binds. Corresponding normalized samples interpolate with `easedProgress`, and visibility changes narrow or widen continuously. The visual's sample count and open/closed topology do not change during a morph. Use separate visuals and a crossfade when two shapes do not have meaningful parameter correspondence.

Curves provide measured local bounds including their stroke. They do not provide axes, labels, legends, automatic graph scaling, or mathematical parsing.
