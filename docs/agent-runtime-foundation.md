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
- The Electron main process supports both one-shot hidden automation and a
  project-local persistent runtime. Requests and results use typed IPC, and PNG
  files are written by the main process.
- `AnimatedScene.asset()` creates validated lazy references below `src/assets`.
  A standard Electron protocol streams selected assets in Studio and automation,
  including MIME types and byte ranges, while packaged projects copy the same
  asset tree to their resources directory.
- `scripts/definedmotion.mjs` uses a compatible project runtime automatically,
  or builds and invokes an isolated hidden renderer as a fallback. JSON mode
  reserves stdout for the final machine-readable result.

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

## Persistent sessions

Start a project-local renderer when an agent, script, or developer will issue
multiple commands:

```bash
npm run dm -- session start
npm run dm -- session status --json

npm run dm -- scenes --json
npm run dm -- still tutorial-easy-1 --frame 30 --json
npm run dm -- still tutorial-easy-1 --frame 60 --json

npm run dm -- session stop
```

`scenes` and `still` prefer the session when it exists. `--standalone` forces a
one-shot renderer, while `--require-session` fails instead of falling back. Use
`session start --foreground` when the caller should own and observe the runtime
process directly, such as in CI or an agent-controlled terminal.

The persistent boundary is deliberately the renderer environment, not a scene
instance. Electron, Vite, WebGL initialization, loaded fonts, and browser caches
remain warm. Every command creates a clean scene and disposes the previous
scene, renderer, canvas, and WebGL context.

### Freshness contract

The CLI computes a content hash over the project's complete `src` tree for each
request. The running Vite server watches that tree—including newly added and
removed scene or asset files—and performs a full renderer reload after a
change. The new renderer reports its injected source revision before the host
will execute work.

Each session result identifies `runtimeId`, `generation`, and `sourceRevision`.
The runtime ID remains stable for the process. A generation identifies a clean
renderer load. The source revision proves which source tree produced the
result. If source changes during a request, the request is rejected and retried
against the new revision; compilation failure times out with an error instead
of returning output from an older generation.

Changes outside `src`, such as dependency or build-configuration changes,
require restarting the session. Runtime discovery metadata is stored with mode
`0600` in `.definedmotion/runtime.json`; the authenticated local socket is also
user-only and is removed when the runtime stops.

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
non-zero exit status and a JSON object with a stable error shape. Results served
by a persistent session also include the runtime identity, renderer generation,
and exact source revision.

## Next layers

The foundation intentionally precedes AI-specific protocols. Planned clients
and capabilities can build on the same runtime:

1. Multi-frame requests and contact sheets that reuse the persistent renderer.
2. Semantic inspectable-object registration and response-budgeted snapshots.
3. Validation, debug overlays, and object-ID renders.
4. Extracted versioned runtime/CLI packages for upgrading generated projects.
5. An agent skill and, if useful, a thin MCP wrapper.
