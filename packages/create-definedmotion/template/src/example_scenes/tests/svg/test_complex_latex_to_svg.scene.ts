import { defineScene } from '../../../project'

export default defineScene({
  id: 'test-complex-latex-to-svg',
  name: 'Complex LaTeX To SVG',
  isTest: true,
  create: test_complex_latex_to_svg
})
import { AnimatedScene, HotReloadSetting, SpaceSetting } from "$renderer/lib/scene/sceneClass";
import { createSVGShape } from "$renderer/lib/rendering/svg/svgRendering";
import { latexToSVG } from "$renderer/lib/rendering/svg/latexToSVG";


export function test_complex_latex_to_svg(): AnimatedScene {
  return new AnimatedScene(1000, 1000, SpaceSetting.ThreeDim, HotReloadSetting.TraceFromStart, async (dm) => {
    const raw = latexToSVG(String.raw`
\begin{aligned}
\hat{f}(\omega) &= \int_{-\infty}^{\infty} f(t)\,e^{-i\omega t}\,dt,\\
f(t) &= \frac{1}{2\pi}\int_{-\infty}^{\infty} \hat{f}(\omega)\,e^{i\omega t}\,d\omega,\\[6pt]
\Gamma(z) &= \int_{0}^{\infty} t^{z-1} e^{-t}\,dt,\qquad
\zeta(s) = \prod_{p\in\mathbb{P}} \frac{1}{1-p^{-s}}
\end{aligned}
`, { display: true });

console.log("RAW", raw)

    const g = createSVGShape(raw, 12);
    dm.add(g);
  });
}
