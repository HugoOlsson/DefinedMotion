import * as THREE from 'three'
import { AnimatedScene, SpaceSetting, defineScene } from 'definedmotion'
import type { AnimationPlan } from 'definedmotion/animation'
import { createRectangle } from 'definedmotion/rendering'

export default defineScene({
  id: 'test-animation-plan',
  name: 'Animation Plan Contract',
  isTest: true,
  create: testAnimationPlan
})

export function testAnimationPlan(): AnimatedScene {
  return new AnimatedScene(
    400,
    200,
    SpaceSetting.TwoDim,
    (scene) => {
      const box = scene.expose(
        'animation-plan-box',
        createRectangle(4, 4, { color: '#22d3ee' })
      ) as unknown as THREE.Object3D & { text: string }
      box.position.x = -6
      box.text = 'x=-6.000'
      scene.add(box)

      const destination = new THREE.Vector3(0, 0, 0)
      scene.addAnims(moveTo(box, destination, 0.5))

      const secondStart = scene.getTimelinePointer()
      scene.do(() => {
        destination.x = 6
      })
      scene.addAnims(moveTo(box, destination, 0.5))
      const resumeAt = scene.getTimelinePointer()

      const pulse = scene.expose(
        'animation-plan-parallel',
        createRectangle(1.5, 1.5, { color: '#f59e0b' })
      )
      pulse.position.set(0, -5, 0)
      scene.add(pulse)
      scene.setTimelinePointer(secondStart)
      scene.addAnims({
        duration: 0.25,
        easing: 'ease-out',
        bind() {
          const from = pulse.scale.x
          return {
            update({ easedProgress }) {
              const scale = from + easedProgress
              pulse.scale.setScalar(scale)
            }
          }
        }
      })
      scene.setTimelinePointer(resumeAt)

      scene.onEachTick(() => {
        box.text = `x=${box.position.x.toFixed(3)}`
      })
    }
  )
}

const moveTo = (
  object: THREE.Object3D,
  target: THREE.Vector3,
  duration: number
): AnimationPlan => ({
  duration,
  easing: 'linear' as const,
  bind() {
    const from = object.position.clone()
    const to = target.clone()
    return {
      update({ easedProgress }) {
        object.position.lerpVectors(from, to, easedProgress)
      }
    }
  }
})
