import { wait } from 'definedmotion/animation'
import * as THREE from 'three'
import { AnimatedScene, Axis, SpaceSetting, defineScene } from 'definedmotion'
import { createFastText } from 'definedmotion/rendering'

export default defineScene({
  id: 'test-transformed-dependency-chain-positioning',
  name: 'Positioning: Transformed 3D Dependency Chain',
  isTest: true,
  create: transformedDependencyChainPositioningScene
})

export function transformedDependencyChainPositioningScene(): AnimatedScene {
  return new AnimatedScene(
    1200,
    800,
    SpaceSetting.ThreeDim,
    async (scene) => {
      scene.scene.background = new THREE.Color('#050b16')

      const anchorRig = new THREE.Group()
      anchorRig.name = 'anchor-rig'
      const middleRig = new THREE.Group()
      middleRig.name = 'middle-rig'
      const endRig = new THREE.Group()
      endRig.name = 'end-rig'
      const depthRig = new THREE.Group()
      depthRig.name = 'depth-rig'

      const anchor = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 3.2, 2.8),
        new THREE.MeshStandardMaterial({ color: '#22d3ee', roughness: 0.3, metalness: 0.3 })
      )
      anchor.name = 'chain-anchor'
      const middle = new THREE.Mesh(
        new THREE.SphereGeometry(1.45, 28, 18),
        new THREE.MeshStandardMaterial({ color: '#f472b6', roughness: 0.32, metalness: 0.2 })
      )
      middle.name = 'chain-middle'
      const end = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.25, 1),
        new THREE.MeshStandardMaterial({ color: '#facc15', roughness: 0.4, metalness: 0.15 })
      )
      end.name = 'chain-end'
      const depth = new THREE.Mesh(
        new THREE.OctahedronGeometry(1.05),
        new THREE.MeshStandardMaterial({ color: '#a78bfa', roughness: 0.3, metalness: 0.25 })
      )
      depth.name = 'chain-depth'

      anchorRig.add(anchor)
      middleRig.add(middle)
      endRig.add(end)
      depthRig.add(depth)
      anchorRig.position.set(-5, -1.5, 0)
      middleRig.position.set(2, -2, 1)
      endRig.position.set(-1, 3, -1)
      depthRig.position.set(2, 1, -3)

      const title = await createFastText('REVERSE-REGISTERED 3D CHAIN', 0.9, 0xf8fafc)
      title.position.set(0, 7.3, 0)

      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(28, 20),
        new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.9 })
      )
      floor.rotation.x = -Math.PI / 2
      floor.position.y = -6

      const keyLight = new THREE.DirectionalLight('#e0f2fe', 3)
      keyLight.position.set(10, 14, 18)
      const fillLight = new THREE.DirectionalLight('#c4b5fd', 1.4)
      fillLight.position.set(-12, 5, 8)
      const ambientLight = new THREE.AmbientLight('#94a3b8', 0.75)

      scene.add(
        anchorRig,
        middleRig,
        endRig,
        depthRig,
        title,
        floor,
        keyLight,
        fillLight,
        ambientLight
      )
      scene.expose('chain-anchor', anchor)
      scene.expose('chain-middle', middle)
      scene.expose('chain-end', end)
      scene.expose('chain-depth', depth)

      const positioning = scene.positioning()
      positioning
        .place(depth)
        .positiveZOf(end, { gap: 1.1 })
        .centerWith(end, { axis: Axis.X })
        .centerWith(end, { axis: Axis.Y })
      positioning
        .place(end)
        .above(middle, { gap: 1.2 })
        .centerWith(middle, { axis: Axis.X })
        .centerWith(middle, { axis: Axis.Z })
      positioning
        .place(middle)
        .rightOf(anchor, { gap: 1.5 })
        .centerWith(anchor, { axis: Axis.Y })
        .centerWith(anchor, { axis: Axis.Z })

      scene.onEachTick((tick) => {
        anchorRig.position.x = -5 + Math.sin(tick * 0.017) * 1.4
        anchorRig.position.y = -1 + Math.cos(tick * 0.019) * 0.7
        anchorRig.rotation.y = Math.sin(tick * 0.015) * 0.48
        anchorRig.rotation.z = Math.sin(tick * 0.011) * 0.18
        anchorRig.scale.set(
          0.9 + Math.sin(tick * 0.023) * 0.12,
          1 + Math.cos(tick * 0.021) * 0.15,
          1
        )

        middleRig.rotation.z = Math.sin(tick * 0.018) * 0.42
        middleRig.scale.set(1.1, 0.82 + Math.sin(tick * 0.025) * 0.16, 0.95)
        endRig.rotation.x = Math.sin(tick * 0.014) * 0.5
        endRig.rotation.y = Math.cos(tick * 0.016) * 0.36
        endRig.scale.setScalar(0.9 + Math.sin(tick * 0.027) * 0.13)
        depthRig.rotation.y = Math.sin(tick * 0.02) * 0.55
        depthRig.scale.z = 0.85 + Math.cos(tick * 0.024) * 0.18
      })

      scene.camera.position.set(8, 6, 20)
      scene.camera.lookAt(0, 1, 0)
      scene.addAnims(wait((6_000) / 1000))
    }
  )
}
