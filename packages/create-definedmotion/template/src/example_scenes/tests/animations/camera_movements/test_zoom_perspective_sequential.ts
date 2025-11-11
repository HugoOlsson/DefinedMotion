import * as THREE from 'three'
import { AnimatedScene, HotReloadSetting, SpaceSetting } from '$renderer/lib/scene/sceneClass'
import { zoomCameraToAnim } from '$renderer/lib/animation/animations'

export const test_zoom_perspective_sequential = (): AnimatedScene =>
  new AnimatedScene(1000, 700, SpaceSetting.ThreeDim, HotReloadSetting.TraceFromStart, async (dm) => {
    dm.add(new THREE.GridHelper(40, 40))
    dm.camera.position.set(0, 6, 16)
    dm.camera.lookAt(0, 0, 0)

    const initialFov = (dm.camera as THREE.PerspectiveCamera).fov

    dm.addDeferredAnims(zoomCameraToAnim(dm.camera, { fov: 30 }, 900))
    dm.addDeferredAnims(zoomCameraToAnim(dm.camera, { fov: initialFov }, 900))

    dm.addWait(200)
  })