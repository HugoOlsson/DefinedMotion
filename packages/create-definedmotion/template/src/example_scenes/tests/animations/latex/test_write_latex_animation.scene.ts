
import { defineScene } from '../../../../project'
import * as THREE from 'three'
import { AnimatedScene, HotReloadSetting, SpaceSetting } from '$renderer/lib/scene/sceneClass'
import { latexToSVG } from '$renderer/lib/rendering/svg/latexToSVG'
import { createSVGShape } from '$renderer/lib/rendering/svg/svgRendering'
import { setOpacity } from '$renderer/lib/animation/animations'

export default defineScene({
  id: 'test-write-latex-animation',
  name: 'Write LaTeX Animation',
  isTest: true,
  create: test_write_latex_animation
})
import { latexParticleTransitionAnim, latexWriteAnim } from '$renderer/lib/animation/latexTransitionsAndWrite' // <- your new helper

export function test_write_latex_animation(): AnimatedScene {
  return new AnimatedScene(
    1000,
    1000,
    SpaceSetting.ThreeDim,
    HotReloadSetting.TraceFromStart,
    async (dm) => {
     // After you’ve built two LaTeX groups
    const latex = latexToSVG(String.raw`\int_0^\infty e^{-x^2}\,dx = \frac{\sqrt{\pi}}{2}`);
    const group = createSVGShape(latex, 20);
    dm.add(group);

    dm.addDeferredAnims(
    latexWriteAnim(group)
    );
      // Optionally: leave a bit of time after the morph finishes
      dm.addWait(300)
    }
  )
}
