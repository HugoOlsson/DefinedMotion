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

Camera-attached UI is ordinary camera child geometry and is measured through the active camera like other content. `screenBounds()` and `layout-check` use projected axis-aligned bounds; use scene-specific verification for intentional 3D relationships.

Expose non-audience viewpoints with `scene.exposeCamera()` for `cameras`, `camera-grid`, and `inspect --camera` without changing the rendered output.
