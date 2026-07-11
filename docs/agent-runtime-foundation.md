# Agent runtime foundation

DefinedMotion's automation interface is built around one rule: Studio and CLI
must be clients of the same scene registry, timeline runtime, and Three.js
renderer. Automation must not reimplement scene execution.

## Runtime boundaries

- `src/definedmotion.config.ts` owns the fixed timeline FPS, render sampling,
  and deterministic seed. Timeline FPS never depends on monitor refresh rate.
- Bundled `src/example_scenes/**/*.scene.ts` modules and user-authored
  `src/scenes/**/*.scene.ts` modules describe themselves through `defineScene()`.
  Vite discovers both automatically, while `src/entry.ts` remains a small
  framework bootstrap with backwards-compatible exports.
- `AnimatedScene.seekExact(frame)` rebuilds from initial state, resets seeded
  randomness, traces every preceding tick, validates the requested frame, and
  renders at logical output resolution.
- The Electron main process supports a hidden automation mode. Requests and
  results use typed IPC, PNG files are written by the main process, and the
  process exits after one command.
- `AnimatedScene.asset()` creates validated lazy references below `src/assets`.
  A standard Electron protocol streams selected assets in Studio and automation,
  including MIME types and byte ranges, while packaged projects copy the same
  asset tree to their resources directory.
- `scripts/definedmotion.mjs` builds current source and invokes that hidden
  renderer. JSON mode reserves stdout for the final machine-readable result.

## Initial commands

```bash
npm run dm -- scenes

npm run dm -- scenes --json

npm run dm -- scenes --exclude-tests

npm run dm -- still tutorial-easy-1 \
  --frame 30 \
  --output .definedmotion/frame-30.png \
  --json
```

The default still path is
`.definedmotion/stills/<scene>-frame-<frame>.png`. Generated automation output
is ignored by Git.

`--no-build` may be used while repeatedly invoking an unchanged compiled
project. It is unsafe after editing source because the command will use the
previous build.

## Adding a scene

Create a default-exported `*.scene.ts` module anywhere under `src/scenes`:

```ts
import { defineScene } from '../project'
import { myScene } from './myScene'

export default defineScene({
  id: 'my-scene',
  name: 'My Scene',
  create: myScene
})
```

No central registry edit is required. Discovery fails with an actionable error
when a module has an invalid default export or two modules use the same ID.
Choose the initial Studio scene through `defaultScene` in
`src/definedmotion.config.ts`.

Scene modules are currently imported eagerly, but their project media is not.
Create references and load assets inside the scene build path rather than at
module scope. A production build no longer emits scene audio, HDRIs, models, or
fonts into the renderer bundle merely because their scenes are discoverable.

```ts
const video = scene.asset('videos/demo.mp4')
const model = scene.asset('models/car.glb')
const data = await scene.asset('data/measurements.json').json<number[]>()
```

References expose browser-safe URLs and explicit text, binary, blob, and JSON
reads. DefinedMotion's audio, GLB, and HDRI helpers accept them directly. Invalid
paths, missing files, and loader failures use stable asset error codes.

Visual tests use the same scene abstraction and are included in discovery:

```ts
export default defineScene({
  id: 'test-camera-waypoints-sequential',
  name: 'Camera Waypoints Sequential',
  isTest: true,
  create: test_camera_waypoints_sequential
})
```

`scenes` returns the complete inventory by default. Pass `--exclude-tests` to
omit definitions marked with `isTest: true`.

## Result contract

A successful still includes scene ID, exact frame and time, duration, FPS,
seed, logical resolution, absolute output path, and render time. Failures use a
non-zero exit status and a JSON object with a stable error shape.

## Next layers

The foundation intentionally precedes AI-specific protocols. Planned clients
and capabilities can build on the same runtime:

1. Multi-frame sessions and contact sheets that reuse one renderer and selected assets.
2. Semantic inspectable-object registration and response-budgeted snapshots.
3. Validation, debug overlays, and object-ID renders.
4. Extracted versioned runtime/CLI packages for upgrading generated projects.
5. An agent skill and, if useful, a thin MCP wrapper.
