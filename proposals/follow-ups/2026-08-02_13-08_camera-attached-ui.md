# Camera-attached UI lifecycle

## Goal

Make audience-facing titles, formulas, captions, and layout panels follow the scene camera without manual camera parenting, material depth changes, or per-tick repair after dynamic content changes.

## API

```ts
const title = layout.flex({ flexDirection: 'column', gap: 0.4 }, [heading, subtitle])
title.position.set(0, 5.5, -18)

scene.addCameraAttachedUI(title)
```

`addCameraAttachedUI()` accepts one `THREE.Object3D`, returns the same typed object, and must be called while the scene is building. Existing animations, layout, text, LaTeX, exposure, and verification APIs operate on it normally.

## Behavior

- Positions remain ordinary camera-local Three.js coordinates.
- Camera-attached UI is rendered in a dedicated transparent-background pass after the world scene, using an internal camera synchronized with the main audience camera.
- World geometry cannot occlude camera-attached UI. UI elements retain their authored materials, depth settings, local Z relationships, and render order.
- Children introduced later by layout appends, LaTeX morphs, or ordinary `Object3D.add()` automatically belong to the UI pass. No subtree traversal or material repair is required.
- Exact seeks, HMR rebuilds, and destruction clear the previous UI roots before rebuilding.
- The UI pass is included only when rendering through the main audience camera. Inspection cameras show world content without audience UI.
- Scene inspection treats registered UI descendants as attached scene objects. Screen measurement against the main camera remains valid.

This primitive is for overlay UI that should remain readable over the world. Camera-mounted physical objects that should participate in world lighting or occlusion continue to use ordinary Three.js parenting.

## Deferred

- pixel coordinates, safe-area anchors, responsive scaling, and FOV-independent authoring;
- automatic layout or viewport verifications;
- including audience UI in inspection-camera renders;
- a separate UI animation or component system.

## Acceptance

- **CAMERA-UI-01:** Registered roots use camera-local transforms and follow perspective and orthographic audience cameras.
- **CAMERA-UI-02:** World geometry cannot cover registered UI, and registration does not mutate authored materials.
- **CAMERA-UI-03:** Layout appends and LaTeX morph descendants render without re-registration or per-tick depth repair.
- **CAMERA-UI-04:** Exact rebuilds remove old UI roots and do not accumulate duplicates.
- **CAMERA-UI-05:** Main-camera captures include the UI pass; inspection-camera captures exclude it.
- **CAMERA-UI-06:** Exposed UI descendants remain attached, measurable, and verifiable.

Targeted command: `npm run test:camera-ui --workspace definedmotion`.
