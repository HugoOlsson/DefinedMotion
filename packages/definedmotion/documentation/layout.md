# Layout

`layout.flex` and `layout.grid` arrange measured text, LaTeX, and nested layouts using familiar CSS names.

```ts
import { layout } from 'definedmotion/rendering'

const column = layout.flex(
  {
    flexDirection: 'column',
    gap: 24,
    padding: 32,
    alignItems: 'flex-start',
    justifyContent: 'center',
    anchorX: 'left',
    anchorY: 'top'
  },
  [title, explanation]
)
```

Flex supports row/column direction, gap, padding, optional width/height, cross-axis `alignItems`, and main-axis `justifyContent`. Grid adds columns, row/column gaps, `alignItems`, and `justifyItems`.

Containers can own their panel surface:

```ts
const status = layout.flex(
  {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    alignItems: 'center',
    background: '#0b1220',
    border: { color: '#1e3a5f', width: 2 }
  },
  [dot, label]
)
```

The generated background and inside border always use the resolved layout box. Without an explicit width or height, that dimension fits content plus padding and updates when text, LaTeX, nested layouts, or appended items change. Rectangles and circles created by the rendering API are measurable layout children.

An explicit width or height is a strict intrinsic constraint. If the content plus padding cannot fit, resolution throws `LAYOUT_OVERFLOW` with the axis and required and available sizes. Layout does not wrap, shrink, clip, or silently allow overflow.

The layout owns an internal slot around each visual. The slot receives layout position; the visual retains its own position, rotation, scale, and Z for animation. Animation transforms do not affect intrinsic layout, so scene verification should still check animated relationships and viewport containment.

Append a prebuilt, measured, unparented item at runtime with `scene.do(() => list.append(item))`. Nested invalidation resolves inner layouts before their parents on the same frame.
