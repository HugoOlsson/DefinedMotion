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

Part handles resolve at bind time. Missing semantic parts fail clearly. The stable LaTeX root adopts a morph destination only on the final frame. Use `particleTransition(from, to)` when two distinct visuals are intentional.
