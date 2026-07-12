# DefinedMotion project

Run the interactive Studio:

```bash
npm run dev
```

User scenes belong in `src/scenes/**/*.scene.ts`. Choose the initial Studio scene through `defaultScene` in `src/definedmotion.config.ts`.

## Coding agents

Start with [`AGENTS.md`](AGENTS.md). The full [`agent interface guide`](docs/agent-workflow.md) presents every feedback tool, what it returns, and why it exists.

```bash
npm run dm -- session start --json
npm run dm -- scenes --json
```

Run `npm run dm -- --help` for the command summary.
