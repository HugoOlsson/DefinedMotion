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

The layout owns an internal slot around each visual. The slot receives layout position; the visual retains its own position, rotation, scale, and Z for animation. Layout bounds describe the declared layout box, while world/screen measurement includes visible overflow.

Append a prebuilt, measured, unparented item at runtime with `scene.do(() => list.append(item))`. Nested invalidation resolves inner layouts before their parents on the same frame.
