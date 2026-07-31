# DefinedMotion agent workflow

This is the compact operational reference for agents inspecting and validating DefinedMotion scenes. The [documentation index](../documentation/index.md) is the source of truth for authoring APIs.

## Recommended loop

```bash
npm run dm -- session start --json
npm run dm -- scenes --json
npm run dm -- timeline-grid my-scene --count 12 --json
npm run dm -- inspect my-scene --frame 120 --json
npm run dm -- still my-scene --frame 120 --json
npm run dm -- layout-check my-scene --json
npm run dm -- verify --scene my-scene --json
npm run dm -- render my-scene --json
npm run dm -- session stop --json
```

Start broad with a timeline grid, then inspect and render stills at important frames. Use dense samples around motion; endpoints alone do not reveal easing or discontinuities. Use the audience camera for composition and exposed cameras for 3D structure.

## Command choice

| Need | Command |
| --- | --- |
| Discover stable scene IDs | `scenes` |
| Reuse Electron/WebGL across requests | `session start` |
| Inspect duration, objects, transforms, and bounds | `inspect` |
| Review one exact full-resolution frame | `still` |
| Review progression across exact frames | `timeline-grid` |
| Run authored assertions | `verify` |
| Find watched projected-bound overlaps | `layout-check` |
| Discover or compare inspection cameras | `cameras`, `camera-grid` |
| Export the complete MP4 | `render` |

Run commands through the consumer project's script:

```bash
npm run dm -- <command> [arguments] [flags]
```

Use `--json` for agents. `--standalone` bypasses a running session, `--require-session` refuses fallback, and `--no-build` reuses an existing standalone build and is unsafe after source edits. `render` always runs in an isolated process.

## Commands

### Session and discovery

```bash
npm run dm -- session start [--foreground] [--json]
npm run dm -- session status [--json]
npm run dm -- session stop [--json]
npm run dm -- scenes [--exclude-tests] [--json]
```

A session keeps the renderer environment warm, but each request constructs a clean scene. `scenes` includes packaged examples and tests unless `--exclude-tests` is supplied.

### Still and timeline grid

```bash
npm run dm -- still <scene> --frame <integer> [--camera <id>] [--output <png>] [--json]

npm run dm -- timeline-grid <scene> \
  [--frames 0,30,60 | --count <integer>] \
  [--columns <integer>] [--cell-width <pixels>] \
  [--output <png>] [--json]
```

Still frames must be within the scene's end-exclusive duration. The default camera is `main`. A grid defaults to nine evenly distributed exact frames including the first and last. `--frames` and `--count` are mutually exclusive; at most 100 frames may be requested.

### Semantic inspection

```bash
npm run dm -- inspect <scene> [--frame <integer>] [--camera <id>] [--json]
```

Inspection returns scene duration and FPS, camera state, and exposed objects with attachment, inherited visibility, text, transforms, world bounds, and unclipped screen bounds. Bounds may be `null` for empty or unprojectable objects. They describe projection, not occlusion.

### Verification and collision checks

```bash
npm run dm -- verify --scene <scene> [--test <id> ...] [--frame <integer> | --list] --json

npm run dm -- layout-check <scene> \
  [--output-dir <directory>] [--merge-gap-frames <integer>] [--json]
```

`verify` runs scene-authored checks over their declared end-exclusive ranges. Repeat `--test` to select IDs, use `--list` to discover them, or narrow eligible checks with `--frame`.

`layout-check` visits every frame and groups collisions between watched screen-space bounds into incidents. It is a conservative warning system, not pixel-level visibility analysis. It writes one representative PNG per distinct incident frame. A scene without watches reports `NO_COLLISION_WATCHES` rather than claiming to be clean.

### Inspection cameras

```bash
npm run dm -- cameras <scene> [--frame <integer>] [--json]

npm run dm -- camera-grid <scene> [--frame <integer>] \
  [--cameras main,overview,detail | --cameras all] \
  [--columns <integer>] [--cell-width <pixels>] \
  [--output <png>] [--json]
```

Every scene exposes the reserved `main` camera. Camera grids seek once and render the same state through up to 25 selected viewpoints.

### Final render

```bash
npm run dm -- render <scene> [--output <video>] [--json] [--no-build]
```

The default output is `renders/<scene>.mp4`. Render progress is written to stderr; the final result remains on stdout in JSON mode.

## Result contract

Every result contains `success`. Successful results contain `command` and command-specific data. Session-backed results also contain:

```json
{
  "runtimeId": "runtime-12ab34cd",
  "generation": 3,
  "sourceRevision": "sha256:..."
}
```

Failures have a stable error code and message, with source diagnostics when available:

```json
{
  "success": false,
  "command": "still",
  "error": {
    "code": "FRAME_OUT_OF_RANGE",
    "message": "Frame 900 is outside scene range 0-839",
    "file": "optional source path",
    "line": 12,
    "column": 4
  }
}
```

Branch on `success` and `error.code`; do not parse message text. Verification assertion failures return structured results with `passed: false` and a nonzero process exit.

Common recovery:

- `UNKNOWN_SCENE`: run `scenes --json` and use an exact ID.
- `FRAME_OUT_OF_RANGE`: inspect frame `0` and use `sceneInfo.lastFrame`.
- `UNKNOWN_CAMERA`: run `cameras` at that frame.
- `SOURCE_COMPILE_ERROR`: fix the reported file and retry; the same session can recover.
- `SESSION_NOT_RUNNING`: start a session or remove `--require-session`.
- build/runtime failures: avoid stale `--no-build`, inspect `.definedmotion/runtime.log`, then rebuild or restart.

## Authoring for automation

- Give every scene a stable unique `defineScene({ id, ... })` default export.
- Use seeded scene randomness and frame-derived state; avoid wall-clock and unseeded randomness.
- Expose only meaningful objects and cameras with stable IDs.
- Add scene-specific `scene.verify()` checks for objective requirements.
- Register `scene.watchCollisions()` for objects whose accidental overlap matters.
- Load project media lazily through `scene.asset()` inside the selected scene's build path.
- Place `scene.previewFromHere()` only at a clean boundary. It accelerates Studio when enabled but never changes exact CLI evaluation.

The focused API guides cover [timeline construction](../documentation/scenes-and-timeline.md), [effects](../documentation/animation-effects.md), [beats](../documentation/beats.md), [text and LaTeX](../documentation/text-and-latex.md), [layout](../documentation/layout.md), [verification](../documentation/verification.md), and [3D cameras](../documentation/camera-and-3d.md).

## Handoff checklist

- Review the complete timeline and important transitions.
- Inspect relevant semantic state and camera containment.
- Run authored verification and registered collision checks.
- Build the consumer project.
- For framework work, run the relevant proposal test repeatedly and the full required gate once before completion.
- Keep generated images under `.definedmotion/` and stop sessions started for the task.
