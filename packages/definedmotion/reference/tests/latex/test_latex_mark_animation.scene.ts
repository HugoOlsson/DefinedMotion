import { wait } from 'definedmotion/animation'
// test_latex_mark_animation.ts
import { defineScene } from 'definedmotion'
import * as THREE from 'three'
import { AnimatedScene, SpaceSetting } from 'definedmotion'
import { latexToSVG } from 'definedmotion/latex'
import { createSVGShape } from 'definedmotion/latex'
import { latexMarkAnim } from 'definedmotion/animation'



export default defineScene({
  id: 'test-latex-mark-animation',
  name: 'LaTeX Mark Animation',
  isTest: true,
  create: test_latex_mark_animation
})
export function test_latex_mark_animation(): AnimatedScene {
  return new AnimatedScene(
    1000,
    1000,
    SpaceSetting.ThreeDim,
    async (dm) => {
      const latex = latexToSVG(String.raw`
\dmClass{lhs}{\int_0^\infty e^{-x^2}\,\mathrm{d}x}
= \dmClass{rhs}{\frac{\sqrt{\pi}}{2}}
      `.trim())

      const group = createSVGShape(latex, 28)
      dm.add(group)

      // 1) Mark the left-hand side only
      dm.addDeferredAnims(
        latexMarkAnim(group, 'lhs')
      )
      dm.addAnims(wait((300) / 1000))

      // 2) Mark the right-hand side only
      dm.addDeferredAnims(
        latexMarkAnim(group, 'rhs')
      )
      dm.addAnims(wait((300) / 1000))

      // 3) Mark both sides together using the multi-class path
      dm.addDeferredAnims(
        latexMarkAnim(group, ['lhs', 'rhs'])
      )
      dm.addAnims(wait((400) / 1000))
    }
  )
}
