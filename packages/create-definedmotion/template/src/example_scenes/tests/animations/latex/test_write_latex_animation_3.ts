import * as THREE from 'three'
import { AnimatedScene, HotReloadSetting, SpaceSetting } from '$renderer/lib/scene/sceneClass'
import { latexToSVG } from '$renderer/lib/rendering/svg/latexToSVG'
import { createSVGShape } from '$renderer/lib/rendering/svg/svgRendering'
import { setOpacity } from '$renderer/lib/animation/animations'
import { latexParticleTransitionAnim, latexWriteAnim } from '$renderer/lib/animation/latexTransitionsAndWrite'


export const test_write_latex_animation_3 = (): AnimatedScene => {
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
};