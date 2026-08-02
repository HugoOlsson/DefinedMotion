# LaTeX effects

Pedagogical LaTeX effects are part of the primary API:

```ts
import { createLatex, latex } from 'definedmotion/latex'

const equation = await createLatex({
  latex: String.raw`F = \dmClass{mass}{m}a`,
  fontSize: 56
})

scene.addAnims(latex.write(equation, { duration: 1.2 }))
scene.addAnims(latex.highlight(equation.part('mass'), { color: '#facc15' }))
scene.addAnims(await latex.morphTo(equation, { latex: String.raw`a = F/m` }))
```

The namespace provides `write`, `mark`, `highlight`, `morphTo`, and `particleTransition`. All return ordinary `AnimationPlan`s; `morphTo` is awaited while it prepares and measures the destination.

`mark()` draws substantial corner brackets for one long, readable pulse by default. Its default duration is `2.4` seconds. `padding` and `strokeWidth` are fractions of the LaTeX visual's authored font size. Marks therefore keep the same optical weight around a plain term, a tall fraction, or a radical, and wide selections do not acquire disproportionately large side margins. Override them only when the surrounding composition needs a different visual weight.

Part handles resolve at bind time. Missing semantic parts fail clearly. The stable LaTeX root adopts a morph destination only on the final frame. Use `particleTransition(from, to)` when two distinct visuals are intentional.
