# Legacy deletion

## Goal

Finish the proposed API redesign by removing replaced authoring paths, implementations, examples, and documentation. DefinedMotion should expose one coherent system rather than carrying both the legacy and new APIs.

Git history is the archive. Removed APIs should not remain as aliases, deprecated wrappers, or undocumented alternate paths unless an external migration temporarily requires one.

## Sequence

Deletion happens after the corresponding replacement works, but separately for each subsystem:

1. Implement the replacement and its deterministic reset/seek behavior.
2. Add focused regression coverage and canonical documentation.
3. Migrate DefinedMotion internals, curated examples, project templates, and workspace consumers such as VideoFactory.
4. Remove the legacy exports and require the workspace to typecheck without them.
5. Delete unreachable implementations, outdated examples, and duplicate documentation.

Do not implement every proposal and postpone all cleanup to one final migration. Each completed subsystem should remove its own obsolete surface before the next public layer is considered finished.

## Timeline and scheduling

After `AnimationPlan`, runtime `bind()`, and explicit pointer control ship, remove:

- `addDeferredAnims`;
- `addSequentialBackgroundAnims`;
- `insertAnimsAt`;
- `addWait`;
- `doAt`.

Their replacements are:

```ts
scene.getTimelinePointer()
scene.setTimelinePointer(frame)
scene.addAnims(...plans)
scene.do(action)
scene.onEachTick(updater)
```

`wait(duration)` is an ordinary animation plan whose public duration is expressed in seconds. Saving and restoring the pointer replaces background and explicitly positioned scheduling. `do()` remains the single discrete, replay-safe action primitive.

The current `addWait()` accepts milliseconds, so migration must convert its values rather than preserve the same numeric literal:

```ts
scene.addWait(500)          // legacy milliseconds
scene.addAnims(wait(0.5))   // new seconds
```

This migration also changes duration conversion from the current ceiling behavior to the new nearest-frame rule. Very short legacy waits that compile to zero frames must become `scene.do()` when they represent an instantaneous action, or use a longer positive duration.

Remove global authoring-time conversion helpers such as `millisToTicks` after they are replaced by scene-dependent helpers for structural frame positions:

```ts
scene.secondsToFrames(value)
scene.millisecondsToFrames(value)
```

Internal time conversion needed by rendering may remain private.

## Animation representation

After all helpers return runtime-bound `AnimationPlan`s, remove the numerical-array animation model:

- `UserAnimation` and `DefinedAnimation`;
- `createAnim` and `createAnimNamed`;
- public interpolation arrays;
- `copy`, `reverse`, `scaleLength`, `sum`, and `addNoise`;
- array resampling, compression, concatenation, and noise helpers.

Remove the current array-producing implementations of:

- `easeConstant`;
- `easeLinear`;
- `easeInOutQuad`;
- `rubberband`.

Easing itself remains part of `AnimationOptions`, represented by the new easing contract rather than sampled numerical arrays. Generic reversal and rescaling of already-created animation objects are not required replacement features.

Remove or internalize legacy effect helpers after their canonical replacements exist:

- public `setOpacity` and `setScale`;
- generic `fade`;
- `fadeInTowardsEnd`;
- `zoomIn` and `zoomOut` in favor of `scaleIn` and `scaleOut`;
- duplicate camera helpers such as `moveRotateCameraAnimation3D`, `moveCameraAnimation3D`, `moveCameraToAnim`, `rotateCameraToAnim`, `flyCameraToAnim`, and `zoomCameraToAnim`.

`fadeIn` and `fadeOut` remain public names but are reimplemented as canonical `AnimationPlan` helpers. Camera behavior moves to the `camera.*` namespace.

## Text and LaTeX

After `createText`, `createLatex`, stable roots, anchors, and measurement ship, remove:

- `createFastText`;
- `createMeshText`;
- `createChars`;
- standalone `updateText`;
- alternate public text construction paths used only by old examples.

Migrate the existing LaTeX implementations behind:

```ts
latex.write(...)
latex.mark(...)
latex.highlight(...)
latex.morphTo(...)
latex.particleTransition(...)
```

