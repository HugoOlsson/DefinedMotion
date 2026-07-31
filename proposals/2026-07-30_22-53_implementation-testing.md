# Implementation testing

## Goal

Turn every implemented proposal into machine-checkable evidence without making expensive Electron and package tests part of every development iteration.

A contract is an observable rule authors can rely on, independent of internal implementation. Tests protect contracts rather than private data structures.

## Required commands

```bash
# Fast development loop for one proposal
npm run test:proposal -- new-animation-api

# Proposal-specific integration gate
npm run test:integration -- new-animation-api

# Fast repository gate
npm test

# Comprehensive CI and release gate
npm run test:full

# Individual layers when needed
npm run test:unit
npm run test:scenes
npm run test:viewer
npm run test:package
```

`test:proposal` should normally finish in under 30 seconds. It runs the proposal's unit tests and only its short scene contracts. It never launches Playwright viewer tests or installs a packed consumer.

`test:integration` runs the additional layers declared for that proposal and should normally finish in two to four minutes. For example, the animation API may require unit and scene layers, while scene selection requires unit and viewer layers.

`npm test` is the normal repository gate: type checking, all unit tests, the curated scene contracts, and documentation/reference validation. `test:full` additionally runs the complete viewer and packed-consumer suites. Run `test:full` in CI before merging or releasing, and locally only when the affected layer or requested level of confidence warrants it.

## Test layers

The suite has four layers:

1. **Unit tests** for pure calculations and validation.
2. **Scene contract tests** using real scenes, exact tracing, and `scene.verify()`.
3. **Viewer integration tests** driving the real Electron viewer.
4. **Package tests** installing and exercising a packed consumer project.

Put each contract in the cheapest layer that can prove it. Reuse the existing runners and runtime where practical.

## Proposal acceptance

Every proposal gains an **Acceptance suite** section containing:

- stable acceptance IDs;
- the observable rule for each ID;
- the test layer that proves each rule;
- its targeted and integration commands.

Example:

```text
ANIM-01  Sequential movement captures its source when it starts.
ANIM-02  A mutable destination is captured when the animation starts.
ANIM-03  Same-frame animations all bind before any update.
ANIM-04  Competing writers update in registration order.
ANIM-05  A one-frame animation receives progress 1.
ANIM-06  Exact seek and chronological tracing produce equivalent state.
ANIM-07  Reset discards bound state and binds again.
```

Changing or removing an acceptance rule requires changing the proposal explicitly. An implementation must not weaken its tests merely to make the suite pass.

Acceptance IDs are approved before implementation begins. An implementing agent must not invent a weaker contract around the implementation it happened to write.

## Unit tests

Use unit tests for behavior that does not require rendering, such as frame calculations, validation, layout calculations, registry logic, and preferences. They must be deterministic and fast enough for continuous use.

## Scene contract tests

Use a short, real scene when a contract depends on scene execution or rendered geometry. Contract scenes should also be selectable through **Show examples and tests** so a human can inspect them.

Contract scenes:

- use fixed FPS, dimensions, and seed;
- expose the state needed for diagnosis;
- verify results independently of the primitive under test;
- remain short enough to exact-trace every relevant frame.

Prefer one scene that proves several related acceptance rules over many narrow visual fixtures. Keep the gallery curated and reuse existing scenes when they already prove the contract.

## Determinism harness

When a proposal affects seeking or reconstruction, compare the observable state produced by chronological tracing, exact seeking, and reset followed by seeking. Add viewer scrubbing or source reload only when the proposal affects those paths.

Prefer semantic state and scene inspection over pixel snapshots. Use tolerant image comparison only when state cannot prove the visual contract.

## Viewer integration

Viewer tests are deterministic scripts using stable selectors and explicit application events. They do not use agent-driven visual navigation.

Keep this suite deliberately small. Logic belongs in unit tests; the real Electron application tests only boundaries that require it, such as:

- replacing the active scene and canvas;
- restoring persisted viewer state after restart;
- preview boundaries affecting scrubbing;
- build-error presentation;
- render-time UI restrictions.

Tests wait for explicit readiness or completion events, never arbitrary sleeps.

The suite may reuse one Electron process, but cases run serially and reset application state and resources between cases. Failure to reset is itself a test failure.

## Expected failures

When a proposal defines invalid authoring behavior, test that it fails with a nonzero status, stable error code, and actionable context. Add dedicated fixtures only where needed.

## Failure evidence

Failures identify the acceptance ID and provide actionable evidence:

```text
FAIL ANIM-02 Mutable destination captured at bind

Scene: test-animation-contract
Frame: 120
Expected position: [420, 0, 0]
Actual position:   [300, 0, 0]

Artifact:
.definedmotion/test-results/ANIM-02/failure.json
```

The structured artifact contains the acceptance ID, message, relevant scene/frame context, expected and actual values, and scene inspection when applicable. A screenshot or viewer trace may be added when it helps diagnose a visual or integration failure.

Successful runs print only a concise summary. Detailed inspection, screenshots, Playwright traces, and other large artifacts are produced on failure.

## Package tests

Package tests install the packed library into a small consumer project and verify the supported public surface and one representative build, CLI, and viewer workflow. They belong to `test:full`, not the normal development loop.

## Agent workflow

For each proposal:

1. Add its acceptance tests.
2. Run the targeted suite and confirm the new tests fail for the missing behavior.
3. Implement the smallest complete behavior.
4. Repeatedly run `test:proposal`.
5. Run `test:integration` once the targeted suite passes.
6. Run `npm test` before declaring the proposal complete.
7. Run `test:full` only when the proposal affects its expensive layers or as part of CI, merge, or release validation.
8. Report the exact commands and results.

Tests and implementation may be reviewed separately when a contract is especially important.

## Repository and comprehensive gates

`npm test` runs:

1. TypeScript and Svelte checks.
2. Unit tests.
3. All unit and scene proposal acceptance checks.
4. Curated scene contract verification.
5. Reference catalog and documentation validation.

`npm run test:full` runs `npm test`, then:

1. Viewer Electron integration.
2. Packed consumer smoke testing.

Focused or skipped tests fail their applicable gate. All failures exit nonzero.

The scene and viewer runners reuse persistent Electron runtimes where possible so rigor does not require repeated process, WebGL, and font startup.

## Migration

Audit the existing scripts and reference scenes:

- migrate distinct regressions into the new layers;
- keep specialized fixtures that still protect supported behavior;
- remove duplicate or obsolete tests after replacement coverage passes;
- make the current separate automation, viewport, runtime-session, positioning, audio, and packaging checks part of the appropriate gate.

Do not make every historical reference scene blocking immediately. Begin with the focused contract gallery and add existing scenes only when they protect a distinct behavior.

## Non-goals

The first version does not require exhaustive pixel snapshots, platform-identical rendering, broad performance benchmarking, hundreds of visual fixtures, or testing private implementation structure.
