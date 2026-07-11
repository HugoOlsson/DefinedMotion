import { defineScene } from '../../../project'
import { AnimatedScene, HotReloadSetting, SpaceSetting } from "$renderer/lib/scene/sceneClass";
import gravityTextSVG from '$assets/for_tests/svg/grip_figure.svg?raw'

export default defineScene({
  id: 'test-yellow-grip-symbol-svg',
  name: 'Yellow Grip Symbol SVG',
  isTest: true,
  create: test_yellow_grip_symbol_svg
})
import { createSVGShape } from "$renderer/lib/rendering/svg/svgRendering";


export function test_yellow_grip_symbol_svg(): AnimatedScene {
    return new AnimatedScene(1000, 1000, SpaceSetting.ThreeDim, HotReloadSetting.TraceFromStart, async (dm) => {
        const shape = createSVGShape(gravityTextSVG, 10)
        dm.add(shape)
    })
}
