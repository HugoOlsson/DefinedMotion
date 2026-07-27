# DefinedMotion

DefinedMotion contains the animation runtime, visual Studio, automation CLI, and the matching
versioned reference corpus used by people and coding agents.

Consumer projects own their `definedmotion.config.ts`, `src/scenes`, and `src/assets`; updating the
dependency does not replace them. Run the Studio with `definedmotion dev` and list all packaged and
project scenes with `definedmotion scenes`.

See `reference/INDEX.md` for examples, executable visual tests, and the agent workflow.

Final video renders are written to the consumer project's `renders/` directory. Temporary frame
and audio data stay under `.definedmotion/cache/`. Agents and scripts can export a scene with
`definedmotion render <scene> --json`; progress is reported on stderr while the final structured
result is written to stdout.

## Relative positioning

`scene.positioning()` creates one-way relationships measured from world-aligned bounding boxes. The
object passed to `place()` is the only object that the relationship may move. Directions always use
world axes: `rightOf` and `leftOf` use X, `above` and `below` use Y, and `positiveZOf` and
`negativeZOf` use Z. They do not rotate with either object.

```ts
import { Axis } from 'definedmotion'

const positioning = scene.positioning()

positioning
  .place(title)
  .above(plotContent, {
    gap: { initial: 40, range: [20, 60] }
  })
  .centerWith(plotContent, { axis: Axis.X })
```

The ranged gap places the title at 40 initially and then leaves it still while the measured gap is
between 20 and 60. Use `gap: 40` for an exact gap that is restored every tick. Relationships are
solved in dependency order, so chains such as `plotContent -> title -> badge` work independently of
registration order.

Bounds include the complete Three.js subtree passed as the reference. Because they are world-aligned,
their dimensions can change as an object rotates. Keep positioned decorations outside the content
group whose bounds they use, so a title does not contribute to the plot bounds that position it.
Two independently positioned objects also cannot be an ancestor and descendant of one another;
use sibling groups as positioning dependents. Dependents must keep Three.js `matrixAutoUpdate` and
`matrixWorldAutoUpdate` enabled. Objects with manually managed matrices can still be references as
long as their world matrices are kept current by the caller.

Use `placeOnce()` for initial layout without a lasting relationship:

```ts
positioning
  .placeOnce(legend)
  .rightOf(plotContent, { gap: 24 })
  .centerWith(plotContent, { axis: Axis.Y })
```

One-shot relationships participate in the same validation and dependency ordering as persistent
relationships. Each constraint is removed after its first successful bounds-based placement, so
later animation of `plotContent` does not move `legend`. A ranged gap uses its `initial` value for
that placement; use a numeric gap when no range is needed.
