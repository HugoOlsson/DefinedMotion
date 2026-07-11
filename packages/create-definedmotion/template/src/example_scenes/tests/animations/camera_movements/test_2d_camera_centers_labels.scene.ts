// test_2d_camera_centers_labels.ts
import { defineScene } from '../../../../project'
import * as THREE from 'three'
import { AnimatedScene, HotReloadSetting, SpaceSetting } from '$renderer/lib/scene/sceneClass'
import { moveCameraToAnim } from '$renderer/lib/animation/animations'


export default defineScene({
  id: 'test-2d-camera-centers-labels',
  name: '2D Camera Centers Labels',
  isTest: true,
  create: test_2d_camera_centers_labels
})
function labeledSquare(text: string, color: string) {
  const g = new THREE.Group()
  const rect = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ color }))

  g.add(rect)
  return g
}

export function test_2d_camera_centers_labels(): AnimatedScene {
  return new AnimatedScene(1500, 1500, SpaceSetting.TwoDim, HotReloadSetting.TraceFromStart, async (dm) => {
    // faint grid background
    for (let x = -12; x <= 12; x += 3) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 30), new THREE.MeshBasicMaterial({ color: '#6b7280', transparent: true, opacity: 0.7}))
      line.position.set(x, 0, -0.1); dm.add(line)
    }
    for (let y = -12; y <= 12; y += 3) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(30, 0.02), new THREE.MeshBasicMaterial({ color: '#6b7280', transparent: true, opacity: 0.7 }))
      line.position.set(0, y, -0.1); dm.add(line)
    }

    // center crosshair
    const h = new THREE.Mesh(new THREE.PlaneGeometry(30, 0.03), new THREE.MeshBasicMaterial({ color: '#ffffff' }))
    const v = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 30), new THREE.MeshBasicMaterial({ color: '#ffffff' }))
    dm.add(h, v)

    // squares at exact grid points
    const S1 = labeledSquare('A', '#f97316'); S1.position.set(-6,  6, 0); dm.add(S1)
    const S2 = labeledSquare('B', '#22c55e'); S2.position.set( 6,  6, 0); dm.add(S2)
    const S3 = labeledSquare('C', '#3b82f6'); S3.position.set( 6, -6, 0); dm.add(S3)
    const S4 = labeledSquare('D', '#ef4444'); S4.position.set(-6, -6, 0); dm.add(S4)


    dm.camera.zoom *= 1.5

    const z = dm.camera.position.z
    dm.camera.position.set(0, 0, z)

    const zOffset = new THREE.Vector3(0,0,z)

    dm.camera.position.copy(S1.position.clone().add(zOffset))

    // center camera over each square in clockwise order
    dm.addDeferredAnims( moveCameraToAnim(dm.camera, { position: S2.position.clone().add(zOffset) }, 600) )
    dm.addDeferredAnims( moveCameraToAnim(dm.camera, { position: S3.position.clone().add(zOffset) }, 600) )
    dm.addDeferredAnims( moveCameraToAnim(dm.camera, { position: S4.position.clone().add(zOffset) }, 600) )
    dm.addDeferredAnims( moveCameraToAnim(dm.camera, { position: S1.position.clone().add(zOffset) }, 600) )

  })
}
