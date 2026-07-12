# DefinedMotion agent interface

This guide is the operational reference for coding agents creating and evaluating DefinedMotion animations.

## Contents

- [What the interface does](#what-the-interface-does)
- [Recommended loop](#recommended-loop)
- [Choosing a feature](#choosing-a-feature)
- [Complete command reference](#complete-command-reference)
- [JSON result contract](#json-result-contract)
- [Authoring scenes for the interface](#authoring-scenes-for-the-interface)
- [Source freshness and session behavior](#source-freshness-and-session-behavior)
- [Errors and recovery](#errors-and-recovery)
- [Effective workflows](#effective-workflows)
- [Verification and limitations](#verification-and-limitations)

## What the interface does

```text
scene source
    ↓  Vite loads the current source revision
persistent Electron + Three.js runtime
    ↓  builds a clean scene and seeks to an exact frame
    ├─ still          → one full-resolution PNG
    ├─ timeline-grid  → several frames in one labeled PNG
    ├─ inspect        → scene, camera, object, and geometry JSON
    └─ camera-grid    → one frame from several viewpoints
```

The interface provides two kinds of evidence:

- **Visual evidence** answers whether composition, color, lighting, typography, and motion progression look right.
- **Structured evidence** answers which state produced the image, where objects are, whether they fit, and which camera is active.

Use both. Code alone cannot prove visual quality, and an attractive still cannot prove correct geometry or good motion.

## Recommended loop

```bash
# 1. Start the expensive environment once.
npm run dm -- session start --json

# 2. Discover stable scene IDs.
npm run dm -- scenes --json

# 3. Map the complete timeline.
npm run dm -- timeline-grid my-scene --count 12 --json

# 4. Check important frames visually and structurally.
npm run dm -- still my-scene --frame 240 --json
npm run dm -- inspect my-scene --frame 240 --json

# 5. Compare the audience camera with inspection views when useful.
npm run dm -- cameras my-scene --frame 240 --json
npm run dm -- camera-grid my-scene --frame 240 --json

# 6. Edit source and repeat against the same session.

# 7. Stop the environment when finished.
npm run dm -- session stop --json
```

Start broad with a timeline grid. Narrow the investigation with stills, inspection, and cameras. Around important movement, request closely spaced frames rather than judging only endpoints.

## Choosing a feature

| Need                                         | Use                         | Reason                                                                      |
| -------------------------------------------- | --------------------------- | --------------------------------------------------------------------------- |
| Find renderable scenes                       | `scenes`                    | Returns stable IDs and identifies the default scene and visual tests.       |
| Avoid repeated Electron/WebGL startup        | `session start`             | Keeps the renderer environment warm across many requests.                   |
| Learn scene duration                         | `inspect <scene> --frame 0` | `sceneInfo` includes duration, last valid frame, dimensions, FPS, and seed. |
| See the complete progression                 | `timeline-grid`             | Places representative exact frames in one image.                            |
| Check a visual detail                        | `still`                     | Produces one lossless, full-resolution frame.                               |
| Confirm position, size, visibility, or state | `inspect`                   | Returns semantic objects, transforms, bounds, text, and in-frame data.      |
| Discover alternative viewpoints              | `cameras`                   | Lists the authored camera and exposed inspection cameras at a frame.        |
| Compare viewpoints                           | `camera-grid`               | Renders the same scene state through several cameras.                       |
| Check geometry through one debug view        | `inspect --camera <id>`     | Projects exposed bounds through the selected camera.                        |
| Render one debug view                        | `still --camera <id>`       | Uses an inspection camera without changing the authored animation camera.   |
| Keep large media out of discovery            | `scene.asset()`             | Creates a lazy reference rather than loading media at module import.        |

## Command invocation and common flags

Run commands from the project root through the package script:

```bash
npm run dm -- <command> [arguments] [flags]
```

Use `--json` for agents. JSON mode reserves stdout for one machine-readable result. Without it, the CLI prints a short human summary.

The render and inspection commands support these execution flags:

| Flag                | Behavior                                                                                                                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--json`            | Emit the complete JSON result.                                                                                                                                                                                   |
| `--standalone`      | Ignore any running session; build and launch an isolated hidden Electron process.                                                                                                                                |
| `--require-session` | Fail with `SESSION_NOT_RUNNING` instead of falling back when no compatible session exists. Cannot be combined with `--standalone`.                                                                               |
| `--no-build`        | When using the standalone path, skip the Electron/Vite build and use existing `out` files. Unsafe after source changes. A running session already uses Vite source freshness, so this flag is unnecessary there. |

Without `--standalone` or `--require-session`, a command uses a compatible running session when available and otherwise falls back to a standalone build and process.

## Complete command reference

### `session`

```bash
npm run dm -- session start [--foreground] [--json]
npm run dm -- session status [--json]
npm run dm -- session stop [--json]
```

`start` launches a project-local Electron/Vite runtime and normally detaches it. `--foreground` keeps the process attached to the terminal, which is useful when the caller owns the process lifecycle or needs live logs. Detached logs are written to `.definedmotion/runtime.log`.

`status` can report:

| Status         | Meaning                                                                                 |
| -------------- | --------------------------------------------------------------------------------------- |
| `stopped`      | No runtime descriptor exists.                                                           |
| `stale`        | A descriptor exists but the process/socket is no longer reachable.                      |
| `loading`      | The process exists but the renderer has not reported ready.                             |
| `ready`        | The runtime can accept work.                                                            |
| `source-error` | The current source revision cannot compile or evaluate; diagnostic fields are included. |

A ready status contains `runtimeId`, `generation`, `sourceRevision`, `pid`, `projectRoot`, and `startedAt`. Calling `start` while a compatible runtime is already ready reuses it. `stop` is safe when already stopped and cleans stale runtime state.

Use a session whenever an agent will make several queries. Requests are serialized inside the runtime. The environment stays warm, but every command disposes the previous scene and constructs a clean one.

### `scenes`

```bash
npm run dm -- scenes [--exclude-tests] [--json] [execution flags]
```

Returns:

```json
{
  "success": true,
  "command": "scenes",
  "scenes": [
    {
      "id": "my-scene",
      "name": "My Scene",
      "isDefault": false,
      "isTest": false
    }
  ]
}
```

Use the returned `id` in every other command. `--exclude-tests` removes definitions marked with `isTest: true`. Tests remain normal renderable scenes in the complete catalogue.

### `still`

```bash
npm run dm -- still <scene> \
  --frame <integer> \
  [--camera <id>] \
  [--output <png>] \
  [--json] [execution flags]
```

- `--frame` is required and must be a non-negative integer below the scene duration.
- `--camera` defaults to `main`.
- `--output` defaults to `.definedmotion/stills/<scene>[-<camera>]-frame-<frame>.png`.
- Relative output paths resolve from the project root. Parent directories are created.
- The PNG uses the scene’s logical width and height with pixel ratio 1.

Important response fields:

| Field                             | Meaning                                               |
| --------------------------------- | ----------------------------------------------------- |
| `scene`, `frame`, `timeMs`        | Exact rendered timeline state.                        |
| `cameraId`, `camera`              | Selected camera and its projection/transform data.    |
| `durationInFrames`, `fps`, `seed` | Deterministic timeline context.                       |
| `width`, `height`                 | PNG dimensions.                                       |
| `output`                          | Absolute written path.                                |
| `renderTimeMs`                    | Time spent building, seeking, rendering, and writing. |

Use a still for high-resolution visual judgment after a timeline grid identifies a frame worth investigating.

### `timeline-grid`

```bash
npm run dm -- timeline-grid <scene> \
  [--frames 0,30,60 | --count <integer>] \
  [--columns <integer>] \
  [--cell-width <pixels>] \
  [--output <png>] \
  [--json] [execution flags]
```

Selection and layout rules:

- With neither `--frames` nor `--count`, nine evenly distributed frames are selected, including the first and last frame.
- `--count` accepts 1–100. If the scene is shorter, the count is reduced to the number of frames.
- `--frames` accepts 1–100 unique, comma-separated, non-negative integers.
- `--frames` and `--count` cannot be combined.
- Explicit frames outside the scene duration fail with `FRAME_OUT_OF_RANGE`.
- `--columns` defaults to a square-like layout: `ceil(sqrt(number of frames))`. It cannot exceed the selected frame count.
- `--cell-width` defaults to 360 and accepts 120–1920 pixels.
- `--output` defaults to `.definedmotion/timeline-grids/<scene>.png`.
- A grid cannot exceed 16,384 pixels in either dimension or 64 million total pixels.

The response includes `frames`, `cells`, grid and scene dimensions, layout, output path, and render time. Every cell contains:

```json
{
  "frame": 240,
  "timeMs": 4000,
  "row": 1,
  "column": 2,
  "x": 744,
  "y": 255,
  "width": 360,
  "height": 203,
  "label": "Frame 240 · 4 s"
}
```

Use automatic sampling for an initial overview. Use explicit dense frames around a transition to judge acceleration, easing, camera motion, or discontinuities.

### `inspect`

```bash
npm run dm -- inspect <scene> \
  [--frame <integer>] \
  [--camera <id>] \
  [--json] [execution flags]
```

- `--frame` defaults to 0.
- `--camera` defaults to `main`.
- No image is written.

The response contains:

| Field                             | Meaning                                                                                                           |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `sceneInfo`                       | ID, name, default/test state, width, height, FPS, duration, last valid frame, duration in milliseconds, and seed. |
| `cameraId`, `camera`              | Camera used to project bounds.                                                                                    |
| `objects`                         | Up to 500 exposed objects, sorted by ID.                                                                          |
| `totalExposedObjects`             | Full registry size before truncation.                                                                             |
| `objectsTruncated`                | Whether more than 500 objects were exposed.                                                                       |
| `frame`, `timeMs`, `renderTimeMs` | Exact state and request timing.                                                                                   |

Each object can contain:

| Field                                   | Meaning                                                                               |
| --------------------------------------- | ------------------------------------------------------------------------------------- |
| `id`, `type`, `name`, `parentId`        | Semantic identity, Three.js type, optional object name, and nearest exposed ancestor. |
| `text`                                  | Current string content when the object has a string `text` property.                  |
| `metadata`                              | Copied description, tags, and primitive data.                                         |
| `attached`                              | Whether the object is connected to the scene root.                                    |
| `visible`                               | Effective visibility including parent visibility and attachment.                      |
| `inFrame`, `fullyInFrame`               | Whether projected world bounds overlap or fit inside the selected camera frame.       |
| `behindCamera`, `partiallyBehindCamera` | Relationship of bound corners to the camera near plane.                               |
| `localTransform`, `worldTransform`      | Position, XYZ Euler rotation in radians, quaternion, and scale.                       |
| `worldBounds`                           | Axis-aligned min, max, size, and center; `null` when no finite geometry exists.       |
| `screenBounds`                          | Pixel-space x, y, width, and height in scene resolution; `null` when not projectable. |

Inspection is based on bounds, not visibility from occlusion. `inFrame: true` means the bounds project into the camera frame, not that another object does not cover them.

Use `inspect <scene> --frame 0` first when duration is unknown. Use the returned `lastFrame` to choose valid still and grid frames.

### `cameras`

```bash
npm run dm -- cameras <scene> [--frame <integer>] [--json] [execution flags]
```

`--frame` defaults to 0 because inspection cameras may move during the animation. The result contains `sceneInfo`, `cameraCount`, and `cameras`.

Every scene has a reserved `main` camera representing the authored audience view. Exposed cameras follow, sorted by ID. Each camera summary contains:

- `id`, `isMain`, and metadata
- projection type: `perspective` or `orthographic`
- position, rotation, quaternion, direction, near, far, and zoom
- perspective `fov` and `aspect`, or orthographic `left`, `right`, `top`, and `bottom`

Run this command before selecting a camera ID for `still`, `inspect`, or `camera-grid`.

### `camera-grid`

```bash
npm run dm -- camera-grid <scene> \
  [--frame <integer>] \
  [--cameras main,overview,detail | --cameras all] \
  [--columns <integer>] \
  [--cell-width <pixels>] \
  [--output <png>] \
  [--json] [execution flags]
```

- `--frame` defaults to 0.
- With no `--cameras` or with `--cameras all`, the grid uses `main` and every exposed camera.
- An explicit camera list accepts 1–25 unique IDs and preserves the requested order.
- A grid renders at most 25 cameras. If the scene exposes more, choose a subset.
- `--columns` defaults to `ceil(sqrt(number of cameras))` and cannot exceed the selected camera count.
- `--cell-width` defaults to 360 and accepts 120–1920 pixels.
- `--output` defaults to `.definedmotion/camera-grids/<scene>-frame-<frame>.png`.
- The same 16,384-pixel and 64-million-pixel grid limits apply.

The scene seeks once, then every camera renders the same state without advancing or rebuilding. The response includes `cameras`, `cameraCells`, `cameraCount`, frame/time data, grid and scene dimensions, output path, and render time.

Camera cells contain `cameraId`, `isMain`, row, column, pixel bounds, and a label. The rendered label also uses the camera description when available.

## JSON result contract

All results contain `success`. Successful command results contain `command` and the fields documented above.

Session-backed results additionally contain:

```json
{
  "runtimeId": "runtime-12ab34cd",
  "generation": 3,
  "sourceRevision": "sha256:..."
}
```

- `runtimeId` remains stable for the persistent process.
- `generation` changes when a different source revision creates a ready renderer generation.
- `sourceRevision` proves which complete `src` tree produced the result.

A failure has this shape:

```json
{
  "success": false,
  "command": "still",
  "error": {
    "code": "FRAME_OUT_OF_RANGE",
    "message": "Frame 900 is outside scene range 0-839",
    "stack": "optional",
    "file": "optional source path",
    "line": 12,
    "column": 4,
    "plugin": "optional Vite plugin",
    "frame": "optional source excerpt"
  },
  "runtimeId": "optional",
  "generation": 3,
  "sourceRevision": "optional"
}
```

Branch on `success` and `error.code`; do not parse human-readable messages as a protocol.

## Authoring scenes for the interface

### Scene discovery and configuration

Create a default-exported `*.scene.ts` module below `src/scenes`:

```ts
import { defineScene } from '../project'
import { AnimatedScene, HotReloadSetting, SpaceSetting } from '$renderer/lib/scene/sceneClass'

export default defineScene({
  id: 'my-scene',
  name: 'My Scene',
  create: () =>
    new AnimatedScene(
      1920,
      1080,
      SpaceSetting.ThreeDim,
      HotReloadSetting.TraceFromStart,
      async (scene) => {
        // Build and schedule the scene.
        scene.addWait(5_000)
      }
    )
})
```

`id` must be non-empty, unique, and free of leading/trailing whitespace. `name` is optional. Set `isTest: true` for a visual test. The default export must be the scene definition; no central registry edit is needed.

Project-wide `timelineFps`, `renderEveryNthFrame`, `seed`, and `defaultScene` live in `src/definedmotion.config.ts`. `defaultScene` must match a discovered ID.

Automation seeks deterministically from the beginning through the requested frame. Use frame-derived state, `scene.random()`, or `scene.randomBetween()` rather than unseeded randomness or wall-clock state.

### Exposing meaningful objects

`scene.expose()` registers an existing `THREE.Object3D` for semantic inspection and returns the same object:

```ts
const mechanism = scene.expose('main-mechanism', new THREE.Group(), {
  description: 'The assembly whose movement explains the concept',
  tags: ['primary-subject', 'dynamic'],
  data: { mode: 'active', units: 'meters' }
})
scene.add(mechanism)
```

Registration must happen during the scene build callback. It does not add the object to the Three.js scene and performs no geometry work until `inspect` runs.

Exposure rules:

- IDs are stable strings of at most 128 characters, with no leading/trailing whitespace.
- One ID identifies one object, and one object can be registered once per build.
- `description` is optional and limited to 2,000 characters.
- `tags` accepts at most 50 non-empty strings, each at most 64 characters. Duplicates are removed.
- `data` accepts at most 50 keys of at most 64 characters with string, finite number, boolean, or `null` values.
- Registrations are cleared before clean rebuilds and destruction, so old object references do not accumulate.
- Inspection returns at most 500 objects and reports truncation.

Expose objects that answer likely questions: the primary subject, important labels, dynamic vectors, computed geometry, or a small state-bearing group. Do not expose every decorative mesh.

Metadata is copied when the object is exposed and should describe stable purpose. For dynamic semantic state, update a string `text` property on the exposed object as the animation changes; `inspect` reads its current value.

`THREE.Box3.setFromObject()` underlies world bounds. For a dynamic `InstancedMesh`, call `computeBoundingBox()` and `computeBoundingSphere()` after changing instance matrices when accurate inspection bounds matter.

### Exposing inspection cameras

`scene.exposeCamera()` registers a perspective or orthographic camera and returns it:

```ts
const overview = scene.exposeCamera(
  'overview',
  new THREE.PerspectiveCamera(50, scene.width / scene.height, 0.1, 1000),
  {
    description: 'Contains the complete mechanism and its boundaries',
    tags: ['overview']
  }
)
overview.position.set(20, 15, 30)
overview.lookAt(0, 5, 0)
```

Camera rules:

- `main` is reserved for `scene.camera` and cannot be used as an exposed ID.
- A scene can expose at most 50 cameras; a camera grid can render at most 25 at once.
- Registration must happen during the build callback.
- Registration does not add the camera to the Three.js scene or render it.
- Cameras may be parented or updated in `onEachTick`; commands read their exact-frame state.
- Camera metadata follows the same description, tags, and data rules as exposed objects.

Give each inspection camera a purpose. Common roles are a stable overview, geometry detail, alternate side, top view, or a close camera placed at a critical interaction.

### Referencing assets lazily

`scene.asset(path)` returns an immutable `SceneAsset` without reading the file:

```ts
const model = scene.asset('models/machine.glb')
const texture = scene.asset('textures/grid.png')
const values = await scene.asset('data/measurements.json').json<number[]>()

gltfLoader.load(model.url, (result) => scene.add(result.scene))
textureLoader.load(texture.url, (result) => (material.map = result))
```

Available properties and reads:

- `asset.path`: normalized project-relative path
- `asset.url`: browser-safe `definedmotion-asset://` URL
- `response()`, `text()`, `arrayBuffer()`, `blob()`, and `json<T>()`

Paths are relative to `src/assets`, use forward slashes, and cannot be absolute URLs, contain `.` or `..` segments, empty segments, query strings, fragments, backslashes, or null bytes. Missing or unreadable files return `ASSET_NOT_FOUND` or `ASSET_LOAD_FAILED` when read.

Create references inside the selected scene’s build path. Avoid importing videos, models, HDRIs, audio, or datasets at module scope; catalogue discovery imports scene code but should not load every scene’s media.

## Source freshness and session behavior

The CLI hashes the complete `src` tree for every session request. Vite watches additions, edits, and removals. The runtime executes only when its renderer reports the requested revision ready.

When source changes during work:

1. Issue the next command normally.
2. The runtime waits up to 15 seconds for the matching renderer generation.
3. If the revision compiles and evaluates, the command runs against it.
4. If it fails, the command returns structured diagnostics.
5. Fix the source and retry against the same session.

Changes outside `src`, such as dependencies, Electron/Vite configuration, or scripts, are not part of the source hash. Restart the session after those changes.

If source changes repeatedly during a request, the CLI retries revision races up to three times. Concurrent CLI requests are serialized by the persistent host.

## Errors and recovery

| Error code or group                                         | Meaning                                                                | Agent response                                                                                                    |
| ----------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `INVALID_ARGUMENTS`, `UNKNOWN_COMMAND`                      | CLI syntax or unsupported command                                      | Correct the invocation; use `npm run dm -- --help`.                                                               |
| `UNKNOWN_SCENE`                                             | Scene ID is absent                                                     | Run `scenes --json` and use an exact returned ID.                                                                 |
| `INVALID_FRAME`, `FRAME_OUT_OF_RANGE`, `EMPTY_SCENE`        | Frame is invalid or the scene has no duration                          | Run `inspect <scene> --frame 0` when possible; use `sceneInfo.lastFrame`; ensure the scene schedules time.        |
| `UNKNOWN_CAMERA`                                            | Camera ID is absent at that frame                                      | The message lists available IDs; run `cameras` to inspect them.                                                   |
| Grid validation errors                                      | Invalid frames, cameras, columns, cell width, or excessive output size | Reduce selection or dimensions according to the command limits above.                                             |
| `SOURCE_COMPILE_ERROR`                                      | Vite syntax/import/transform failure                                   | Use `file`, `line`, `column`, `plugin`, and source `frame`; fix and retry the same session.                       |
| `SOURCE_EVALUATION_FAILED`                                  | A module threw while the renderer evaluated it                         | Use the stack/location; fix initialization or runtime import code and retry.                                      |
| `SOURCE_UPDATE_TIMEOUT`                                     | The requested revision did not become ready within 15 seconds          | Check `.definedmotion/runtime.log`, Vite state, and whether the renderer is stuck; retry or restart if necessary. |
| `SOURCE_CHANGING_TOO_QUICKLY`                               | The source changed throughout all retry attempts                       | Wait for edits to settle and retry.                                                                               |
| `SESSION_NOT_RUNNING`                                       | `--require-session` was used without a session                         | Start a session or remove the flag.                                                                               |
| Session connection/start errors                             | Runtime is stale, inaccessible, or failed to start/respond             | Check `session status`, stop/clean the session, inspect the log, then start again.                                |
| `BUILD_FAILED`, `BUILD_NOT_FOUND`, `ELECTRON_NOT_INSTALLED` | Standalone prerequisites are missing or invalid                        | Run `npm install` and `npm run build`; do not use `--no-build` after source changes.                              |
| Asset errors                                                | Asset path, existence, or loading failure                              | Correct the `src/assets`-relative path or loader usage.                                                           |
| Exposure/camera registration errors                         | Invalid, duplicate, reserved, excessive, or out-of-build registration  | Correct the scene’s semantic registration according to the rules above.                                           |

Unexpected scene exceptions return `AUTOMATION_FAILED` with a stack when available. A renderer request has a five-minute host timeout; the local socket response timeout is 17 seconds for ordinary client communication.

## Effective workflows

### Creating or redesigning a scene

1. Discover scenes and inspect the intended ID.
2. Start with a timeline grid to understand the current progression.
3. Edit one coherent aspect: layout, motion, camera, or styling.
4. Render a new timeline grid using the same frames for comparison.
5. Render full stills at visually important frames.
6. Inspect semantic objects for containment, transforms, and state.
7. Use camera grids for 3D structure or ambiguous composition.
8. Run dense frame samples around motion that still feels wrong.

### Checking motion

A still cannot reveal velocity or easing. If a transition spans frames 120–240, compare frames such as `120,140,160,180,200,220,240`. Look for uneven displacement, pauses, reversals, discontinuities, and unintended camera changes. Confirm final playback in Studio.

### Checking a 3D scene

Use the main camera for audience composition, an overview camera for full containment, and detail cameras for critical geometry. Compare them with `camera-grid`, then use `inspect --camera` when bounds or camera-relative placement need confirmation.

### Responding to an invalid edit

Do not stop the session immediately. Read the structured source diagnostic, fix the file, and repeat the command. The session is designed to recover when the new revision becomes valid.

## Verification and limitations

Before handing off a change:

- Review the full timeline and important transitions.
- Confirm exposed state and camera containment where relevant.
- Run `npm run typecheck`.
- Run `npm run test:automation` for agent-interface, scene-discovery, asset, inspection, or camera changes.
- Run `npm run test:runtime-session` for persistent-runtime and freshness changes.
- Keep generated images under `.definedmotion/`; do not commit them.
- Stop sessions started for the task.

Current limitations:

- The agent CLI produces PNG stills and grids, not playable preview clips. Dense sampling helps, but final motion should be watched in Studio.
- Scene modules are discovered through eager code imports. `scene.asset()` prevents their media from being eagerly read or bundled, but module-scope computation should still stay lightweight.
- Bounds describe geometry and camera projection, not visual occlusion or aesthetic quality.
