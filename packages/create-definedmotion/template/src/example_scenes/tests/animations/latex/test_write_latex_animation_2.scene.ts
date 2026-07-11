import { defineScene } from '../../../../project'
import * as THREE from 'three'
import { AnimatedScene, HotReloadSetting, SpaceSetting } from '$renderer/lib/scene/sceneClass'
import { latexToSVG } from '$renderer/lib/rendering/svg/latexToSVG'
import { createSVGShape } from '$renderer/lib/rendering/svg/svgRendering'
import { setOpacity } from '$renderer/lib/animation/animations'
import { latexParticleTransitionAnim, latexWriteAnim } from '$renderer/lib/animation/latexTransitionsAndWrite'


export default defineScene({
  id: 'test-write-latex-animation-2',
  name: 'Write LaTeX Animation 2',
  isTest: true,
  create: test_write_latex_animation_2
})
// ---------------------------------------------------------------------------
// test_write_latex_animation_2
//   Single-line, moderately complex: Gaussian + decaying integral
// ---------------------------------------------------------------------------

export function test_write_latex_animation_2(): AnimatedScene {
  return new AnimatedScene(
    1000,
    1000,
    SpaceSetting.ThreeDim,
    HotReloadSetting.TraceFromStart,
    async (dm) => {
      const latex = latexToSVG(String.raw`
\phi(x) = \frac{1}{\sqrt{2\pi\sigma^2}} \exp\!\left(-\frac{(x-\mu)^2}{2\sigma^2}\right) \cdot \int_{0}^{T} \frac{e^{-t/\tau}}{\tau}\,\mathrm{d}t
      `.trim());

      const group = createSVGShape(latex, 32);
      dm.add(group);

      dm.addDeferredAnims(
        latexWriteAnim(group)
      );

      dm.addWait(300);
    }
  );
}
