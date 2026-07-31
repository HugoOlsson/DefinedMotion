import { AnimatedScene, defineScene, SpaceSetting } from 'definedmotion'
import { moveTo } from 'definedmotion/animation'
import { createCircle } from 'definedmotion/rendering'

export default defineScene({
  id: 'playground-smoke',
  name: 'Playground Smoke Scene',
  create: () =>
    new AnimatedScene(
      1280,
      720,
      SpaceSetting.TwoDim,
      (scene) => {
        const circle = createCircle(2)
        circle.position.x = -5
        scene.add(circle)
        scene.addAnims(
          moveTo(circle, { x: 5, y: 0, z: 0 }, { duration: 1, easing: 'ease-in-out' })
        )
      }
    )
})
