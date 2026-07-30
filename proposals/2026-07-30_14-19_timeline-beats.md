# Timeline beats

## Goal

Give named sections of a long scene local runtime coordinates without introducing nested timelines or another scheduling API.

## Beat definitions

All beats are declared together as ranges on the global timeline:

```ts
timeline.defineBeats({
  intro: {
    start: seconds(0),
    end: seconds(6),
  },
  "cold-spots": {
    start: seconds(6),
    end: seconds(18),
  },
  turntable: {
    start: seconds(18),
    end: seconds(30),
  },
})
```

Integer frames remain the internal source of truth. Time values are converted to frames when the timeline is built. Beat ranges are end-exclusive, may contain gaps, and may overlap.

DefinedMotion has no narration-cue protocol. VideoFactory may derive these ranges automatically from its script timings and pass the resulting beat-definition object to `defineBeats()`.

## Authoring inside a beat

`timeline.beat()` temporarily places the global builder pointer at the beat's start:

```ts
timeline.beat("cold-spots", beat => {
  scene.addAnims(fadeIn(title))
  scene.addAnims(scaleIn(diagram))
})
```

It performs the following steps:

1. Save the global builder pointer.
2. Set it to the beat's global start frame.
3. Run the callback using the normal scene scheduling API.
4. Restore the saved global pointer.

The order in which beat callbacks are authored therefore does not affect their global positions. Scheduled animations remain part of the single global timeline, and scene duration remains the latest scheduled animation end.

There is only one writable pointer:

```ts
const position = scene.getTimelinePointer()
scene.addAnims(backgroundAnimation)
scene.setTimelinePointer(position)
```

The beat provides a read-only local view for inspection:

```ts
scene.getTimelinePointer()     // e.g. 4587
beat.getLocalTimelinePointer() // 0
```

The local value is always:

```ts
scene.getTimelinePointer() - beat.startFrame
```

Scheduling outside the beat from its callback is a validation error. DefinedMotion does not clip overflowing animations; cross-boundary work should be scheduled globally or placed in a beat whose range contains it.

## Runtime progress

`beat.onEachTick()` is a beat-scoped form of the existing continuous updater:

```ts
beat.onEachTick(({
  localFrame,
  globalFrame,
  localTimeMs,
  beatProgress,
}) => {
  diagram.setProgress(beatProgress)
})
```

It runs only on frames inside the beat and uses the same runtime update phase as `scene.onEachTick()`.

```ts
interface BeatTick {
  localFrame: number
  globalFrame: number
  localTimeMs: number
  beatProgress: number
}
```

`localFrame` begins at `0`. `beatProgress` is normalized from `0` on the first active frame to `1` on the last active frame. Time is derived from frames and is not a second timeline source.

## Inspection and verification

DefinedMotion can associate every global frame with its active beats. Inspection and scene-defined verification can therefore report failures using meaningful local coordinates:

```text
Verification failed: panel-margin
Global frame: 4687
Beat: cold-spots
Local frame: 100
Beat progress: 16.7%
```

Verifications may select a named beat as their frame range without manually repeating its start and end.

## Non-goals

A beat does not own objects, hide content, reset state, clip rendering, create a layer, or create another timeline. It is a named global range that provides local runtime coordinates and a temporary authoring position.
