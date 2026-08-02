# Verification

Scene verifications encode requirements that generic collision checking cannot know.

```ts
const start = scene.getTimelinePointer()
scene.addAnims(moveTo(label, target))
const end = scene.getTimelinePointer()

scene.verify('label-inside-panel', { frames: { start, end } }, (context) => {
  const labelBounds = context.screenBounds(label)
  const panelBounds = context.screenBounds(panel)
  context.assert(
    labelBounds !== null && panelBounds !== null &&
      labelBounds.left >= panelBounds.left + 10,
    'Label must stay inside the panel',
    { labelBounds, panelBounds }
  )
})
```

Ranges are end-exclusive and may intersect `frames` with `during: 'beat-name'`. Callbacks are synchronous, side-effect-free, and run only under `definedmotion verify` after the full frame state resolves.

The context provides global and beat-local coordinates, logical viewport pixels, unclipped `screenBounds()`, `worldBounds()`, hierarchy visibility, and `assert()`.

Run all checks or select stable IDs:

```bash
npm run dm -- verify --scene my-scene --json
npm run dm -- verify --scene my-scene --test label-inside-panel --frame 120 --json
```

`watchCollisions` plus `layout-check` remains the conservative generic screen-bounds safety net.

Expose important objects for semantic inspection with flat primitive metadata:

```ts
scene.expose('result-label', resultLabel, {
  description: 'The final value shown to the audience',
  tags: ['result', 'text'],
  data: { role: 'result', emphasized: true, step: 4 }
})
```

`data` accepts at most 50 `string | number | boolean | null` values. Arrays and nested objects are rejected by TypeScript; runtime validation preserves the same boundary for JavaScript and untyped inputs. Use `tags` for lists of labels.