Then remove their old public function names and raw SVG-oriented paths used only to manipulate LaTeX internals. Generic SVG creation remains unless a separate proposal replaces it. Do not delete the underlying morphing, writing, semantic query, marking, highlighting, or particle-transition capabilities.

## Layout and verification

Keep:

- `watchCollisions`;
- the internal collision-watch registry;
- the `layout-check` CLI and incident screenshots;
- exact frame-by-frame collision scanning.

This is a useful generic safety net for agent-authored scenes. It projects visible geometry into camera space and catches likely visual overlaps even when objects do not intersect in 3D world space.

Scene-defined verification complements rather than replaces it. `layout-check` finds broad projected-bounds collisions without requiring custom tests, while `scene.verify()` expresses scene-specific requirements such as containment, margins, visibility, and intentional relationships.

Document `layout-check` as a conservative overlap check between projected screen-space bounds across exact frames.

Bounds measurement, exposed objects, inspection cameras, exact frame visiting, and automation capture also remain.

The existing 2D/3D positioning system is not removed by this proposal. Flex and grid do not replace general world-space positioning constraints. Positioning may be reviewed separately after the new layout system has real usage.

## Viewer preview

After `scene.previewFromHere()` and the viewer boundary UI ship, remove:

- the `HotReloadSetting` enum;
- the hot-reload argument from `AnimatedScene`;
- `hotreloadNameLookup`;
- the `traceFromStart` mode branch;
- scene-level `BeginFreshOnSave` handling;
- all imports, examples, templates, and documentation for the three old modes.

Without a marker, or when **Use scene preview marker** is disabled, the viewer traces exactly from frame `0`. When enabled, a valid marker applies to viewer restoration, scrubbing, and playback and makes earlier frames visibly unavailable. Rendering and automation do not use the shortcut, but all scene builds reject an out-of-range marker or one crossed by an animation so viewers and CLI agents receive the same authoring error.

## Public exports

Replace broad `export *` barrels with curated public exports for the supported API. Remove exports of runtime implementation details, internal registries, raw interpolation machinery, duplicate LaTeX entry points, and obsolete helpers.

Internal code may keep private utilities when they still serve the canonical implementation, but a removed public primitive must not survive as an accidentally reachable alternate import.

## Documentation and examples

Once `packages/definedmotion/documentation/` is canonical and included in the package allowlist:

- shorten the package README to overview, installation, one minimal example, and links;
- shorten the package `AGENTS.md` to repository rules and document routing;
- shorten the repository README to a repository and development overview;
- remove migrated duplicate material from the existing long README, agent workflow, and runtime-foundation documents;
- update the create-project template to the final API;
- migrate a small set of representative examples;
- remove obsolete tutorials and examples that exist only to demonstrate deleted APIs;
- keep implementation regression scenes separate from the agent-facing example catalog.

Regression tests for retained behavior should be migrated, not deleted merely because their authoring syntax is old. Tests whose only purpose is a removed API may be deleted after replacement coverage exists.

Maintain a migration checklist covering:

- DefinedMotion internals and public entry points;
- the create-project template;
- curated examples and regression scenes;
- playground projects;
- VideoFactory and generated projects.

Before deleting the legacy scheduler, make binding, reset, exact-seek, one-frame, sequential, parallel, and overlapping-animation coverage part of the default test gate.

## Explicitly retained

This cleanup does not remove:

- `addAnims`, `do`, or `onEachTick`;
- global frame-based timing;
- seconds-based public animation durations and scene-dependent conversion helpers for structural frame positions;
- exact seek, render, verification, and capture paths;
- `fadeIn`, `fadeOut`, core easing, or custom animations in their new forms;
- specialized LaTeX effects;
- assets, audio, video, camera, and 3D capabilities;
- exposed-object and inspection-camera tooling;
- `watchCollisions`, its registry, and the `layout-check` CLI;
- the existing positioning system without a separate replacement decision.

Deletion is complete when canonical documentation and curated examples contain no legacy names, public barrels expose no alternate path, workspace search finds no consumers, and exact rendering plus verification regression tests pass.
