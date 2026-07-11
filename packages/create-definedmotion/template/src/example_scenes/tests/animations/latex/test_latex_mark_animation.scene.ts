// test_latex_mark_animation.ts
import { defineScene } from '../../../../project'
import * as THREE from 'three'
import { AnimatedScene, HotReloadSetting, SpaceSetting } from '$renderer/lib/scene/sceneClass'
import { latexToSVG } from '$renderer/lib/rendering/svg/latexToSVG'
import { createSVGShape } from '$renderer/lib/rendering/svg/svgRendering'
import { latexMarkAnim } from '$renderer/lib/animation/latexMarkAndHighlight'



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
    HotReloadSetting.TraceFromStart,
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
      dm.addWait(300)

      // 2) Mark the right-hand side only
      dm.addDeferredAnims(
        latexMarkAnim(group, 'rhs')
      )
      dm.addWait(300)

      // 3) Mark both sides together using the multi-class path
      dm.addDeferredAnims(
        latexMarkAnim(group, ['lhs', 'rhs'])
      )
      dm.addWait(400)
    }
  )
}
