import { wait } from 'definedmotion/animation'
import { defineScene } from 'definedmotion'
import { AnimatedScene, SpaceSetting } from "definedmotion";

export default defineScene({
  id: 'test-basic-svg',
  name: 'Basic SVG',
  isTest: true,
  create: test_basic_svg
})
import { createSVGShape } from "definedmotion/latex";


export function test_basic_svg(): AnimatedScene {
    return new AnimatedScene(1000, 1000, SpaceSetting.ThreeDim, async (dm) => {
        const gravityTextSVG = await dm.asset('svg/gravity_text.svg').text()
        const shape = createSVGShape(gravityTextSVG, 10)
        dm.add(shape)
        dm.addAnims(wait(1 / dm.fps))
    })
}
