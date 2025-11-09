import { AnimatedScene, HotReloadSetting, SpaceSetting } from "$renderer/lib/scene/sceneClass";
import { createSVGShape } from "$renderer/lib/rendering/svg/svgRendering";
import { latexToSVG } from "$renderer/lib/rendering/svg/latexToSVG";


export const test_latex_to_svg = (): AnimatedScene => {
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
};