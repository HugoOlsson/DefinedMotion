import { AnimatedScene, HotReloadSetting, SpaceSetting, defineScene } from 'definedmotion'
import { wait } from 'definedmotion/animation'
import { createLatex, latex } from 'definedmotion/latex'
import { createText } from 'definedmotion/rendering'
import * as THREE from 'three'

export default defineScene({
  id: 'test-visual-primitives',
  name: 'Text and LaTeX Primitive Contract',
  isTest: true,
  create: testVisualPrimitives
})

export function testVisualPrimitives(): AnimatedScene {
  return new AnimatedScene(
    800,
    400,
    SpaceSetting.TwoDim,
    HotReloadSetting.TraceFromStart,
    async (scene) => {
      const title = await createText({
        text: 'Initial',
        fontSize: 3,
        color: '#38bdf8',
        anchorX: 'left',
        anchorY: 'top'
      })
      const titleId = title.uuid
      await title.setText('Updated title')
      title.position.set(-22, 9, 0)
      scene.add(title)
      scene.expose('visual-text-left-top', title, {
        data: { rootStable: title.uuid === titleId }
      })

      const wrapped = await createText({
        text: 'A predictable multiline text primitive for layout',
        fontSize: 2,
        color: '#a78bfa',
        maxWidth: 18,
        lineHeight: 1.2
      })
      wrapped.position.set(-12, -6, 0)
      scene.add(wrapped)
      scene.expose('visual-text-centered', wrapped)

      const equation = await createLatex({
        latex: String.raw`F = \dmClass{mass}{m}a`,
        fontSize: 4,
        color: '#f8fafc',
        anchorX: 'left',
        anchorY: 'top'
      })
      const equationId = equation.uuid
      const mass = equation.part('mass')
      await equation.setLatex(String.raw`a = \frac{F}{\dmClass{mass}{m}}`)
      equation.position.set(3, 9, 0)
      scene.add(equation)
      scene.expose('visual-latex-left-top', equation, {
        data: {
          rootStable: equation.uuid === equationId,
          partStable: mass.visual === equation && mass.id === 'mass'
        }
      })

      const centeredEquation = await createLatex({
        latex: String.raw`P = \frac{E}{t}`,
        fontSize: 4,
        color: '#4ade80'
      })
      centeredEquation.position.set(13, -6, 0)
      scene.add(centeredEquation)
      scene.expose('visual-latex-centered', centeredEquation)

      const animatedEquation = await createLatex({
        latex: String.raw`F = \dmClass{mass}{m}a`,
        fontSize: 3,
        color: '#f97316'
      })
      const animatedEquationId = animatedEquation.uuid
      const animatedMass = animatedEquation.part('mass')
      const morph = await latex.morphTo(animatedEquation, {
        latex: String.raw`a = \frac{F}{\dmClass{mass}{m}}`,
        duration: 3 / scene.fps,
        particleCount: 120
      })
      animatedEquation.position.set(15, 5, 0)
      scene.add(animatedEquation)
      scene.expose('visual-latex-effects', animatedEquation, {
        data: { rootStable: animatedEquation.uuid === animatedEquationId }
      })
      const effectsMarker = new THREE.Object3D() as THREE.Object3D & { text: string }
      effectsMarker.text = 'cleanup=false'
      scene.add(effectsMarker)
      scene.expose('visual-latex-effects-cleanup', effectsMarker)

      let invalidFontRejected = false
      let invalidLatexRejected = false
      try {
        await createText({
          text: 'Missing font',
          fontSize: 2,
          font: scene.asset('missing-font.woff')
        })
      } catch {
        invalidFontRejected = true
      }
      try {
        await createLatex({
          latex: String.raw`\definitelyUnknownCommand{x}`,
          fontSize: 2
        })
      } catch {
        invalidLatexRejected = true
      }
      const invalidMarker = new THREE.Object3D() as THREE.Object3D & { text: string }
      invalidMarker.text = `font=${invalidFontRejected};latex=${invalidLatexRejected}`
      scene.add(invalidMarker)
      scene.expose('visual-invalid-inputs', invalidMarker)

      scene.addAnims(latex.write(animatedEquation, { duration: 2 / scene.fps }))
      scene.addAnims(latex.mark(animatedMass, { duration: 2 / scene.fps }))
      scene.addAnims(morph)
      scene.addAnims(latex.highlight(animatedMass, { duration: 2 / scene.fps }))
      scene.do(() => {
        effectsMarker.text = `cleanup=${animatedEquation.getObjectByName('DefinedMotionLatexMorphParticles') === undefined}`
      })
      scene.addAnims(wait(1 / scene.fps))
    }
  )
}
