import { wait } from 'definedmotion/animation'
import * as THREE from 'three'
import { AnimatedScene, Axis, SpaceSetting, defineScene } from 'definedmotion'
import { createText } from 'definedmotion/rendering'

export default defineScene({
  id: 'test-dynamic-bounds-positioning',
  name: 'Positioning: Dynamic Bounds and Shape Changes',
  isTest: true,
  create: dynamicBoundsPositioningScene
})

export function dynamicBoundsPositioningScene(): AnimatedScene {
  return new AnimatedScene(
    1200,
    800,
    SpaceSetting.ThreeDim,
    async (scene) => {
      scene.scene.background = new THREE.Color('#07111f')

      const shapes: THREE.BufferGeometry[] = [
        new THREE.BoxGeometry(6, 3, 1.4),
        new THREE.CylinderGeometry(2.4, 2.4, 4.8, 32),
        new THREE.SphereGeometry(2.35, 32, 20)
      ]
      const subject = new THREE.Mesh(
        shapes[0],
        new THREE.MeshStandardMaterial({
          color: '#0ea5e9',
          roughness: 0.32,
          metalness: 0.25
        })
      )
      subject.name = 'shape-changing-subject'

      const title = await createText({ text: 'EXACT ABOVE', fontSize: 0.8, color: 0xf8fafc })
      title.name = 'dynamic-title'
      const status = await createText({ text: 'RANGED RIGHT', fontSize: 0.72, color: 0xfbbf24 })
      status.name = 'dynamic-status'
      const detail = await createText({ text: 'CHAINED DETAIL', fontSize: 0.55, color: 0xfde68a })
      detail.name = 'dynamic-detail'
      const leftPin = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.62),
        new THREE.MeshBasicMaterial({ color: '#f472b6' })
      )
      leftPin.name = 'dynamic-left-pin'

      const measuredBounds = new THREE.Box3()
      const boundsHelper = new THREE.Box3Helper(measuredBounds, new THREE.Color('#67e8f9'))
      boundsHelper.name = 'dynamic-bounds-helper'

      const keyLight = new THREE.DirectionalLight('#e0f2fe', 3.2)
      keyLight.position.set(8, 12, 16)
      const fillLight = new THREE.DirectionalLight('#c4b5fd', 1.4)
      fillLight.position.set(-10, 3, 8)
      const ambientLight = new THREE.AmbientLight('#94a3b8', 0.8)

      scene.add(
        subject,
        title,
        status,
        detail,
        leftPin,
        boundsHelper,
        keyLight,
        fillLight,
        ambientLight
      )
      scene.expose('dynamic-subject', subject, {
        description: 'Moving object whose geometry, scale, and world-aligned bounds change'
      })
      scene.expose('dynamic-title', title)
      scene.expose('dynamic-status', status)
      scene.expose('dynamic-detail', detail)
      scene.expose('dynamic-left-pin', leftPin)

      const positioning = scene.positioning()
      positioning
        .place(detail)
        .below(status, { gap: 0.65 })
        .centerWith(status, { axis: Axis.X })
        .centerWith(status, { axis: Axis.Z })
      positioning
        .place(status)
        .rightOf(subject, { gap: { initial: 1.8, range: [1.2, 2.5] } })
        .centerWith(subject, { axis: Axis.Y })
        .centerWith(subject, { axis: Axis.Z })
      positioning
        .place(title)
        .above(subject, { gap: 0.9 })
        .centerWith(subject, { axis: Axis.X })
        .centerWith(subject, { axis: Axis.Z })
      positioning
        .place(leftPin)
        .leftOf(subject, { gap: 1.1 })
        .centerWith(subject, { axis: Axis.Y })
        .centerWith(subject, { axis: Axis.Z })

      scene.onEachTick((tick) => {
        subject.geometry = shapes[Math.floor(tick / 90) % shapes.length]
        subject.position.x = Math.sin(tick * 0.021) * 2.2
        subject.position.y = Math.cos(tick * 0.017) * 0.9
        subject.rotation.x = Math.sin(tick * 0.013) * 0.22
        subject.rotation.z = Math.sin(tick * 0.019) * 0.38
        subject.scale.x = 0.82 + (Math.sin(tick * 0.031) + 1) * 0.22
        subject.scale.y = 0.88 + (Math.cos(tick * 0.027) + 1) * 0.18

        subject.updateWorldMatrix(true, false)
        measuredBounds.setFromObject(subject)
      })

      scene.camera.position.set(0, 1, 19)
      scene.camera.lookAt(0, 0, 0)
      scene.addAnims(wait((6_000) / 1000))
    }
  )
}
