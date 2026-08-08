# Getting started

DefinedMotion requires Node.js 24.11 or newer.

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

Use positive, even pixel dimensions for video scenes. H.264 `yuv420p` output requires both width and height to be even, and `render` reports `INVALID_VIDEO_DIMENSIONS` before rendering any frames when they are not.

Enable **Show FPS monitor** in the viewer to see presentation rate, average and 95th-percentile frame time, and how many evaluated timeline frames were not presented while the viewer caught up. The preference is stored per project and the monitor does not affect rendered output.

Next: [Scenes and timeline](scenes-and-timeline.md).
