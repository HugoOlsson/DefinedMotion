# Measurable curve primitive

## Goal

Provide one portable, measurable stroked-path primitive for mathematical curves, trajectories, and diagrams. It replaces scene-specific ribbon meshes without introducing a chart or graph framework.

## API

```ts
const curveVisual = createCurve({
  domain: [0, Math.PI * 2],
  sampleCount: 289,
  pointAt: (phi) => new THREE.Vector3(Math.cos(phi), Math.sin(phi), 0),
  visibleAt: (phi) => Math.cos(phi) >= 0,
  stroke: {
    color: "#55dec9",
    width: 0.045,
    opacity: 1,
    dash: { length: 0.16, gap: 0.12 },
  },
})

curveVisual.setPath(nextPath)

scene.addAnims(
  curve.morphTo(curveVisual, targetPath, {
    duration: 0.8,
    easing: "ease-in-out",
  }),
)
```

```ts
interface CurvePath {
  domain?: readonly [number, number]
  pointAt(value: number): THREE.Vector2 | THREE.Vector3
  visibleAt?(value: number): boolean
}
```

`sampleCount` and `closed` belong to the visual and remain fixed. Open paths include both domain endpoints. Closed paths omit the duplicate endpoint and connect the final sample to the first. `normal` defaults to local positive Z and defines the plane used to expand the stroke into a ribbon.

## Behavior

- The stroke is a triangle ribbon, so width is portable across renderers.
- `visibleAt` is evaluated at each segment midpoint. Invisible segments collapse cleanly.
- Dash length, gap, width, and opacity use curve-local units.
- `setPath()` resamples synchronously, reuses geometry buffers, and updates bounds immediately.
- The visual implements `MeasurableVisual`. Bounds include stroke width and increment `boundsVersion` after path changes.
- `curve.morphTo()` is an ordinary `AnimationPlan`. It captures the current samples and samples the target path when `bind()` runs.
- Morphing interpolates corresponding normalized samples. Visibility changes narrow and widen segments continuously instead of popping.
- Source and target use the visual's existing sample count and open/closed topology. A different topology requires separate visuals and a crossfade.
- Direct frame evaluation is deterministic; curve state never depends on accumulated prior ticks.

Scene helpers may assign meanings such as positive or negative amplitude, but those meanings are not part of DefinedMotion. Multiple curve visuals with different strokes may use different `visibleAt` masks over the same path.

## Deferred

- axes, labels, legends, automatic graph scaling, and mathematical parsing;
- gradients, arrowheads, filled areas, and variable-width strokes;
- automatic correspondence for unrelated shapes or topology changes;
- screen-space stroke widths and camera-facing arbitrary 3D polylines.

## Acceptance

- **CURVE-01:** Solid and dashed ribbon strokes have stable local-unit width.
- **CURVE-02:** `visibleAt` produces separated runs without invalid geometry.
- **CURVE-03:** `setPath()` reuses buffers and updates measurable bounds and `boundsVersion`.
- **CURVE-04:** `curve.morphTo()` samples its mutable target at bind time and reaches the exact target path.
- **CURVE-05:** Visibility changes transition continuously during a morph.
- **CURVE-06:** Open and closed sampling rules are deterministic and validated.
- **CURVE-07:** The azimuthal explainer uses the primitive for live polar, Cartesian, and final mode curves with unchanged scene verifications.

Targeted command: `npm run test:curve --workspace definedmotion`.
