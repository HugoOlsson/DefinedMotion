# Working with DefinedMotion

The implementation, Studio, examples, tests, and agent documentation in this package share one
version. Start with `reference/INDEX.md`, then read `reference/agent-workflow.md` before authoring
or reviewing an animation.

Use only public imports from `definedmotion`, `definedmotion/animation`, `definedmotion/assets`,
`definedmotion/latex`, `definedmotion/math`, `definedmotion/media`, and
`definedmotion/rendering` in consumer and reference scenes.

Keep framework implementation in `src/`, public entry points in `src/public/`, and published CLI
code in `cli/`. Put framework-owned fonts and built-in environments in `assets/`. Repository-only
generation and verification programs belong in `scripts/`.

Everything under `reference/` is published with the npm package. Add durable teaching scenes to
`reference/examples`, executable visual checks to `reference/tests/<capability>`, and only their
supporting media to `reference/assets`. Use `referenceAsset()` for that media. Do not add a
framework-owned `src/scenes` directory.

Use `playground/` for private experiments and project-specific scenes; nothing there is published.
Root `tests/` is for repository package/integration checks and is tracked on GitHub but not shipped
to npm.

From the repository root, run `npm run typecheck`, `npm run build`, `npm run pack:check`, and
`npm run test:package` after package-boundary changes. Do not commit `.definedmotion/`, `renders/`,
or generated package archives.
