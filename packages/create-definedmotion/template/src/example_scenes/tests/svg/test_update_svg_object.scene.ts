import { defineScene } from '../../../project'
import { AnimatedScene, HotReloadSetting, SpaceSetting } from "$renderer/lib/scene/sceneClass";

export default defineScene({
  id: 'test-update-svg-object',
  name: 'Update SVG Object',
  isTest: true,
  create: test_update_svg_object
})
import { createSVGShape } from "$renderer/lib/rendering/svg/svgRendering";
import { updateSVGShape } from "$renderer/lib/rendering/svg/svgObjectHelpers";


export function test_update_svg_object(): AnimatedScene {
    return new AnimatedScene(1000, 1000, SpaceSetting.ThreeDim, HotReloadSetting.TraceFromStart, async (dm) => {
        const gravityTextSVG = await dm.asset('for_tests/svg/gravity_text.svg').text()
        const gripSVG = await dm.asset('for_tests/svg/grip_figure.svg').text()
        const svgObject = createSVGShape(gravityTextSVG, 10)
        dm.add(svgObject)

        dm.addWait(500)
        dm.do(() => {
            updateSVGShape(svgObject, gripSVG)
        })
        dm.addWait(500)
    })
}
