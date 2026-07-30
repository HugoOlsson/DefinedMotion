import * as THREE from 'three'
import {
  AnimatedScene,
  defineScene,
  HotReloadSetting,
  SceneRuntimeError,
  SpaceSetting
} from 'definedmotion'

export default defineScene({
  id: 'test-camera-attached-overlay-rebuild',
  name: 'Camera-attached Overlay Rebuild',
  isTest: true,
  create: testCameraAttachedOverlayRebuild
})

export function testCameraAttachedOverlayRebuild(): AnimatedScene {
  return new AnimatedScene(
    320,
    180,
    SpaceSetting.TwoDim,
    HotReloadSetting.TraceFromStart,
    (scene) => {
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
      scene.camera.add(overlay)
      scene.scene.add(scene.camera)
      scene.addWait(1000)
    }
  )
}
