# Agent runtime foundation

DefinedMotion's automation interface is built around one rule: Studio and CLI
must be clients of the same scene registry, timeline runtime, and Three.js
renderer. Automation must not reimplement scene execution.

## Runtime boundaries

- `src/definedmotion.config.ts` owns the fixed timeline FPS, render sampling,
  and deterministic seed. Timeline FPS never depends on monitor refresh rate.
- `src/entry.ts` exports the project scene registry and the backwards-compatible
  `entryScene` used by Studio.
- `AnimatedScene.seekExact(frame)` rebuilds from initial state, resets seeded
  randomness, traces every preceding tick, validates the requested frame, and
  renders at logical output resolution.
- The Electron main process supports a hidden automation mode. Requests and
  results use typed IPC, PNG files are written by the main process, and the
  process exits after one command.
- `scripts/definedmotion.mjs` builds current source and invokes that hidden
  renderer. JSON mode reserves stdout for the final machine-readable result.

## Initial commands

```bash
npm run dm -- scenes

npm run dm -- scenes --json

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

## Result contract

A successful still includes scene ID, exact frame and time, duration, FPS,
seed, logical resolution, absolute output path, and render time. Failures use a
non-zero exit status and a JSON object with a stable error shape.

## Next layers

The foundation intentionally precedes AI-specific protocols. Planned clients
and capabilities can build on the same runtime:

1. Multi-frame sessions and contact sheets that reuse one renderer.
2. Semantic inspectable-object registration and response-budgeted snapshots.
3. Validation, debug overlays, and object-ID renders.
4. Extracted versioned runtime/CLI packages for upgrading generated projects.
5. An agent skill and, if useful, a thin MCP wrapper.
