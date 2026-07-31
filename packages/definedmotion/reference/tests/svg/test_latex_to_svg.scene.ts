import { defineScene } from 'definedmotion'

export default defineScene({
  id: 'test-latex-to-svg',
  name: 'LaTeX To SVG',
  isTest: true,
  create: test_latex_to_svg
})
import { AnimatedScene, SpaceSetting } from "definedmotion";
import { createSVGShape } from "definedmotion/latex";
import { latexToSVG } from "definedmotion/latex";


export function test_latex_to_svg(): AnimatedScene {
  return new AnimatedScene(
    1000, 1000,
    SpaceSetting.ThreeDim,
    async (dm) => {
      const svg = latexToSVG(String.raw`\nabla \cdot \vec{E} = \frac{\rho}{\varepsilon_0}`);
      const g = createSVGShape(svg, 10);
      dm.add(g);
    }
  );
}
