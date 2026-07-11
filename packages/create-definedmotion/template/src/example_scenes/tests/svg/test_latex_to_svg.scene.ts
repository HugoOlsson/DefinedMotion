import { defineScene } from '../../../project'

export default defineScene({
  id: 'test-latex-to-svg',
  name: 'LaTeX To SVG',
  isTest: true,
  create: test_latex_to_svg
})
import { AnimatedScene, HotReloadSetting, SpaceSetting } from "$renderer/lib/scene/sceneClass";
import { createSVGShape } from "$renderer/lib/rendering/svg/svgRendering";
import { latexToSVG } from "$renderer/lib/rendering/svg/latexToSVG";


export function test_latex_to_svg(): AnimatedScene {
  return new AnimatedScene(
    1000, 1000,
    SpaceSetting.ThreeDim,
    HotReloadSetting.TraceFromStart,
    async (dm) => {
      const svg = latexToSVG(String.raw`\nabla \cdot \vec{E} = \frac{\rho}{\varepsilon_0}`);
      const g = createSVGShape(svg, 10);
      dm.add(g);
    }
  );
}
