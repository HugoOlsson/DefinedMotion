# Working with DefinedMotion

Read [`docs/agent-workflow.md`](docs/agent-workflow.md) before changing an animation.

Use this loop:

1. Start one runtime: `npm run dm -- session start --json`
2. Find scene IDs: `npm run dm -- scenes --json`
3. Edit a scene in `src/scenes/**/*.scene.ts`
4. Review the whole animation with `timeline-grid`
5. Review important frames with `still`, `inspect`, and `camera-grid`
6. Fix issues and repeat against the same runtime
7. Stop the runtime and run the relevant project checks

Do not judge an animation from code or endpoint stills alone. Prefer deterministic scene state, stable exposed-object IDs, purposeful inspection cameras, and lazy `scene.asset()` references.
