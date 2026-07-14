import { AnimatedScene, defineScene, HotReloadSetting, SpaceSetting } from 'definedmotion'
import { createAnim, easeInOutQuad } from 'definedmotion/animation'
import { createCircle } from 'definedmotion/rendering'

export default defineScene({
  id: 'my-first-scene',
  name: 'My First Scene',
  create: () =>
    new AnimatedScene(
      1920,
      1080,
      SpaceSetting.TwoDim,
      HotReloadSetting.TraceFromStart,
      (scene) => {
        const circle = createCircle(2)
        scene.add(circle)
        scene.addAnims(
          createAnim(easeInOutQuad(-5, 5, 1_000), (x) => {
            circle.position.x = x
          })
        )
      }
    )
})
