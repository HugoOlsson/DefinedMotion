# Hot-reload tracing

## Goal

Make viewer hot reload exact by default while providing an explicit, visible shortcut for long scenes. The shortcut affects only interactive restoration after source reload; output and automation remain authoritative.

## Authoring API

```ts
scene.hotReloadTraceFromHere()
```

The call records the current global timeline pointer as a hot-reload marker. It does not execute scene work, advance the pointer, or affect the rendered timeline.

Several markers may be registered. When restoring a viewer frame, DefinedMotion uses the latest marker at or before that frame. A marker inside a beat inherits the beat name for display; otherwise its frame number is sufficient.

```ts
timeline.beat("cold-spots", () => {
  scene.hotReloadTraceFromHere()

  scene.do(() => {
    panel.visible = true
  })

  scene.addAnims(fadeIn(title))
})
```

No string label or explicit frame is required because the beat and builder pointer already contain that information.

## Restore behavior

When hot reload restores frame `targetFrame`:

1. Rebuild the scene and timeline normally.
2. Find the latest marker `markerFrame <= targetFrame`.
3. If none exists, trace exactly from frame `0`.
4. If one exists, skip scheduled runtime work before it and trace every frame from `markerFrame` through `targetFrame`, inclusively.

Everything scheduled on `markerFrame` runs in the normal order, including `do()`, animation binding and updates, `onEachTick`, layout, and derived updates.

The shortcut starts from the freshly rebuilt scene state. It does not reconstruct animation, instruction, or accumulated callback state from before the marker. This is the intentional preview tradeoff. Markers should therefore be placed at clean beat boundaries that establish the state needed by the following section.

An animation crossing a marker cannot recover the state it originally bound before the marker. If a scheduled animation starts before the selected marker and ends after it, the viewer falls back to exact tracing and reports why the marker was not used. This keeps marker execution deterministic and encourages clean beat boundaries.

## Viewer state

Marker-based restoration displays a persistent badge:

```text
Approximate preview · traced from beat “cold-spots” · frame 4580
```

Outside a beat:

```text
Approximate preview · traced from frame 4580
```

The badge provides a **Trace from start** action. It disappears only after an exact viewer trace or a reload at frame `0`.

The marker is an explicit author choice, but the badge ensures that approximate inspection is never mistaken for authoritative output.

## Exact operations

Hot-reload markers are ignored by:

- rendering and export;
- scene verification;
- layout and inspection checks;
- timeline, image, and camera grids;
- automated capture;
- `seekExact()` and `visitExactFrames()`.

These paths always evaluate the complete preceding timeline in chronological order.

## Viewer reload preference

Whether source reload restores the current frame or opens frame `0` is a viewer preference:

```text
On reload: Keep current frame | Go to start
```

It is not scene behavior and does not belong in the `AnimatedScene` constructor.

## Replaced API

Remove `HotReloadSetting` from the public API:

- `TraceFromStart` becomes the implicit default.
- `BeginFromCurrent` is replaced by the local marker.
- `BeginFreshOnSave` becomes the viewer preference, if retained.

The scene constructor no longer receives a hot-reload mode.

## Future optimization

Exact sparse seeking may later skip uneventful frame ranges by sampling deterministic animations only at required boundaries. This is an internal optimization and does not change the marker contract. Marker-based tracing remains useful for long, genuinely sequential `onEachTick` sections.
