# Package architecture

DefinedMotion separates the versioned framework from each animation project.

## Published packages

- `definedmotion` owns the runtime, Studio, Electron host, CLI, public TypeScript entry points,
  and the curated `reference/` corpus.
- `create-definedmotion` is only a project generator. Its template contains configuration, one
  starter scene, an assets folder, and a dependency on `definedmotion`.

The framework and its teaching material therefore update together. A consumer can run
`npm install definedmotion@latest` without replacing `definedmotion.config.ts`, `src/scenes`, or
`src/assets`.

## Repository-only areas

- `playground/` is the private consumer project used while developing the framework. Nothing in
  it is included in either npm package.
- Root `tests/` verifies packaging from a real tarball. It is tracked on GitHub but not published
  to npm.

## Reference publication rule

Everything intentionally placed in these directories ships with `definedmotion`:

- `packages/definedmotion/reference/examples/`
- `packages/definedmotion/reference/tests/`
- `packages/definedmotion/reference/assets/`
- `packages/definedmotion/assets/` for package-owned fonts and built-in environments

There is no separate manifest to keep synchronized. `reference/catalog.json` and
`reference/INDEX.md` are generated from the scene files during `prepack`. Reference verification
rejects imports of private renderer or project paths.

The generated project's `AGENTS.md` directs coding agents to the installed, version-matched
`node_modules/definedmotion/reference/INDEX.md` and `agent-workflow.md`.

Reference examples and tests are registered as scenes by default, directly from the installed
package. They are not copied into a consumer's `src/scenes`, so updating `definedmotion` updates the
runtime and its teaching corpus without touching user files.

## Public API boundary

Consumer and reference scenes import only from:

- `definedmotion`
- `definedmotion/animation`
- `definedmotion/assets`
- `definedmotion/latex`
- `definedmotion/math`
- `definedmotion/media`
- `definedmotion/rendering`

`definedmotion/reference` exposes reference-corpus metadata. It does not expose implementation
internals or replace the published files under `reference/`.

Studio internals remain available inside the package implementation but are not exported as a
consumer contract.

## Internal source boundaries

- `cli/` is published command-line product code.
- `scripts/` contains repository-only generation, packaging, and smoke-test programs.
- `src/runtime/` is the reusable animation and rendering implementation.
- `src/renderer/` is the small Studio/Vite shell.
- `src/automation/` contains the shared automation contract and hidden-renderer commands.
- `src/main/` and `src/preload/` are explicit Electron process boundaries.
- `src/public/` defines the supported package entry points.

Reference tests and assets use one category level. Generic wrappers such as `for_tests`,
`renderer/src/lib`, and a framework-owned `src/scenes` directory are intentionally absent.

## Consumer-generated files

Build output, runtime state, and temporary frame and audio data live below `.definedmotion/` in the
consuming project. Final video files are written to its top-level `renders/` directory. Neither
location is part of the installed package, and both are ignored by Git.

## Packaging checks

Both packages use positive `files` allowlists. `npm run pack:check` inspects the real tarballs for
forbidden generated directories and size regressions. `npm run test:package` installs the packed
framework into a temporary generated project, builds it, discovers packaged and project scenes,
reinstalls the dependency, and verifies that the user's scene was unchanged.

Run both commands from the repository root. Framework type checks and production builds are
available there as `npm run typecheck` and `npm run build`.
