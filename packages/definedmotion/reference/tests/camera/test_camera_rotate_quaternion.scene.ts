import { camera, wait } from 'definedmotion/animation'
import { defineScene } from 'definedmotion'
import * as THREE from 'three'
import { AnimatedScene, SpaceSetting } from 'definedmotion'


export default defineScene({
  id: 'test-camera-rotate-quaternion',
  name: 'Camera Rotate Quaternion',
  isTest: true,
  create: test_camera_rotate_quaternion
})
export function test_camera_rotate_quaternion(): AnimatedScene {
  return new AnimatedScene(1000, 800, SpaceSetting.ThreeDim, async (dm) => {
    dm.add(new THREE.AxesHelper(6))
    dm.camera.position.set(0, 4, 10)

    const yawRight = new THREE.Quaternion().setFromEuler(new THREE.Euler(0,  Math.PI/4, 0))
    const pitchDown = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/6, 0, 0))

    dm.addAnims(camera.rotateTo(dm.camera, yawRight, { duration: 0.8 }))
    dm.addAnims(camera.rotateTo(dm.camera, pitchDown, { duration: 0.8 }))

    dm.addAnims(wait((300) / 1000))
  })
}
