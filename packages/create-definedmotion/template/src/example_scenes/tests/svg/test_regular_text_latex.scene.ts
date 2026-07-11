import { defineScene } from '../../../project'

export default defineScene({
  id: 'test-regular-text-latex',
  name: 'Regular Text LaTeX',
  isTest: true,
  create: test_regular_text_latex
})
import { AnimatedScene, HotReloadSetting, SpaceSetting } from "$renderer/lib/scene/sceneClass";
import { createSVGShape } from "$renderer/lib/rendering/svg/svgRendering";
import { latexToSVG } from "$renderer/lib/rendering/svg/latexToSVG";


export function test_regular_text_latex(): AnimatedScene {
  return new AnimatedScene(
    1000, 1000,
    SpaceSetting.ThreeDim,
    HotReloadSetting.TraceFromStart,
    async (dm) => {
      const svg = latexToSVG(String.raw`\text{This library is "DefinedMotion"}`);
      const g = createSVGShape(svg, 20);
      g.position.y += 2
      const svg2 = latexToSVG(String.raw`\text{\textsf{This library is "DefinedMotion"}}`);
      const g2 = createSVGShape(svg2, 20);
      g2.position.y -= 2
      dm.add(g, g2);
    }
  );
}
