import * as THREE from 'three'
import { AnimatedScene, SpaceSetting, defineScene } from 'definedmotion'
import {
  fadeIn,
  fadeOut,
  matchTransform,
  moveTo,
  rotateTo,
  scaleIn,
  scaleOut,
  wait
} from 'definedmotion/animation'

export default defineScene({
  id: 'test-core-effects',
  name: 'Core Animation Effects Contract',
  isTest: true,
  create: testCoreEffects
})

export function testCoreEffects(): AnimatedScene {
  return new AnimatedScene(
    600,
    300,
    SpaceSetting.TwoDim,
    (scene) => {
      const fadeBox = exposedBox(scene, 'core-fade', '#38bdf8', -12, 4)
      const scaleBox = exposedBox(scene, 'core-scale', '#a78bfa', -4, 4)
      const moveBox = exposedBox(scene, 'core-move', '#f59e0b', -12, -4)
      const rotateBox = exposedBox(scene, 'core-rotate', '#fb7185', 4, 4, 4, 2)
      const matchBox = exposedBox(scene, 'core-match', '#4ade80', 4, -4)
      const reference = exposedBox(scene, 'core-reference', '#64748b', 12, -4)
      reference.rotation.z = 0.5
      reference.scale.setScalar(1.4)

      scene.addAnims(
        fadeOut(fadeBox, { duration: 0.5 }),
        scaleOut(scaleBox, { duration: 0.5 }),
        moveTo(moveBox, new THREE.Vector3(-4, -4, 0), { duration: 0.5 }),
        rotateTo(rotateBox, new THREE.Euler(0, 0, Math.PI), { duration: 0.5 })
      )

      scene.addAnims(
        fadeIn(fadeBox, { duration: 0.5 }),
        scaleIn(scaleBox, { duration: 0.5, to: 1 }),
        moveTo(moveBox, new THREE.Vector3(-12, -4, 0), { duration: 0.5 }),
        rotateTo(rotateBox, new THREE.Euler(0, 0, 0), { duration: 0.5 })
      )

      scene.do(() => {
        reference.position.x = 10
      })
      scene.addAnims(matchTransform(matchBox, reference, { duration: 0.5 }))
      scene.addAnims(wait(0.25))

      scene.onEachTick(() => {
        fadeBox.text = `visible=${fadeBox.visible}`
        scaleBox.text = `scale=${scaleBox.scale.x.toFixed(3)}`
        moveBox.text = `x=${moveBox.position.x.toFixed(3)}`
        rotateBox.text = `qz=${rotateBox.quaternion.z.toFixed(3)}`
        matchBox.text = `x=${matchBox.position.x.toFixed(3)}`
        reference.text = `x=${reference.position.x.toFixed(3)}`
      })
    }
  )
}

const exposedBox = (
  scene: AnimatedScene,
  id: string,
  color: THREE.ColorRepresentation,
  x: number,
  y: number,
  width = 3,
  height = 3
): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> & { text: string } => {
  const box = scene.expose(
    id,
    new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ color }))
  ) as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> & { text: string }
  box.position.set(x, y, 0)
  box.text = ''
  scene.add(box)
  return box
}
