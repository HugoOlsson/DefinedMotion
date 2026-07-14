import { defineScene } from 'definedmotion'
import * as THREE from 'three'
import { AnimatedScene, HotReloadSetting, SpaceSetting } from 'definedmotion'
import { latexToSVG } from 'definedmotion/latex'
import { createSVGShape } from 'definedmotion/latex'
import { setOpacity } from 'definedmotion/animation'
import { latexParticleTransitionAnim, latexWriteAnim } from 'definedmotion/animation'



export default defineScene({
  id: 'test-write-latex-animation-3',
  name: 'Write LaTeX Animation 3',
  isTest: true,
  create: test_write_latex_animation_3
})
export function test_write_latex_animation_3(): AnimatedScene {
  return new AnimatedScene(
    1000,
    1000,
    SpaceSetting.ThreeDim,
    HotReloadSetting.TraceFromStart,
    async (dm) => {
      const latex = latexToSVG(String.raw`
Z(\beta) = \int_{\mathbb{R}^d} \exp\!\bigl(-\beta\,E(x)\bigr)\,\mathrm{d}x \quad\text{and}\quad p_\beta(x) = \frac{1}{Z(\beta)}\,\exp\!\bigl(-\beta\,E(x)\bigr)
      `.trim());

      const group = createSVGShape(latex, 30);
      dm.add(group);

      dm.addDeferredAnims(
        latexWriteAnim(group, {
          durationMs: 2000,
          direction: 'ltr',
          penWidth: 0.22,
        })
      );

      dm.addWait(400);
    }
  );
}
