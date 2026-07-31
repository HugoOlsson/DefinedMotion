# Viewer scene selection

## Goal

Let the interactive viewer select any registered scene without editing `definedmotion.config.ts`. The selected scene and whether examples/tests are shown persist across viewer restarts and source reloads.

## Existing foundation

DefinedMotion already discovers project scenes, packaged examples, and visual tests into one registry. CLI automation already selects a scene from this registry by stable ID. The viewer should use the same registry instead of calling an entry function fixed to `defaultScene`.

`defaultScene` remains the first-run and missing-selection fallback. Viewer selection never rewrites project configuration.

## Registry access

The internal virtual project module exposes:

```ts
project
listScenes(): ViewerSceneSummary[]
createSceneById(id: string): AnimatedScene
```

```ts
interface ViewerSceneSummary {
  id: string
  name: string
  kind: "project" | "example" | "test"
  isDefault: boolean
}
```

No new authored scene metadata is required. `kind` is derived from the existing project/reference origin and `isTest` metadata.

`createSceneById()` validates the ID, selects the correct asset namespace, and invokes the registered factory. The viewer and automation use this shared creation path so asset behavior cannot drift.

## Interactive scene session

An internal `InteractiveSceneSession` owns the active viewer scene:

```ts
class InteractiveSceneSession {
  selectScene(id: string): Promise<AnimatedScene>
  dispose(): Promise<void>
}
```

Selecting a scene:

1. Assigns the request a new selection generation, pauses playback, and cancels pending scrubbing.
2. Disposes the previous scene, controls, renderer, WebGL context, canvas, audio, observers, and registered cleanup work.
3. Creates and builds the selected scene through `createSceneById()`.
4. Disposes the completed scene and stops if its generation is no longer current.
5. Connects the current scene to viewer playback, rendering, and UI callbacks.
6. Displays the effective initial frame: its valid preview marker when preview use is enabled, otherwise frame `0`.

Only the latest selection generation may become active. If an older asynchronous creation finishes after a newer scene selection or source reload has started, its completed resources are disposed and it cannot replace the canvas, persist its ID, or update viewer state. Source reload uses the same latest-request-wins rule.

Scene selection is disabled while video rendering is active. Creation and disposal behavior shared with automation should live in common internal helpers rather than being duplicated in the Svelte UI.

If a selected scene fails to build, the viewer keeps that selection and displays the error. It does not silently open another scene.

## Viewer UI

The viewer displays a searchable scene selector above the viewport:

```text
Scene: [ Microwave Cold Spots ▾ ]

☐ Show examples and tests
☑ Use scene preview marker
```

Entries are grouped as:

```text
Project
Examples
Tests
```

The configured default scene is marked in the selector. **Show examples and tests** filters selectable entries but does not interrupt an example or test that is already active; the current scene remains visible in the selector until another scene is chosen.

**Show examples and tests** defaults to off. **Use scene preview marker** defaults to on. Both values are persisted.

## Persistence

Viewer-only state is stored through Electron's persistent store, scoped to the current project:

```ts
interface ViewerPreferences {
  selectedSceneId?: string
  showExamplesAndTests: boolean
  usePreviewMarker: boolean
}
```

Startup resolution is:

1. Use the stored scene if its ID still exists.
2. Otherwise use `project.defaultScene`.
3. Clear an obsolete stored ID and report the fallback briefly.

The viewer URL also associates restored frame state with its scene:

```text
?scene=microwave-cold-spots&frame=4687
```

A frame is restored only when the URL scene matches the selected scene. With preview use enabled, a restored frame before the selected scene's marker is clamped to the marker. Manual scene switching starts at the effective initial frame: the marker when enabled and present, otherwise frame `0`.

Source reload rebuilds the stored selected scene rather than returning to the configured default and respects the same preview preference and boundary.

## Examples and tests

Packaged examples and tests remain registered so the viewer checkbox can expose them without a configuration edit or restart. The current public `includeReferenceScenes` configuration switch is removed; visibility in the interactive viewer belongs only to the stored viewer preference.

The first version may keep the current eager module discovery. Lazy scene loading is a possible internal optimization, not part of this feature's contract.

## CLI behavior

Viewer selection does not change CLI defaults or mutate project configuration. CLI commands continue selecting scenes explicitly by stable ID.

The CLI scene listing and viewer selector use the same summaries, including name, kind, and configured-default status.

## Validation

Regression coverage must verify:

- repeated switching between two scenes leaves one canvas, renderer, audio state, and active observer set;
- project and reference assets resolve correctly after switching;
- the selected ID and both viewer preferences survive viewer restart and source reload;
- deleting the selected scene falls back to `defaultScene`;
- frame state is never restored into a different scene;
- a selected scene opens at its preview marker only when preview use is enabled;
- rapid scene selections and source reloads activate only the latest request and dispose stale completions;
- switching is unavailable during video rendering.

## Non-goals

The first version does not add scene creation, deletion, renaming, favorites, tags, recent-scene history, per-scene remembered frames, configuration editing, lazy loading, or CLI control of the interactive viewer selection.
