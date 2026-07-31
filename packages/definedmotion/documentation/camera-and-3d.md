# Camera and 3D

Three.js objects, lights, materials, cameras, and loaders remain first-class. `SpaceSetting.ThreeDim` creates a perspective camera; `TwoDim` creates an orthographic camera.

Core transform plans work on cameras as ordinary `Object3D`s:

```ts
scene.addAnims(
  moveTo(scene.camera, new THREE.Vector3(0, 4, 24), {
    duration: 1,
    space: 'world'
  })
)
```

Local targets are relative to the parent. World targets are converted once when the plan binds; they are not persistent world constraints. Use `matchTransform` for an object-to-object world-pose match.

Camera-attached UI is ordinary camera child geometry and is measured through the active camera like other content. `screenBounds()` and `layout-check` use projected axis-aligned bounds; use scene-specific verification for intentional 3D relationships.

Expose non-audience viewpoints with `scene.exposeCamera()` for `cameras`, `camera-grid`, and `inspect --camera` without changing the rendered output.
