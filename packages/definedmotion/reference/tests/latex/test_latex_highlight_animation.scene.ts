import { defineScene } from 'definedmotion'
import * as THREE from 'three'
import { AnimatedScene, HotReloadSetting, SpaceSetting } from 'definedmotion'
import { latexToSVG } from 'definedmotion/latex'
import { createSVGShape } from 'definedmotion/latex'
import { latexHighlightAnim } from 'definedmotion/animation'



export default defineScene({
  id: 'test-latex-highlight-animation',
  name: 'LaTeX Highlight Animation',
  isTest: true,
  create: test_latex_highlight_animation
})
export function test_latex_highlight_animation(): AnimatedScene {
  return new AnimatedScene(
    1000,
    1000,
    SpaceSetting.ThreeDim,
    HotReloadSetting.TraceFromStart,
    async (dm) => {
      const latex = latexToSVG(String.raw`
\ell(\theta)
= - \sum_{i=1}^{n}
  \Big(
    \dmClass{pos}{y_i \log p_\theta(x_i)}
    +
    \dmClass{neg}{(1 - y_i) \log (1 - p_\theta(x_i))}
  \Big)
      `.trim())

      const group = createSVGShape(latex, 36)
      dm.add(group)

      // 1) Highlight positive term
      dm.addDeferredAnims(
        latexHighlightAnim(group, 'pos', {
          durationMs: 1800,
          highlightColor: 0x22c55e,
          pulses: 2,
          minMix: 0.0,
          maxMix: 1.0
        })
      )
      dm.addWait(250)

      // 2) Highlight negative term
      dm.addDeferredAnims(
        latexHighlightAnim(group, 'neg', {
          durationMs: 1800,
          highlightColor: 0xef4444,
          pulses: 2,
          minMix: 0.0,
          maxMix: 1.0
        })
      )
      dm.addWait(250)

      // 3) Highlight both together with a stronger pulse
      dm.addDeferredAnims(
        latexHighlightAnim(group, ['pos', 'neg'], {
          durationMs: 1800,
          highlightColor: 0xfacc15,
          pulses: 3,
          minMix: 0.2,
          maxMix: 1.0
        })
      )
      dm.addWait(400)
    }
  )
}
