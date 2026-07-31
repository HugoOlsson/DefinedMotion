import * as THREE from 'three'
import { AnimatedScene, HotReloadSetting, SpaceSetting, defineScene } from 'definedmotion'
import type { AnimationPlan } from 'definedmotion/animation'
import { createRectangle } from 'definedmotion/rendering'

export default defineScene({
  id: 'test-timeline-beats',
  name: 'Timeline Beats Contract',
  isTest: true,
  create: testTimelineBeats
})

export function testTimelineBeats(): AnimatedScene {
  return new AnimatedScene(
    400,
    200,
    SpaceSetting.TwoDim,
    HotReloadSetting.TraceFromStart,
    (scene) => {
      const box = scene.expose(
        'timeline-beat-box',
        createRectangle(4, 4, { color: '#38bdf8' })
      ) as THREE.Object3D & { text: string }
      box.position.x = -6
      box.scale.setScalar(0.5)
      box.text = 'unstarted'
      scene.add(box)

      const pointerMarker = scene.expose(
        'timeline-beat-pointer',
        createRectangle(1, 1, { color: '#f59e0b' })
      ) as THREE.Object3D & { text: string }
      pointerMarker.position.set(0, -5, 0)
      scene.add(pointerMarker)

      scene.timeline.defineBeats({
        intro: { start: 0, end: 20 },
        move: { start: 20, end: 50 },
        hold: { start: 60, end: 75 }
      })

      scene.setTimelinePointer(7)

      // Authored out of chronological order to verify that beat ranges own placement.
      scene.timeline.beat('move', (beat) => {
        const target = new THREE.Vector3(6, 0, 0)
        scene.addAnims(moveTo(box, target, 0.5))
        beat.onEachTick(({ localFrame, beatProgress }) => {
          box.text = `move:${localFrame}:${beatProgress.toFixed(2)}`
        })
      })

      scene.timeline.beat('intro', (beat) => {
        scene.addAnims(scaleTo(box, 1, 20 / scene.fps))
        beat.onEachTick(({ localFrame, beatProgress }) => {
          box.text = `intro:${localFrame}:${beatProgress.toFixed(2)}`
        })
      })

      scene.timeline.beat('hold', (beat) => {
        beat.onEachTick(({ localFrame, beatProgress }) => {
          box.text = `hold:${localFrame}:${beatProgress.toFixed(2)}`
        })
      })

      pointerMarker.text = `pointer=${scene.getTimelinePointer()}`
    }
  )
}

const moveTo = (
  object: THREE.Object3D,
  target: THREE.Vector3,
  duration: number
): AnimationPlan => ({
  duration,
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

const scaleTo = (
  object: THREE.Object3D,
  target: number,
  duration: number
): AnimationPlan => ({
  duration,
  bind() {
    const from = object.scale.x
    return {
      update({ easedProgress }) {
        const scale = from + (target - from) * easedProgress
        object.scale.setScalar(scale)
      }
    }
  }
})
