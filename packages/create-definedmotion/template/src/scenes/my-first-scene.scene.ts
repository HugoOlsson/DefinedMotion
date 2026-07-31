import { AnimatedScene, defineScene, SpaceSetting } from 'definedmotion'
import { fadeIn, moveTo } from 'definedmotion/animation'
import { createText } from 'definedmotion/rendering'

export default defineScene({
  id: 'my-first-scene',
  name: 'My First Scene',
  create: () =>
    new AnimatedScene(
      1920,
      1080,
      SpaceSetting.TwoDim,
      async (scene) => {
        const title = await createText({
          text: 'My first scene',
          fontSize: 72
        })
        title.position.x = -4
        scene.add(title)

        scene.addAnims(
          fadeIn(title, { duration: 0.5 }),
          moveTo(title, { x: 4, y: 0, z: 0 }, { duration: 1, easing: 'ease-in-out' })
        )
      }
    )
})
