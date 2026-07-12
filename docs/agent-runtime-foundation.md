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
- `AnimatedScene.expose()` gives selected Three.js objects stable semantic IDs.
  The scene-owned registry is rebuilt with the scene and performs no geometry
  work until an inspection request.
- `AnimatedScene.exposeCamera()` gives authored debug viewpoints stable IDs.
  Inspection cameras follow the same scene lifecycle and incur no extra render
  work until explicitly requested.
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

npm run dm -- timeline-grid tutorial-easy-1 \
  --columns 3 \
  --output .definedmotion/tutorial-timeline.png \
  --json

npm run dm -- inspect tutorial-easy-1 --frame 30 --json

npm run dm -- cameras vector-field --frame 600 --json

npm run dm -- camera-grid vector-field \
  --frame 600 \
  --output .definedmotion/vector-field-cameras.png \
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
npm run dm -- still tutorial-easy-1 --frame 59 --json
npm run dm -- timeline-grid tutorial-easy-1 --json
npm run dm -- inspect tutorial-easy-1 --frame 30 --json

npm run dm -- session stop
```

All render and inspection commands prefer the session when it exists.
`--standalone` forces a one-shot renderer, while `--require-session` fails
instead of falling back. Use `session start --foreground` when the caller should
own and observe the runtime process directly, such as in CI or an
agent-controlled terminal.

The persistent boundary is deliberately the renderer environment, not a scene
instance. Electron, Vite, WebGL initialization, loaded fonts, and browser caches
remain warm. Every command creates a clean scene and disposes the previous
scene, renderer, canvas, and WebGL context.

`timeline-grid` seeks deterministically to each requested frame and composes a
single labeled PNG inside the renderer without creating temporary still files.
With no selection flags it samples nine evenly distributed frames, including
the first and last valid frame. `--count` changes the sample count and `--frames`
selects exact frames; the two flags cannot be combined. The result reports grid
dimensions and structured cell metadata, including each frame's exact time and
pixel bounds. Requests accept at most 100 frames, and output dimensions are
bounded to prevent accidental memory exhaustion.

### Semantic inspection

Only a stable ID is required to expose an object:

```ts
const title = scene.expose('main-title', createMeshText('DefinedMotion'))
scene.add(title)
```

Optional metadata is deliberately small and JSON-compatible:

```ts
scene.expose('temperature-curve', curve, {
  description: 'Temperature measurements from the imported dataset',
  tags: ['data-series'],
  data: { unit: 'celsius' }
})
```

`inspect <scene> --frame <number>` seeks through the same deterministic runtime
as still rendering and returns scene duration, camera projection, local and
world transforms, world bounds, screen bounds, attachment, inherited
visibility, and in-frame state. Text-bearing objects also report their current
text content. Frame zero is the default.

The registry belongs to one `AnimatedScene`. It is cleared before every rebuild
and on destruction, so newly-created objects replace previous-generation
references instead of accumulating. Duplicate IDs or duplicate object
registrations fail during the build. Metadata is copied and limited to strings,
finite numbers, booleans, null, tags, and an optional description. Inspection
serializes at most 500 objects and reports when a response is truncated.

### Inspection cameras

Register an inspection viewpoint inside the scene build callback:

```ts
const overview = scene.exposeCamera(
  'overview',
  new THREE.PerspectiveCamera(50, scene.width / scene.height, 0.1, 1000),
  {
    description: 'Shows the complete simulation and its boundaries',
    tags: ['overview']
  }
)
overview.position.set(20, 15, 30)
overview.lookAt(0, 0, 0)
```

The camera is a normal Three.js `PerspectiveCamera` or `OrthographicCamera`.
Scene updaters can move it each frame, and parenting works normally. Registering
it does not render another view or calculate geometry. A camera's state is read
only after the requested frame has been sought.

```bash
# Discover IDs, projection data, transforms, and metadata at frame 600.
npm run dm -- cameras vector-field --frame 600 --json

# Project exposed-object geometry through a chosen viewpoint.
npm run dm -- inspect vector-field --frame 600 --camera field-overview --json

# Render exactly that view.
npm run dm -- still vector-field --frame 600 --camera particle-follow --json

# Compare main and every exposed camera from one exact scene state.
npm run dm -- camera-grid vector-field --frame 600 --json

# Select and order a subset explicitly.
npm run dm -- camera-grid vector-field --frame 600 \
  --cameras main,field-overview,particle-follow --columns 3 --json
```

`main` is reserved for the authored animation camera and is always discoverable.
Unknown IDs return `UNKNOWN_CAMERA` together with the IDs available at that
frame. Camera grids seek once, then render up to 25 views without advancing or
rebuilding the scene between cells. Each JSON result includes camera metadata,
projection state, and image cell bounds. A scene may expose at most 50 cameras.

Like exposed objects, camera registrations belong to one `AnimatedScene` and
are cleared before rebuild and destruction. This prevents old camera references
from accumulating across requests or persistent-runtime generations.

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
against the new revision. Vite validates changed modules before reloading. A
syntax or import failure returns `SOURCE_COMPILE_ERROR` immediately with its
file, line, column, plugin, and source frame instead of returning output from an
older generation. Fix the source and retry; the same session recovers without a
manual restart.

While that revision is invalid, `session status` reports `source-error` and the
pending revision plus the same structured diagnostic. Diagnostics from older
revisions are ignored when edits arrive quickly.

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

1. Validation, debug overlays, and object-ID renders.
2. Extracted versioned runtime/CLI packages for upgrading generated projects.
3. An agent skill and, if useful, a thin MCP wrapper.
