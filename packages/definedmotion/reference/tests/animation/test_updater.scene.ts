import { defineScene } from 'definedmotion'

export default defineScene({
  id: 'test-updater-1',
  name: 'Updater1',
  isTest: true,
  create: test_updater1
})
import { easeInOutQuad } from "definedmotion/animation";
import { createAnim } from "definedmotion/animation";
import { createRectangle } from "definedmotion/rendering";
import { AnimatedScene, SpaceSetting } from "definedmotion";


// Spec: The updater should overwrite the animation, so the square should not move.

export function test_updater1(): AnimatedScene {
    return new AnimatedScene(1000, 1000, SpaceSetting.TwoDim, async (dm) => {
        const square = createRectangle(4, 4)
        dm.add(square)

        const moveAnimation = createAnim(easeInOutQuad(0,5, 500), (value) => {
            square.position.x = value
        })

        moveAnimation.updater = () => {}


        dm.addAnims(moveAnimation)
        dm.addAnims(moveAnimation.copy().reverse())
    })
}
