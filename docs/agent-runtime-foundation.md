# Agent runtime foundation

DefinedMotion Studio and its CLI are clients of the same scene registry, timeline runtime, and Three.js renderer. Automation does not reimplement scene execution.

## Runtime boundaries

- `definedmotion.config.ts` owns timeline FPS, render sampling, seed, and the default scene.
- Project and packaged reference `*.scene.ts` modules register through `defineScene()`.
- Exact automation rebuilds a clean scene, resets seeded randomness, and traces from frame `0`.
- A persistent session keeps Electron, Vite, WebGL, fonts, and caches warm while still rebuilding scene state for every request.
- Studio scene selection changes runtime input; it does not rewrite project configuration.
- Viewer preview markers may skip history for interactive work. Render, inspect, verify, layout checks, grids, and captures remain exact.
- `scene.asset()` resolves lazy project media through the DefinedMotion asset protocol.
- `scene.expose()` and `scene.exposeCamera()` provide semantic inspection without doing geometry work during normal playback.
- `scene.verify()` and `scene.watchCollisions()` run only when their CLI checks are requested.

## Shared lifecycle

```text
scene registry
    -> selected scene factory
    -> clean AnimatedScene build
    -> deterministic frame trace
    -> Studio canvas or CLI result
```

Scene modules may be imported during discovery, so media reads and substantial work belong inside the selected scene factory. A source revision must compile and report ready before a persistent session executes it; invalid revisions return structured diagnostics instead of stale output.

## Automation entry points

```bash
npm run dm -- session start --json
npm run dm -- scenes --json
npm run dm -- timeline-grid my-scene --count 16 --json
npm run dm -- still my-scene --frame 120 --json
npm run dm -- inspect my-scene --frame 120 --json
npm run dm -- verify --scene my-scene --json
npm run dm -- layout-check my-scene --json
npm run dm -- render my-scene --json
npm run dm -- session stop --json
```

JSON mode reserves stdout for the final machine-readable result. Persistent-session results identify the runtime, renderer generation, and source revision. Rendering remains isolated so a long export cannot block inspection work.

The packaged [agent workflow](../packages/definedmotion/reference/agent-workflow.md) is the operational CLI reference. The package [documentation index](../packages/definedmotion/documentation/index.md) is the source of truth for scene authoring.
