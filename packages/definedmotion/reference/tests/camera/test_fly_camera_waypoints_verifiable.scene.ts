// test_fly_minimal_two_poses.ts
import { defineScene } from 'definedmotion'
import * as THREE from 'three'
import { AnimatedScene, HotReloadSetting, SpaceSetting } from 'definedmotion'
import { flyCameraToAnim } from 'definedmotion/animation'


export default defineScene({
  id: 'test-fly-minimal-two-poses',
  name: 'Fly Minimal Two Poses',
  isTest: true,
  create: test_fly_minimal_two_poses
})
// ======================
// === EDIT HERE ========
// Marker positions (sphere & cube)
const SPHERE_POS = new THREE.Vector3(-6, 0, -6)
const CUBE_POS   = new THREE.Vector3( 6, 0, -6)




// Camera pose A (position + quaternion)
const CAM_A_POS  = new THREE.Vector3(-8.478426, 
  2.932849, 
  -1.628103)

// Example: look slightly right & down
const CAM_A_QUAT = new THREE.Quaternion(-0.2782336, 
  -0.2736528, 
  -0.08303509, 
  0.9169544)

// Camera pose B (position + quaternion)
const CAM_B_POS  = new THREE.Vector3( 9.855000, 
  2.759370, 
  -1.223401)
// Example: look slightly left & down
const CAM_B_QUAT = new THREE.Quaternion(  -0.2497320, 
  0.3230065, 
  0.08878684, 
  0.9085250)
// ======================

export function test_fly_minimal_two_poses(): AnimatedScene {
  return new AnimatedScene(1200, 800, SpaceSetting.ThreeDim, HotReloadSetting.TraceFromStart, async (dm) => {
    // Grid floor
    dm.add(new THREE.GridHelper(60, 60))

    // Sphere marker
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 16),
      new THREE.MeshBasicMaterial({ color: '#3b82f6' })
    )
    sphere.position.copy(SPHERE_POS)
    dm.add(sphere)

    // Cube marker
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2),
      new THREE.MeshBasicMaterial({ color: '#ef4444' })
    )
    cube.position.copy(CUBE_POS)
    dm.add(cube)


    const startPos = new THREE.Vector3(0, 6, 18)
    // Start camera (anything reasonable)
    dm.camera.position.copy(startPos)
    dm.camera.lookAt(0, 0, 0)

    // Leg 1: fly to CAM_A
    dm.addDeferredAnims(
      flyCameraToAnim(dm.camera, { position: CAM_A_POS, rotation: CAM_A_QUAT }, 1000)
    )

    // Small pause to inspect
    dm.addWait(200)

    // Leg 2: fly to CAM_B
    dm.addDeferredAnims(
      flyCameraToAnim(dm.camera, { position: CAM_B_POS, rotation: CAM_B_QUAT }, 1000)
    )

    dm.addWait(200)

    const from = startPos.clone()
    const target = new THREE.Vector3(0, 0, 0)
    const m = new THREE.Matrix4().lookAt(from, target, new THREE.Vector3(0, 1, 0))
    const q = new THREE.Quaternion().setFromRotationMatrix(m)

    dm.addDeferredAnims(
      flyCameraToAnim(dm.camera, { position: startPos, rotation: q}, 1000)
    )
  })
}
