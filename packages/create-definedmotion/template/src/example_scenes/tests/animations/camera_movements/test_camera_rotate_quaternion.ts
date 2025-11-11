import * as THREE from 'three'
import { AnimatedScene, HotReloadSetting, SpaceSetting } from '$renderer/lib/scene/sceneClass'
import { rotateCameraToAnim } from '$renderer/lib/animation/animations'

export const test_camera_rotate_quaternion = (): AnimatedScene =>
  new AnimatedScene(1000, 800, SpaceSetting.ThreeDim, HotReloadSetting.TraceFromStart, async (dm) => {
    dm.add(new THREE.AxesHelper(6))
    dm.camera.position.set(0, 4, 10)

    const yawRight = new THREE.Quaternion().setFromEuler(new THREE.Euler(0,  Math.PI/4, 0))
    const pitchDown = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/6, 0, 0))

    dm.addDeferredAnims(rotateCameraToAnim(dm.camera, { rotation: yawRight }, 800))
    dm.addDeferredAnims(rotateCameraToAnim(dm.camera, { rotation: pitchDown }, 800))

    dm.addWait(300)
  })