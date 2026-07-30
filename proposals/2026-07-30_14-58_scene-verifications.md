# Scene verifications

## Goal

Let scene authors define frame-level correctness checks using scene-specific intent, then run all or selected checks from the CLI.

## Registration

Verifications are registered while the scene is built:

```ts
scene.verify(
  "panel-padding",
  {
    during: "cold-spots",
    frames: {
      start: checkStart,
      end: checkEnd,
    },
  },
  context => {
    const content = context.screenBounds(explanationColumn)
    const panel = context.screenBounds(backgroundPanel)

    context.assert(
      content.left >= panel.left + 10 &&
        content.right <= panel.right - 10 &&
        content.top >= panel.top + 10 &&
        content.bottom <= panel.bottom - 10,
      "Content must remain at least 10px inside the panel",
      { content, panel, requiredMargin: 10 },
    )
  },
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

scene.addAnims(
  moveTo(label, target),
)

const movementEnd = scene.getTimelinePointer()

scene.verify(
  "label-clear-while-moving",
  {
    during: "cold-spots",
    frames: {
      start: movementStart,
      end: movementEnd,
    },
  },
  checkLabelClearance,
)
```

Changing the animation duration automatically changes the verification range on the next build. Saving the range before restoring the pointer also supports background animations.

## Verification context

The first version exposes only:

```ts
interface VerificationContext {
  globalFrame: number

  beat?: {
    name: string
    localFrame: number
    beatProgress: number
  }

  screenBounds(object: THREE.Object3D, camera?: THREE.Camera): ScreenBounds
  worldBounds(object: THREE.Object3D): THREE.Box3
  isVisible(object: THREE.Object3D): boolean

  assert(
    condition: boolean,
    message: string,
    details?: Record<string, unknown>,
  ): void
}
```

Screen bounds use logical video pixels. Verification callbacks must be side-effect-free and run only in verification mode.

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
