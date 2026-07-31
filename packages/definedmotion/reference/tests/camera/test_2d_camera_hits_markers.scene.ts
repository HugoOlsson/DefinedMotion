import { wait } from 'definedmotion/animation'
// test_2d_camera_hits_markers.ts
import { defineScene } from 'definedmotion'
import * as THREE from 'three'
import { AnimatedScene, SpaceSetting } from 'definedmotion'
import { moveCameraToAnim } from 'definedmotion/animation'


export default defineScene({
  id: 'test-2d-camera-hits-markers',
  name: '2D Camera Hits Markers',
  isTest: true,
  create: test_2d_camera_hits_markers
})
// tiny helper
const dot = (c: string) => new THREE.Mesh(
  new THREE.CircleGeometry(0.5, 32),
  new THREE.MeshBasicMaterial({ color: c })
)

export function test_2d_camera_hits_markers(): AnimatedScene {
  return new AnimatedScene(1000, 1000, SpaceSetting.TwoDim, async (dm) => {
    // Center crosshair (so we can see when a marker is exactly under the center)
    const horiz = new THREE.Mesh(new THREE.PlaneGeometry(30, 0.1), new THREE.MeshBasicMaterial({ color: '#ffffff' }))
    const vert  = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 30), new THREE.MeshBasicMaterial({ color: '#ffffff' }))
    dm.add(horiz, vert)

    // Markers at precise world coords
    const A = dot('#ef4444'); A.position.set(-8,  6, 0); dm.add(A)
    const B = dot('#3b82f6'); B.position.set(  9, -4, 0); dm.add(B)
    const C = dot('#10b981'); C.position.set(  0,  0, 0); dm.add(C)

    // Start camera (TwoDim => Orthographic camera with fixed Z; we keep its current Z)
    const z = dm.camera.position.z
    dm.camera.position.set(0, 0, z)

    // Move center over A, then B, then C — one deferred call per step (sequential)
    dm.addDeferredAnims(
      moveCameraToAnim(dm.camera, { position: new THREE.Vector3(-8,  6, z) }, 700)
    )
    dm.addDeferredAnims(
      moveCameraToAnim(dm.camera, { position: new THREE.Vector3( 9, -4, z) }, 700)
    )
    dm.addDeferredAnims(
      moveCameraToAnim(dm.camera, { position: new THREE.Vector3( 0,  0, z) }, 700)
    )

    dm.addAnims(wait((400) / 1000))
  })
}
