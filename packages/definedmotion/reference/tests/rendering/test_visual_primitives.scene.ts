import { AnimatedScene, SpaceSetting, defineScene, type ScreenBounds } from 'definedmotion'
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
    async (scene) => {
      const title = await createText({
        text: 'Initial',
        fontSize: 3,
        color: '#38bdf8',
        opacity: 0.7,
        anchorX: 'left',
        anchorY: 'top'
      })
      const titleId = title.uuid
      await title.setText('Updated title')
      title.position.set(-22, 9, 0)
      scene.add(title)
      scene.expose('visual-text-left-top', title, {
        data: { rootStable: title.uuid === titleId, authoredOpacity: objectOpacity(title) }
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
        opacity: 0.6,
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
          partStable: mass.visual === equation && mass.id === 'mass',
          authoredOpacity: objectOpacity(equation)
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
      animatedEquation.position.set(26, 6, 0)
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
      let invalidTextOpacityRejected = false
      let invalidLatexOpacityRejected = false
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
      try {
        await createText({ text: 'Invalid opacity', fontSize: 2, opacity: 1.1 })
      } catch {
        invalidTextOpacityRejected = true
      }
      try {
        await createLatex({ latex: 'x', fontSize: 2, opacity: -0.1 })
      } catch {
        invalidLatexOpacityRejected = true
      }
      const invalidMarker = new THREE.Object3D() as THREE.Object3D & { text: string }
      invalidMarker.text =
        `font=${invalidFontRejected};latex=${invalidLatexRejected};` +
        `textOpacity=${invalidTextOpacityRejected};latexOpacity=${invalidLatexOpacityRejected}`
      scene.add(invalidMarker)
      scene.expose('visual-invalid-inputs', invalidMarker)

      scene.addAnims(latex.write(animatedEquation, { duration: 2 / scene.fps }))
      scene.addAnims(latex.mark(animatedMass, { duration: 2 / scene.fps }))
      scene.addAnims(morph)
      scene.addAnims(latex.highlight(animatedMass, { duration: 2 / scene.fps }))
      const transitionTarget = await createLatex({
        latex: String.raw`E = mc^2`,
        fontSize: 3,
        color: '#f97316'
      })
      transitionTarget.position.copy(animatedEquation.position)
      scene.expose('visual-latex-particle-target', transitionTarget)
      scene.do(() => scene.add(transitionTarget))
      scene.addAnims(
        latex.particleTransition(animatedEquation, transitionTarget, {
          duration: 2 / scene.fps,
          particleCount: 120
        })
      )
      scene.do(() => {
        effectsMarker.text = `cleanup=${animatedEquation.getObjectByName('DefinedMotionLatexMorphParticles') === undefined}`
      })
      scene.addAnims(wait(1 / scene.fps))
      const end = scene.getTimelinePointer()

      scene.verify(
        'visual-primitives-separated',
        { frames: { start: 0, end } },
        (context) => {
          const effectBounds = unionBounds([
            context.screenBounds(animatedEquation),
            ...(transitionTarget.parent ? [context.screenBounds(transitionTarget)] : [])
          ])
          const zones = [
            context.screenBounds(title),
            context.screenBounds(wrapped),
            context.screenBounds(equation),
            context.screenBounds(centeredEquation),
            effectBounds
          ]
          const separated = zones.every((bounds, index) => {
            if (bounds === null) return false
            return zones.slice(index + 1).every((other) => {
              if (other === null) return false
              return (
                bounds.right + 4 <= other.left ||
                other.right + 4 <= bounds.left ||
                bounds.bottom + 4 <= other.top ||
                other.bottom + 4 <= bounds.top
              )
            })
          })
          context.assert(separated, 'Text and LaTeX demonstrations must not overlap', { zones })
        }
      )
    }
  )
}

const objectOpacity = (object: THREE.Object3D): number => {
  let opacity: number | undefined
  object.traverse((child) => {
    if (opacity !== undefined) return
    const material = (child as THREE.Object3D & {
      material?: THREE.Material | THREE.Material[]
    }).material
    const first = Array.isArray(material) ? material[0] : material
    if (first) opacity = first.opacity
  })
  if (opacity === undefined) throw new Error('Expected visual to contain a material')
  return opacity
}

const unionBounds = (bounds: Array<ScreenBounds | null>): ScreenBounds | null => {
  const present = bounds.filter((value): value is ScreenBounds => value !== null)
  if (present.length === 0) return null
  const left = Math.min(...present.map((value) => value.left))
  const right = Math.max(...present.map((value) => value.right))
  const top = Math.min(...present.map((value) => value.top))
  const bottom = Math.max(...present.map((value) => value.bottom))
  return { left, right, top, bottom, width: right - left, height: bottom - top }
}
