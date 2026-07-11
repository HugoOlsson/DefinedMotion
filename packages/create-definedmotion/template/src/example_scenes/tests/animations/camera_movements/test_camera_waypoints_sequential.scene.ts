import { defineScene } from '../../../../project'
import { moveCameraToAnim } from "$renderer/lib/animation/animations";
import { AnimatedScene, HotReloadSetting, SpaceSetting } from "$renderer/lib/scene/sceneClass";
import * as THREE from 'three'




export default defineScene({
  id: 'test-camera-waypoints-sequential',
  name: 'Camera Waypoints Sequential',
  isTest: true,
  create: test_camera_waypoints_sequential
})
export function test_camera_waypoints_sequential(): AnimatedScene {
  return new AnimatedScene(1200, 800, SpaceSetting.ThreeDim, HotReloadSetting.TraceFromStart, async (dm) => {
    dm.add(new THREE.GridHelper(40, 40))

    // Visual markers
    const red = new THREE.Mesh(new THREE.SphereGeometry(1.2),  new THREE.MeshBasicMaterial({ color: '#ef4444' }))
    const blue = new THREE.Mesh(new THREE.BoxGeometry(2,2,2),  new THREE.MeshBasicMaterial({ color: '#3b82f6' }))
    const green = new THREE.Mesh(new THREE.ConeGeometry(1.2,2,32), new THREE.MeshBasicMaterial({ color: '#10b981' }))
    red.position.set(-8, 0, 0); blue.position.set(8, 0, 0); green.position.set(0, 0, -12)
    dm.add(red, blue, green)

    // Start camera
    dm.camera.position.set(0, 8, 16)
    dm.camera.lookAt(0, 0, 0)

    // SEQUENTIAL: one call per addDeferredAnims
    dm.addDeferredAnims(moveCameraToAnim(dm.camera, { position: new THREE.Vector3(-8, 6, 14) }, 900))
    dm.addDeferredAnims(moveCameraToAnim(dm.camera, { position: new THREE.Vector3(  8, 6, 14) }, 900))
    dm.addDeferredAnims(moveCameraToAnim(dm.camera, { position: new THREE.Vector3(  0, 7, 10) }, 900))

    dm.addWait(400)
  })
}
