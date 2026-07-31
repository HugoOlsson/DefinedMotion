# DefinedMotion documentation

These files describe the shipped authoring API. Proposals and regression fixtures are not API documentation.

## Reading paths

- First scene: [Getting started](getting-started.md) → [Scenes and timeline](scenes-and-timeline.md) → [Animation effects](animation-effects.md)
- UI explainer: [Text and LaTeX](text-and-latex.md) → [LaTeX effects](latex-effects.md) → [Layout](layout.md) → [Beats](beats.md) → [Verification](verification.md)
- Procedural or 3D: [Camera and 3D](camera-and-3d.md) → [Custom animations](advanced/custom-animations.md) → [Verification](verification.md)
- Tooling: [CLI](cli.md) and [Assets and audio](assets-and-audio.md)

## Core invariants

- Frames are the timeline source of truth. Animation durations are authored in seconds and compile once using the project FPS.
- Scene reconstruction is deterministic. Runtime-dependent animation values are captured by `bind()` when their animation starts.
- Exact rendering and automation trace from frame `0`. Viewer preview markers are explicitly approximate.
- Use public imports only: `definedmotion` and its documented subpaths.
