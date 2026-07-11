import { defineScene } from '../../../project'
import { AnimatedScene, HotReloadSetting, SpaceSetting } from "$renderer/lib/scene/sceneClass";

export default defineScene({
  id: 'test-basic-svg',
  name: 'Basic SVG',
  isTest: true,
  create: test_basic_svg
})
import { createSVGShape } from "$renderer/lib/rendering/svg/svgRendering";


export function test_basic_svg(): AnimatedScene {
    return new AnimatedScene(1000, 1000, SpaceSetting.ThreeDim, HotReloadSetting.TraceFromStart, async (dm) => {
        const gravityTextSVG = await dm.asset('for_tests/svg/gravity_text.svg').text()
        const shape = createSVGShape(gravityTextSVG, 10)
        dm.add(shape)
        dm.addWait(1)
    })
}
