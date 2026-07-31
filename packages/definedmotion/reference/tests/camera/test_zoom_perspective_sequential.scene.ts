import { camera, wait } from 'definedmotion/animation'
import { defineScene } from 'definedmotion'
import * as THREE from 'three'
import { AnimatedScene, SpaceSetting } from 'definedmotion'


export default defineScene({
  id: 'test-zoom-perspective-sequential',
  name: 'Zoom Perspective Sequential',
  isTest: true,
  create: test_zoom_perspective_sequential
})
export function test_zoom_perspective_sequential(): AnimatedScene {
  return new AnimatedScene(1000, 700, SpaceSetting.ThreeDim, async (dm) => {
    dm.add(new THREE.GridHelper(40, 40))
    dm.camera.position.set(0, 6, 16)
    dm.camera.lookAt(0, 0, 0)

    const initialFov = (dm.camera as THREE.PerspectiveCamera).fov

    dm.addAnims(camera.zoomTo(dm.camera, 30, { duration: 0.9 }))
    dm.addAnims(camera.zoomTo(dm.camera, initialFov, { duration: 0.9 }))

    dm.addAnims(wait((200) / 1000))
  })
}
