import { defineScene } from '../../../project'

export default defineScene({
  id: 'test-colored-latex-to-svg',
  name: 'Colored LaTeX To SVG',
  isTest: true,
  create: test_colored_latex_to_svg
})
import { AnimatedScene, HotReloadSetting, SpaceSetting } from "$renderer/lib/scene/sceneClass";
import { createSVGShape } from "$renderer/lib/rendering/svg/svgRendering";
import { latexToSVG } from "$renderer/lib/rendering/svg/latexToSVG";

export function test_colored_latex_to_svg(): AnimatedScene {
  return new AnimatedScene(1000, 1000, SpaceSetting.ThreeDim, HotReloadSetting.TraceFromStart, async (dm) => {

    // 1) Inline colors via \style{color:...}
    const eq1 = latexToSVG(String.raw`
\begin{aligned}
\style{color:#ff3b3b}{\nabla\cdot\vec{E}} &= 
\style{color:rgba(255,59,59,0.5)}{\frac{\rho}{\varepsilon_0}}

\style{color:#3b82f6}{e^{i\theta}} &= 
\style{color:#10b981}{\cos\theta} + 
\style{color:#f59e0b}{i\sin\theta}
\end{aligned}
`, { display: true });

    // 2) Mixed \textcolor and CSS rgba, plus a semi-transparent bbox
    const eq2 = latexToSVG(String.raw`
\bbox[6px, border:1px solid rgba(0,255,255,0.5), background:rgba(0,0,0,0.25)]{
  \textcolor{#22c55e}{\mathbb{E}[X]} 
  = \style{color:rgba(34,197,94,0.6)}{\int_{\mathbb{R}} x\, d\mathbb{P}(x)}
}
`, { display: true });

    // 3) A palette inside a matrix
    const eq3 = latexToSVG(String.raw`
\begin{bmatrix}
\style{color:#ef4444}{a} & \style{color:#f97316}{b} & \style{color:#eab308}{c}\\
\style{color:#22c55e}{d} & \style{color:#3b82f6}{e} & \style{color:#a855f7}{f}\\
\style{color:#ec4899}{g} & \style{color:#06b6d4}{h} & \style{color:#9ca3af}{i}
\end{bmatrix}
`, { display: true });

    // Place them using your width normalization
    const g1 = createSVGShape(eq1, 14); g1.position.set(0, 5, 0);  dm.add(g1);
    const g2 = createSVGShape(eq2, 12); g2.position.set(0, 0, 0);  dm.add(g2);
    const g3 = createSVGShape(eq3, 10); g3.position.set(0, -5, 0); dm.add(g3);
  });
}
