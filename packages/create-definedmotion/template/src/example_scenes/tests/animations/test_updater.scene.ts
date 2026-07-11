import { defineScene } from '../../../project'

export default defineScene({
  id: 'test-updater-1',
  name: 'Updater1',
  isTest: true,
  create: test_updater1
})
import { easeInOutQuad } from "$renderer/lib/animation/interpolations";
import { createAnim } from "$renderer/lib/animation/protocols";
import { createRectangle } from "$renderer/lib/rendering/objects2d";
import { AnimatedScene, HotReloadSetting, SpaceSetting } from "$renderer/lib/scene/sceneClass";


// Spec: The updater should overwrite the animation, so the square should not move.

export function test_updater1(): AnimatedScene {
    return new AnimatedScene(1000, 1000, SpaceSetting.TwoDim, HotReloadSetting.TraceFromStart, async (dm) => {
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
