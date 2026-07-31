# Primitive layout

## Goal

Provide predictable planar rows, columns, and grids for measurable visuals without implementing a complete CSS layout engine.

## API

Rows and columns use one flex constructor with familiar CSS names:

```ts
const column = layout.flex({
  flexDirection: "column",
  gap: 16,
  padding: 24,
  width: 600,
  alignItems: "center",
  justifyContent: "flex-start",
  anchorX: "center",
  anchorY: "top",
}, [
  title,
  explanation,
  equation,
])
```

```ts
interface FlexOptions {
  flexDirection: "row" | "column"
  gap?: number
  padding?: number
  width?: number
  height?: number
  alignItems?: "flex-start" | "center" | "flex-end"
  justifyContent?:
    | "flex-start"
    | "center"
    | "flex-end"
    | "space-between"
    | "space-around"
    | "space-evenly"
  anchorX?: "left" | "center" | "right"
  anchorY?: "top" | "middle" | "bottom"
}
```

`gap` and `padding` default to `0`. `alignItems` and `justifyContent` default to `"flex-start"`. Container anchors default to `"center"` and `"middle"`, matching the text and LaTeX primitives.

An explicit `width` or `height` includes padding. Without an explicit value, that dimension fits its content and padding. Each dimension is resolved independently, and `justifyContent` only has visible extra space to distribute when the main-axis size is explicit.

The first version does not shrink, wrap, or clip oversized content. The explicit layout box remains the requested size and excess content remains visible outside it. Padding larger than the explicit size leaves zero content space and likewise produces visible overflow.

Grid uses a fixed column count and automatic rows:

```ts
const cards = layout.grid({
  columns: 3,
  columnGap: 20,
  rowGap: 16,
  padding: 24,
  alignItems: "center",
  justifyItems: "center",
}, [
  cardA,
  cardB,
  cardC,
  cardD,
])
```

```ts
interface GridOptions {
  columns: number
  columnGap?: number
  rowGap?: number
  padding?: number
  width?: number
  height?: number
  alignItems?: "flex-start" | "center" | "flex-end"
  justifyItems?: "flex-start" | "center" | "flex-end"
  anchorX?: "left" | "center" | "right"
  anchorY?: "top" | "middle" | "bottom"
}
```

Columns use the widest intrinsic item in that column. Rows use the tallest intrinsic item in that row.

Grid gaps and padding default to `0`; `alignItems` and `justifyItems` default to `"flex-start"`; and its anchors default to `"center"` and `"middle"`. Grid width and height follow the same explicit-size, automatic-size, padding, and overflow rules as flex.

## Layout space

Layout operates in the container's local XY plane using local units. It changes X and Y slot positions and preserves child Z values. The completed group can be transformed, added to the scene, or attached to a camera like any other Three.js group.

Children must implement the shared `MeasurableVisual` contract. Flex and grid containers implement the same contract, allowing layouts to be nested.

A visual passed to a layout must not already have a parent. Layout construction fails clearly rather than silently reparenting an existing scene object or attempting to preserve its world transform.

## Slots and animation

Each item is placed inside an internal slot:

```text
LayoutGroup
  └── slot positioned by layout
        └── visual transformed by animations
```

Layout owns the slot transform. Animations own the visual's transform inside the slot. Animated position, rotation, or scale therefore does not trigger reflow or overwrite the layout position. This follows CSS behavior where transforms do not affect layout.

Layout measures each visual's intrinsic local bounds. A successful text or LaTeX content update invalidates its containing layout, which reflows before the next completed frame.

Invalidation propagates through every containing layout. Dirty nested layouts resolve from the innermost container outward before rendering and frame verification, so an inner content or membership change is reflected by every ancestor in the same completed frame. Because the initial feature excludes parent-dependent percentages, stretch, and flex growth, this is a tree traversal rather than a general constraint solver.

## Appending items

The first version supports appending already-created measurable visuals:

```ts
const list = layout.flex({
  flexDirection: "column",
  gap: 16,
  alignItems: "flex-start",
  anchorX: "left",
  anchorY: "top",
}, [])

const bullet = await createText({
  text: "Rotate the food",
  fontSize: 36,
})

scene.do(() => {
  list.append(bullet)
})

scene.addAnims(fadeIn(bullet))
```

`append()` creates a slot and synchronously reflows the container. It also invalidates the containing layout chain, which resolves from that container outward before the frame is completed. The following animation starts at the same timeline pointer. `scene.do()` remains the primitive for instantaneous, replay-safe scene mutations and does not advance the pointer.

Items should be constructed and measured during scene build, then appended later. Asynchronous construction inside `scene.do()` is not supported.

An appended visual must also be unparented.

## Reset and seeking

A layout records its initial membership after construction. Scene reset restores that membership, removes runtime-appended slots, and detaches their visuals. Exact seeking then replays scheduled append actions and produces the same list contents as sequential playback.

Appending an item already present in the layout is an error. Reflow updates the container's bounds before frame verification runs.

The first version repositions slots immediately. New items may use ordinary entrance animations, but smoothly animating existing slots to new layout positions is outside the initial scope.

## Initial scope

The first version includes:

- flex rows and columns;
- fixed-column grids;
- gap, uniform padding, alignment, and optional size;
- container anchors;
- nested measurable layouts;
- `append()` and deterministic reset.

It excludes wrapping, flex growth and shrinkage, ordering, percentages, stretch, item removal, arbitrary insertion, grid spanning, CSS parsing, and animated reflow.
