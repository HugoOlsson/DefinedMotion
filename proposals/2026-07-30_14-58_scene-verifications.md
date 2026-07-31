# Scene verifications

## Goal

Let scene authors define frame-level correctness checks using scene-specific intent, then run all or selected checks from the CLI.

## Registration

Verifications are registered while the scene is built:

```ts
scene.verify(
  'panel-padding',
  {
    during: 'cold-spots',
    frames: {
      start: checkStart,
      end: checkEnd
    }
  },
  (context) => {
    const content = context.screenBounds(explanationColumn)
    const panel = context.screenBounds(backgroundPanel)

    if (content === null || panel === null) {
      context.assert(false, 'Content and panel must have projectable geometry')
      return
    }

    context.assert(
      content.left >= panel.left + 10 &&
        content.right <= panel.right - 10 &&
        content.top >= panel.top + 10 &&
        content.bottom <= panel.bottom - 10,
      'Content must remain at least 10px inside the panel',
      { content, panel, requiredMargin: 10 }
    )
  }
)
```

IDs are unique within a scene and stable for CLI selection.

```ts
interface VerificationOptions {
  during?: string
  frames?: {
    start: number
    end: number
  }
}
```

`during` names a beat. `frames` is an end-exclusive global frame range. When both are present, the verification runs over their intersection. With neither, it runs over the complete scene.

## Pointer-derived ranges

Agents should derive local verification ranges from the builder pointer instead of copying frame numbers:

```ts
const movementStart = scene.getTimelinePointer()

scene.addAnims(moveTo(label, target))

const movementEnd = scene.getTimelinePointer()

scene.verify(
  'label-clear-while-moving',
  {
    during: 'cold-spots',
    frames: {
      start: movementStart,
      end: movementEnd
    }
  },
  checkLabelClearance
)
```

Changing the animation duration automatically changes the verification range on the next build. Saving the range before restoring the pointer also supports background animations.

## Verification context

All screen measurements use one representation:

```ts
interface ScreenBounds {
  left: number
  right: number
  top: number
  bottom: number
  width: number
  height: number
}
```

The first version exposes only:

```ts
interface VerificationContext {
  globalFrame: number

  viewport: {
    width: number
    height: number
  }

  beat?: {
    name: string
    localFrame: number
    beatProgress: number
  }

  screenBounds(object: THREE.Object3D, camera?: THREE.Camera): ScreenBounds | null
  worldBounds(object: THREE.Object3D): THREE.Box3
  isVisibleInHierarchy(object: THREE.Object3D): boolean

  assert(condition: boolean, message: string, details?: Record<string, unknown>): void
}
```

`viewport` is the logical video size. Screen coordinates begin at `(0, 0)` in its top-left corner and increase toward the right and bottom.

Both bounds operations include the object's descendants and measure geometry independently of visibility. `worldBounds()` uses current world transforms and returns an empty Three.js `Box3` when the subtree has no geometry.

`screenBounds()` uses the active render camera when none is supplied. Its bounds are unclipped, so objects outside the viewport may produce negative coordinates or coordinates beyond the video dimensions. It returns `null` only when the subtree has no projectable geometry in front of the camera.

`isVisibleInHierarchy()` means that the object's Three.js `visible` flag and those of its ancestors are enabled. It does not claim viewport intersection, frustum visibility, material opacity, occlusion, or actual pixel visibility.

Verification callbacks must be side-effect-free and run only in verification mode.

## Shared measurement

DefinedMotion uses one internal world-bounds implementation and one internal screen-projection implementation for:

- scene verification;
- `watchCollisions` and `layout-check`;
- agent inspection;
- positioning where the same measurement applies.

This keeps measurement results consistent without adding a public measurement namespace. Intrinsic flex and grid layout continues to use each visual's local `getLocalBounds()`.

`watchCollisions` remains the generic screen-overlap safety net. Scene verification complements it with authored requirements such as containment, margins, and visibility.

## Execution

At every eligible frame, checks run after instructions, animations, `onEachTick`, layout, camera updates, and world-matrix updates.

The runner exact-traces the scene once in chronological order and executes all eligible selected checks per frame. It records the first failure for each check, continues with other checks, and exits nonzero if anything fails.

## CLI

```bash
# All checks in a scene
definedmotion verify --scene microwave-cold-spots

# One or more exact IDs
definedmotion verify --scene microwave-cold-spots --test panel-padding
definedmotion verify --scene microwave-cold-spots \
  --test panel-padding \
  --test label-clear-while-moving

# One global frame
definedmotion verify --scene microwave-cold-spots \
  --test panel-padding \
  --frame 4687

# Discovery
definedmotion verify --scene microwave-cold-spots --list
```

CLI frame selection can only narrow a verification's declared range. Unknown IDs, invalid ranges, and selections with no eligible frames are errors.

Failures report the test ID, message, details, global frame, and beat-local frame and `beatProgress` when applicable.

## Initial scope

This version intentionally excludes tags, pixel analysis, screenshots, snapshot comparison, sampling strategies, previous-frame measurements, setup hooks, and matcher libraries. Scene authors compose checks from bounds, visibility, ordinary calculations, and `assert()`.

## Acceptance suite

- `VERIFY-01`: world bounds include descendant geometry and current world transforms and are empty for geometry-free subtrees.
- `VERIFY-02`: screen bounds use logical video pixels, remain unclipped, and are null only without projectable geometry in the camera depth range.
- `VERIFY-03`: hierarchy visibility reflects only Three.js ancestor `visible` flags.
- `VERIFY-04`: registration rejects invalid ranges, unstable IDs, and duplicate IDs.
- `VERIFY-05`: beat and explicit frame ranges intersect with end-exclusive semantics.
- `VERIFY-06`: selected IDs, one-frame narrowing, discovery, and unknown selections have deterministic CLI results.
- `VERIFY-07`: all selected checks share one chronological exact trace and record only their first failure.
- `VERIFY-08`: verification failures return structured details and make the CLI exit nonzero.

Targeted command: `npm run test:verification --workspace definedmotion`. The selectable `test-scene-verifications` scene and Electron automation gate cover authored callbacks and the complete CLI protocol.
