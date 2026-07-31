# Viewer preview boundary

## Goal

Let authors shorten interactive viewer tracing for long scenes while making the unavailable history and approximate state explicit. Rendering and automation always remain authoritative.

## Authoring API

```ts
scene.previewFromHere()
```

The call records the current global timeline pointer as the viewer preview start. It does not execute scene work, advance the pointer, or affect the rendered timeline.

At most one preview marker may be registered in a scene. A second call is an authoring error.

```ts
scene.timeline.beat("cold-spots", () => {
  scene.previewFromHere()

  scene.do(() => {
    panel.visible = true
  })

  scene.addAnims(fadeIn(title))
})
```

No label or explicit frame is required because the beat and builder pointer already contain that information.

## Viewer behavior

The viewer has a persisted **Use scene preview marker** preference, enabled by default. If the scene has a marker at frame `markerFrame` and the preference is enabled, the viewer:

1. Rebuilds the scene and timeline normally.
2. Starts from the freshly rebuilt scene state.
3. Skips scheduled runtime work before `markerFrame`.
4. Traces every frame from `markerFrame` through the requested frame, inclusively.

Everything scheduled on `markerFrame` runs in the normal frame order, including `do()`, animation binding and updates, `onEachTick`, and layout.

The marker is the lower boundary for viewer restoration, scrubbing, and playback:

- frames before it remain visible on the timeline but are dimmed or hatched, labelled **Not evaluated in preview**, and unreachable;
- the marker is drawn as a prominent vertical line labelled **Preview starts here**;
- global frame numbers and time labels do not change;
- restoring a saved frame before it opens the marker frame;
- scrubbing after it retraces from the same marker.

The preview intentionally does not reconstruct animation, instruction, or accumulated callback state from before the marker.

If the preference is disabled, the viewer traces from frame `0` and makes the complete timeline available. The marker remains visible in a muted style labelled **Preview marker disabled**. Toggling the preference rebuilds the scene: enabling it clamps the target frame to the marker, while disabling it exactly retraces the current frame from frame `0`.

The preference affects only interactive viewing and is stored per project across source reloads and viewer restarts. A scene without a marker always traces from frame `0`; the control may be shown disabled without changing the stored preference.

## Marker validity

After the timeline is built, the marker must identify an actual scene frame:

```text
Number.isInteger(markerFrame)
0 <= markerFrame < sceneDurationFrames
```

The marker must also be a clean animation boundary. An animation crosses the marker when:

```text
animation.startFrame < markerFrame < animation.endFrame
```

where `endFrame` is exclusive. An out-of-range marker or crossing animation makes the scene build invalid. The viewer does not render or enable playback and instead displays an error containing the marker frame and cause:

```text
Invalid preview marker at frame 100:
animation [80, 140) crosses the marker.
```

Any CLI command that builds the scene reports the same error and exits nonzero before rendering, verification, or other automation begins. Marker validity is checked even when the viewer preference is disabled because the preference controls use of a valid marker, not whether authored marker errors exist. This makes invalid placement visible to agents instead of silently falling back to a slower trace.

## Viewer state

Marker-based viewing displays a persistent badge:

```text
Approximate preview · starts at beat “cold-spots” · frame 4580
```

Outside a beat:

```text
Approximate preview · starts at frame 4580
```

The badge and timeline make clear that earlier state was skipped. The persisted **Use scene preview marker** toggle replaces a temporary **Trace from start** action.

Without a marker, the viewer traces from frame `0` and the complete timeline is available.

## Exact operations

A valid preview marker does not alter evaluation by:

- rendering and export;
- scene verification;
- `watchCollisions` and `layout-check`;
- timeline, image, and camera grids;
- automated capture;
- `seekExact()` and `visitExactFrames()`.

These paths still validate marker placement when the scene is built, then evaluate the complete preceding timeline in chronological order without using the preview shortcut.

## Replaced API

Remove `HotReloadSetting` from the public API:

- no marker, or disabling **Use scene preview marker**, traces from frame `0`;
- `previewFromHere()` replaces the explicit performance purpose of `BeginFromCurrent`;
- `BeginFreshOnSave` is removed; source reload follows the persisted viewer preference.

The scene constructor no longer receives a hot-reload mode.
