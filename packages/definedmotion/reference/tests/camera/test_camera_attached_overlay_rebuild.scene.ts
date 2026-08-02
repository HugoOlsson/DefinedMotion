import { wait } from 'definedmotion/animation'
import * as THREE from 'three'
import { AnimatedScene, defineScene, SceneRuntimeError, SpaceSetting } from 'definedmotion'

export default defineScene({
  id: 'test-camera-attached-overlay-rebuild',
  name: 'Camera-attached Overlay Rebuild',
  isTest: true,
  create: testCameraAttachedOverlayRebuild
})

export function testCameraAttachedOverlayRebuild(): AnimatedScene {
  return new AnimatedScene(320, 180, SpaceSetting.TwoDim, (scene) => {
    if (scene.camera.children.length !== 0) {
      throw new SceneRuntimeError(
        'CAMERA_CHILDREN_RETAINED',
        `Scene rebuild retained ${scene.camera.children.length} camera-attached objects`
      )
    }

    const overlay = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 12),
      new THREE.MeshBasicMaterial({ color: '#22d3ee' })
    )
    overlay.position.set(0, 0, -10)
    const worldOccluder = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 50),
      new THREE.MeshBasicMaterial({ color: '#ef476f' })
    )
    worldOccluder.position.z = 25
    scene.add(worldOccluder)
    scene.addCameraAttachedUI(overlay)
    scene.expose('camera-ui-rebuild-overlay', overlay)
    scene.exposeCamera(
      'world-only',
      scene.camera.clone(false) as THREE.PerspectiveCamera | THREE.OrthographicCamera,
      { description: 'Matches the audience pose but intentionally excludes audience UI' }
    )
    scene.addAnims(wait(1000 / 1000))
  })
}
