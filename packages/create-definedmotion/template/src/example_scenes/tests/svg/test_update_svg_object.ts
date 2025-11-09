import { AnimatedScene, HotReloadSetting, SpaceSetting } from "$renderer/lib/scene/sceneClass";
import gravityTextSVG from '$assets/for_tests/svg/gravity_text.svg?raw'
import gripSVG from '$assets/for_tests/svg/grip_figure.svg?raw'
import { createSVGShape } from "$renderer/lib/rendering/svg/svgRendering";
import { updateSVGShape } from "$renderer/lib/rendering/svg/svgObjectHelpers";


export const test_update_svg_object = ():AnimatedScene => {
    return new AnimatedScene(1000, 1000, SpaceSetting.ThreeDim, HotReloadSetting.TraceFromStart, async (dm) => {
        const svgObject = createSVGShape(gravityTextSVG, 10)
        dm.add(svgObject)

        dm.addWait(500)
        dm.do(() => {
            updateSVGShape(svgObject, gripSVG)
        })
        dm.addWait(500)
    })
}