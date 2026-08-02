# Text and LaTeX

Text and LaTeX are asynchronous, measured visuals with stable root objects.

```ts
import { createText } from 'definedmotion/rendering'
import { createLatex } from 'definedmotion/latex'

const title = await createText({
  text: 'Absorbed power',
  fontSize: 64,
  opacity: 0.8,
  anchorX: 'left',
  anchorY: 'top',
  textAlign: 'left',
  maxWidth: 700,
  outlineColor: '#050708',
  outlineWidth: 2
})
const equation = await createLatex({
  latex: String.raw`P = \dmClass{power}{mc^2}`,
  fontSize: 60,
  opacity: 0.7,
  anchorX: 'center',
  anchorY: 'middle'
})
```

`anchorX` is `left | center | right`; `anchorY` is `top | middle | bottom`. The anchor is the predictable transform and scaling origin. `textAlign` controls lines inside a text block and is separate from the block anchor.

`outlineColor` and `outlineWidth` add a measured glyph outline. This is useful for world-space labels that must remain readable over changing 3D geometry.

`opacity` is an authored value from `0` to `1` and defaults to `1`. Text and LaTeX animation effects capture it as the visual's full-opacity endpoint, so `fadeIn()` and `latex.write()` restore the authored value rather than forcing the material to `1`.

`getLocalBounds()` returns measured anchored bounds. `await visual.setText()` and `await visual.setLatex()` preserve the root object and update those bounds.

Use `equation.part('power')` with `\dmClass{power}{...}` for a stable semantic handle. It resolves the current internal SVG content when an effect binds, so it remains useful after a morph.

Related: [LaTeX effects](latex-effects.md) and [Layout](layout.md).
