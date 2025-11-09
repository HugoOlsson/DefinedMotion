import { AnimatedScene, HotReloadSetting, SpaceSetting } from "$renderer/lib/scene/sceneClass";
import gravityTextSVG from '$assets/for_tests/svg/gravity_text.svg?raw'
import { createSVGShape } from "$renderer/lib/rendering/svg/svgRendering";


export const test_basic_svg = ():AnimatedScene => {
    return new AnimatedScene(1000, 1000, SpaceSetting.ThreeDim, HotReloadSetting.TraceFromStart, async (dm) => {
        const shape = createSVGShape(gravityTextSVG, 10)
        dm.add(shape)
    })
}