# Scenes and timeline

`AnimatedScene` owns the Three.js scene, camera, renderer, and one global frame timeline.

```ts
const start = scene.getTimelinePointer()
scene.addAnims(moveTo(card, target, { duration: 0.8 }))
const end = scene.getTimelinePointer()
```

`addAnims(...plans)` schedules its arguments in parallel and advances the builder pointer by the longest plan. Save and restore the pointer to author background or parallel work:

```ts
const start = scene.getTimelinePointer()
scene.addAnims(moveTo(card, target))
scene.setTimelinePointer(start)
scene.addAnims(fadeOut(caption))
```

`scene.do(action)` schedules one replay-safe discrete action at the current pointer. `scene.onEachTick(updater)` is the escape hatch for persistent calculated relationships. Use `scene.secondsToFrames()` or `scene.millisecondsToFrames()` only where a structural frame position is required.

Frame ranges are end-exclusive. Exact seek, rendering, grids, verification, and collision checks rebuild and trace chronologically from frame `0`.

For long interactive scenes, `scene.previewFromHere()` marks one clean animation boundary. With the viewer preference enabled, earlier frames are visibly unavailable and skipped; disable it for exact inspection. A marker inside an animation is a build error.

Related: [Beats](beats.md), [Custom animations](advanced/custom-animations.md), [CLI](cli.md).
