import { defineScene } from 'definedmotion'
import { AnimatedScene, HotReloadSetting, SpaceSetting } from "definedmotion";

export default defineScene({
  id: 'test-yellow-grip-symbol-svg',
  name: 'Yellow Grip Symbol SVG',
  isTest: true,
  create: test_yellow_grip_symbol_svg
})
import { createSVGShape } from "definedmotion/latex";


export function test_yellow_grip_symbol_svg(): AnimatedScene {
    return new AnimatedScene(1000, 1000, SpaceSetting.ThreeDim, HotReloadSetting.TraceFromStart, async (dm) => {
        const gravityTextSVG = await dm.asset('svg/grip_figure.svg').text()
        const shape = createSVGShape(gravityTextSVG, 10)
        dm.add(shape)
        dm.addWait(1)
    })
}
