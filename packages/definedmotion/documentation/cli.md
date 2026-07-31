# CLI

Use the project script (`npm run dm -- ...`) so commands resolve the installed runtime and current project.

```bash
npm run dm -- scenes --json
npm run dm -- timeline-grid my-scene --count 12 --json
npm run dm -- inspect my-scene --frame 120 --json
npm run dm -- still my-scene --frame 120 --json
npm run dm -- verify --scene my-scene --json
npm run dm -- layout-check my-scene --json
npm run dm -- render my-scene --json
```

Start `session start` once for repeated non-render commands; use `session stop` when finished. `render` runs in an isolated process. JSON results go to stdout; render progress goes to stderr.

Use timeline grids to map progression, inspection for semantic geometry/state, stills for visual judgment, verification for authored requirements, and layout checks for generic projected overlap warnings.

For the complete flags and result schema, see the versioned [agent workflow](../reference/agent-workflow.md).
