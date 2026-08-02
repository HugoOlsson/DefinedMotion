# Layout object measurement

## Goal

Let agents place ordinary Three.js constructions in flex and grid layouts without wrappers or manually authored bounds, while making construction-time layout errors identify the layout that failed.

## API

```ts
const comparison = layout.flex(
  {
    name: 'Orbital comparison',
    flexDirection: 'row',
    gap: 1.2,
    alignItems: 'center'
  },
  [sOrbital, pOrbital, dOrbital]
)
```

`name` is available on every layout constructor and becomes the returned object's Three.js name before children are measured.

Flex and grid accept ordinary unparented `THREE.Object3D` children directly. DefinedMotion visuals continue using their canonical `getLocalBounds()` measurement. Other objects are measured from the finite geometry bounds of their renderable descendants, transformed into the child root's local XY plane. The child root's own transform remains an animation transform and does not change its intrinsic layout size.

## Behavior

- Descendant position, rotation, scale, and changing geometry bounds contribute to automatic measurement.
- Nested DefinedMotion visuals use their canonical bounds and are not measured twice through their implementation geometry.
- Layout remeasures automatic children during resolution, and changes propagate through nested layouts in the same frame.
- Empty groups and objects without finite CPU-measurable geometry fail with `LAYOUT_UNMEASURABLE_CHILD`, identifying both the layout and child.
- Layout continues to own an internal positioning slot. The authored child object and its descendants are not wrapped in a new public visual type.

Custom bounds overrides are deferred until a real particle, shader, or intentionally stable-footprint use case requires them.

## Acceptance

- **LAYOUT-OBJECT-01:** `name` is present in errors thrown during initial layout construction.
- **LAYOUT-OBJECT-02:** Flex and grid accept ordinary groups containing meshes, lines, or points without an authoring adapter.
- **LAYOUT-OBJECT-03:** Descendant transforms are measured in the child root's local plane while the root transform remains untouched.
- **LAYOUT-OBJECT-04:** Geometry and descendant-transform changes reflow the containing and ancestor layouts in the same resolved frame.
- **LAYOUT-OBJECT-05:** Canonically measurable DefinedMotion children retain their existing measurement behavior.
- **LAYOUT-OBJECT-06:** Unmeasurable children fail with a named, actionable error.

Targeted command: `npm run test:layout --workspace definedmotion`.
