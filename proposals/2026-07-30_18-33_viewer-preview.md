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

If the marker is at frame `markerFrame`, the viewer:

1. Rebuilds the scene and timeline normally.
2. Starts from the freshly rebuilt scene state.
3. Skips scheduled runtime work before `markerFrame`.
4. Traces every frame from `markerFrame` through the requested frame, inclusively.

Everything scheduled on `markerFrame` runs in the normal frame order, including `do()`, animation binding and updates, `onEachTick`, and layout.

The marker is the lower boundary for viewer restoration, scrubbing, and playback:

- frames before it remain visible on the timeline but are shaded and unreachable;
- global frame numbers and time labels do not change;
- restoring a saved frame before it opens the marker frame;
- viewer restart returns to the marker;
- scrubbing after it retraces from the same marker.

The preview intentionally does not reconstruct animation, instruction, or accumulated callback state from before the marker.

## Marker validity

The marker must be a clean animation boundary. An animation crosses the marker when:

```text
animation.startFrame < markerFrame < animation.endFrame
```

where `endFrame` is exclusive. If an animation crosses the marker, the viewer reports the invalid marker and falls back to an exact full trace. The author can move the marker to a clean boundary. Exact output operations ignore marker validity because they never use the shortcut.

## Viewer state

Marker-based viewing displays a persistent badge:

```text
Approximate preview · starts at beat “cold-spots” · frame 4580
```

Outside a beat:

```text
Approximate preview · starts at frame 4580
```

The badge provides a **Trace from start** action. This performs an exact viewer trace and temporarily unlocks the complete timeline for the current build. The marker becomes active again after the next source reload.

Without a marker, the viewer traces from frame `0` and the complete timeline is available.

## Exact operations

The preview marker is ignored by:

- rendering and export;
- scene verification;
- `watchCollisions` and `layout-check`;
- timeline, image, and camera grids;
- automated capture;
- `seekExact()` and `visitExactFrames()`.

These paths always evaluate the complete preceding timeline in chronological order.

## Replaced API

Remove `HotReloadSetting` from the public API:

- no marker replaces `TraceFromStart`;
- `previewFromHere()` replaces the explicit performance purpose of `BeginFromCurrent`;
- `BeginFreshOnSave` is removed; **Trace from start** remains an explicit viewer action.

The scene constructor no longer receives a hot-reload mode.
