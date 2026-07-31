# Beats

Beats are named windows over the global timeline, not nested timelines.

```ts
scene.timeline.defineBeats({
  intro: { start: 0, end: scene.secondsToFrames(4) },
  diagram: { start: scene.secondsToFrames(4), end: scene.secondsToFrames(12) }
})

scene.timeline.beat('diagram', (beat) => {
  scene.addAnims(revealDiagram)
  beat.onEachTick(({ localFrame, globalFrame, beatProgress }) => {
    diagram.setProgress(beatProgress)
  })
})
```

Definitions are non-overlapping, integer, end-exclusive frame ranges. Authoring a beat temporarily moves the ordinary scene pointer to the beat start and restores the prior pointer in `finally`. Scheduled work may fill but not cross the beat.

The callback is synchronous. `beatProgress` is `0` on the first frame and `1` on the last; a one-frame beat reports `1`. The context also exposes local/global frame and time values.
