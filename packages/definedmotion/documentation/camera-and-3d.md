# Camera and 3D

Three.js objects, lights, materials, cameras, and loaders remain first-class. `SpaceSetting.ThreeDim` creates a perspective camera; `TwoDim` creates an orthographic camera.

Use the focused camera namespace for authored camera motion:

```ts
import { camera } from 'definedmotion/animation'

scene.addAnims(
  camera.moveTo(scene.camera, new THREE.Vector3(0, 4, 24), {
    duration: 1,
    space: 'world'
  })
)
```

`camera.moveTo`, `camera.rotateTo`, and `camera.moveToPose` use the same local/world rules as the core transform plans. `camera.zoomTo` animates orthographic `zoom` or perspective `fov`. `camera.frame(camera, object)` preserves the current viewing direction while moving to frame an object's runtime bounds; for an orthographic camera it also animates zoom. All target state is captured when the plan binds.

Use `scene.addCameraAttachedUI()` for audience-facing titles, formulas, captions, and layout panels that must follow the main camera:

```ts
import { layout } from 'definedmotion/rendering'

const titleBand = layout.flex({ flexDirection: 'column', gap: 0.4 }, [title, subtitle])
titleBand.position.set(0, 5.5, -18)
scene.addCameraAttachedUI(titleBand)
```

Register each root during scene construction; do not also add it to `scene.scene` or `scene.camera`. Positions use camera-local Three.js coordinates. Camera-attached UI renders after the world, so world geometry cannot cover it. Appended layout children and LaTeX morph descendants inherit the same behavior without material changes or re-registration. Existing animations and verifications work normally. Audience UI is intentionally absent from inspection-camera captures.

Use ordinary Three.js parenting instead when a camera-mounted object belongs physically in the world and should participate in world lighting or occlusion. `screenBounds()` and `layout-check` use projected axis-aligned bounds; use scene-specific verification for intentional 3D relationships.

Expose non-audience viewpoints with `scene.exposeCamera()` for `cameras`, `camera-grid`, and `inspect --camera` without changing the rendered output.
