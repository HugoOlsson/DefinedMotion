# Layout-owned backgrounds and containment

## Goal

Make ordinary panels, labels, and camera-attached UI correct by construction. A panel and its contents should normally be one layout object, rather than separately sized and positioned geometry.

This is a focused follow-up to `2026-07-30_15-54_primitive-layout.md`. It revises that proposal's handling of intrinsic content that exceeds an explicit layout size; the original proposal remains unchanged as a historical record.

## API

`layout.flex` and `layout.grid` may render their own background and border:

```ts
const status = layout.flex(
  {
    flexDirection: "row",
    gap: 0.25,
    padding: 0.3,
    alignItems: "center",
    background: "#0b1220",
    border: {
      color: "#1e3a5f",
      width: 0.06,
    },
  },
  [dot, label],
)
```

Core visual shapes such as rectangles and circles implement `MeasurableVisual`, so they can be direct flex and grid children.

## Behavior

- An omitted `width` or `height` fits the intrinsic content plus padding.
- The background and border are generated from the resolved layout box.
- They update whenever text, LaTeX, nested layout, or appended content causes reflow.
- An explicit `width` or `height` is a strict constraint. If intrinsic content plus padding does not fit, layout resolution fails with `LAYOUT_OVERFLOW`.
- The error identifies the container, child when applicable, axis, required size, and available size.
- Intrinsic measurement determines containment. Animation transforms remain outside layout calculation, as in the primitive-layout proposal.
- Intentional overflow should be modeled outside the container or with ordinary Three.js objects. The first version has no overflow modes or silent opt-out.

This changes only the safe layout path. Raw Three.js construction remains available when manual geometry is intentional.

## Responsibility boundary

Layout guarantees that its own intrinsic children fit its resolved box. Scene verification still checks relationships the container cannot know, such as whether the complete component is inside the viewport or overlaps another component.

Camera attachment, depth behavior, and FOV-independent positioning are separate concerns and are not introduced here. The same layout component can be used in world space or as camera-attached UI.

## Deferred

- clipping, wrapping, shrinking, and configurable overflow modes;
- a dedicated camera-attached UI mounting API;
- automatically generated scene verifications;
- restrictions on manual Three.js construction.

## Acceptance

- **LAYOUT-SURFACE-01:** A fit-content row background resolves to content, gap, and padding.
- **LAYOUT-SURFACE-02:** Text changes, LaTeX morphs, nested reflow, and appends resize the owned surface on the same evaluated frame.
- **LAYOUT-SURFACE-03:** Core rectangles and circles participate as measured flex and grid children.
- **LAYOUT-SURFACE-04:** Intrinsic content exceeding an explicit dimension reports `LAYOUT_OVERFLOW` with actionable measurements.
- **LAYOUT-SURFACE-05:** A layout-owned status component remains internally contained while used as camera-attached UI.
