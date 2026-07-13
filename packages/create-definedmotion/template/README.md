# DefinedMotion project

Run the interactive Studio:

```bash
npm run dev
```

User scenes belong in `src/scenes/**/*.scene.ts`. Choose the initial Studio scene through `defaultScene` in `src/definedmotion.config.ts`.

## Coding agents

Start with [`AGENTS.md`](AGENTS.md). The full [`agent interface guide`](docs/agent-workflow.md) presents every feedback tool, what it returns, and why it exists.

```bash
npm run dm -- session start --json
npm run dm -- scenes --json
```

Run `npm run dm -- --help` for the command summary.

## Video planes

Video timing uses the same animation model as every other component:

```ts
import { createVideoPlane } from '$renderer/lib/rendering/video'

const recording = createVideoPlane(scene, scene.asset('video/recording.mp4'), {
  id: 'app-recording',
  width: 9,
  height: 16,
  fit: 'contain'
})

scene.add(recording)
scene.addWait(1_000)
scene.addAnims(
  recording.play(5_000, {
    sourceStartMs: 500,
    playbackRate: 1,
    loop: false
  })
)
```

The stable `id` keeps the decoder and texture alive when exact seeks rebuild the Three.js graph. Interactive playback uses the browser decoder for speed, while scrubbing, stills, grids, and final rendering wait for the exact requested video frame. Video is muted.
