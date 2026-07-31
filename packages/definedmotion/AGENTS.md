# Working with DefinedMotion

Use public imports only: `definedmotion`, `definedmotion/animation`, `definedmotion/assets`, `definedmotion/latex`, `definedmotion/math`, `definedmotion/media`, and `definedmotion/rendering`.

Frames are the scheduling source of truth; public animation durations are seconds. Preserve deterministic reset/exact-seek behavior. Put runtime code in `src/`, public entry points in `src/public/`, CLI code in `cli/`, teaching examples in `reference/examples/`, regression fixtures in `reference/tests/`, and project experiments in `playground/`.

## Read by task

| Task | Canonical document |
| --- | --- |
| First scene or timeline | [Getting started](documentation/getting-started.md), [Scenes and timeline](documentation/scenes-and-timeline.md) |
| Effects or custom animation | [Animation effects](documentation/animation-effects.md), [Custom animations](documentation/advanced/custom-animations.md) |
| UI/math content | [Text and LaTeX](documentation/text-and-latex.md), [LaTeX effects](documentation/latex-effects.md), [Layout](documentation/layout.md) |
| Named sections | [Beats](documentation/beats.md) |
| Correctness checks | [Verification](documentation/verification.md) |
| 3D, assets, or CLI | [Camera and 3D](documentation/camera-and-3d.md), [Assets and audio](documentation/assets-and-audio.md), [CLI](documentation/cli.md) |

Do not treat `proposals/` or regression fixtures as supported authoring documentation.

From the repository root, use `npm run test:proposal -- <name>` while implementing, `npm test` for the fast gate, and `npm run test:full` only for completion/CI. Run `npm run pack:check` after package-boundary changes. Never commit `.definedmotion/`, `renders/`, or package archives.
