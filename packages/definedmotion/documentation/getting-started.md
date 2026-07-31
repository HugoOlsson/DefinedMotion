# Getting started

Create a project with `npx create-definedmotion my-video`, install dependencies, and run `npm run dev`.

Put default-exported `*.scene.ts` files under `src/scenes`:

```ts
import { AnimatedScene, SpaceSetting, defineScene } from 'definedmotion'
import { fadeIn } from 'definedmotion/animation'
import { createText } from 'definedmotion/rendering'

const create = () =>
  new AnimatedScene(1920, 1080, SpaceSetting.TwoDim, async (scene) => {
    const title = await createText({ text: 'Cold spots', fontSize: 72 })
    scene.add(title)
    scene.addAnims(fadeIn(title, { duration: 0.6 }))
  })

export default defineScene({ id: 'cold-spots', name: 'Cold Spots', create })
```

Set `defaultScene: 'cold-spots'` in `definedmotion.config.ts`. The viewer can switch to any other project scene without editing the config.

Next: [Scenes and timeline](scenes-and-timeline.md).
