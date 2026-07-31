import { AnimatedScene, SpaceSetting, defineScene } from 'definedmotion'
import { wait } from 'definedmotion/animation'
import { createLatex, latex } from 'definedmotion/latex'

export default defineScene({
  id: 'latex-text-transitions',
  name: 'LaTeX Text Transitions',
  create: latexTextTransitionsScene
})

export function latexTextTransitionsScene(): AnimatedScene {
  return new AnimatedScene(1600, 1600, SpaceSetting.ThreeDim, async (scene) => {
    const equation = await createLatex({
      latex: String.raw`F = \dmClass{mass}{m}a`,
      fontSize: 4,
      color: '#f8fafc'
    })
    const mass = equation.part('mass')
    scene.add(equation)
    scene.expose('equation', equation, {
      description: 'The stable LaTeX visual throughout writing, emphasis, and morphing'
    })

    scene.addAnims(latex.write(equation, { duration: 1.2 }))
    scene.addAnims(latex.mark(mass, { duration: 0.8, color: '#facc15' }))
    scene.addAnims(
      await latex.morphTo(equation, {
        latex: String.raw`a = \frac{F}{\dmClass{mass}{m}}`,
        duration: 1.4,
        particleCount: 1200
      })
    )
    scene.addAnims(latex.highlight(mass, { duration: 0.8, color: '#38bdf8' }))
    scene.addAnims(wait(1))
  })
}
