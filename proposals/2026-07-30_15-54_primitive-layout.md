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
  alignItems?: "flex-start" | "center" | "flex-end" | "baseline"
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

Without an explicit width or height, the container fits its content and padding. `justifyContent` only has visible extra space to distribute when the main-axis size is explicit.

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

Columns use the widest intrinsic item in that column. Rows use the tallest intrinsic item in that row.

## Layout space

Layout operates in the container's local XY plane using local units. It changes X and Y slot positions and preserves child Z values. The completed group can be transformed, added to the scene, or attached to a camera like any other Three.js group.

Children must implement the shared `MeasurableVisual` contract. Flex and grid containers implement the same contract, allowing layouts to be nested.

## Slots and animation

Each item is placed inside an internal slot:

```text
LayoutGroup
  └── slot positioned by layout
        └── visual transformed by animations
```

Layout owns the slot transform. Animations own the visual's transform inside the slot. Animated position, rotation, or scale therefore does not trigger reflow or overwrite the layout position. This follows CSS behavior where transforms do not affect layout.

Layout measures each visual's intrinsic local bounds. A successful text or LaTeX content update invalidates its containing layout, which reflows before the next completed frame.

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

`append()` creates a slot and synchronously reflows the container. The following animation starts at the same timeline pointer. `scene.do()` remains the primitive for instantaneous, replay-safe scene mutations and does not advance the pointer.

Items should be constructed and measured during scene build, then appended later. Asynchronous construction inside `scene.do()` is not supported.

## Reset and seeking

A layout records its initial membership after construction. Scene reset restores that membership and removes runtime-appended slots. Exact seeking then replays scheduled append actions and produces the same list contents as sequential playback.

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
