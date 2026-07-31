import { wait } from 'definedmotion/animation'
import * as THREE from 'three'
import {
  AnimatedScene,
  SpaceSetting,
  defineScene
} from 'definedmotion'
import { createLine, createRectangle } from 'definedmotion/rendering'

export default defineScene({
  id: 'test-layout-check',
  name: 'Layout Check',
  isTest: true,
  create: testLayoutCheck
})

export function testLayoutCheck(): AnimatedScene {
  return new AnimatedScene(
    400,
    200,
    SpaceSetting.TwoDim,
    (scene) => {
      const subject = scene.expose(
        'watched-subject',
        createRectangle(4, 4, { color: '#22d3ee' })
      )
      subject.name = 'Watched subject'
      scene.add(subject)

      const movingObstacle = scene.expose(
        'moving-obstacle',
        createRectangle(4, 4, { color: '#f97316' })
      )
      movingObstacle.name = 'Moving obstacle'
      scene.add(movingObstacle)

      const thinGuide = scene.expose(
        'thin-guide',
        createLine({
          point1: new THREE.Vector3(-5, 0, 0.1),
          point2: new THREE.Vector3(5, 0, 0.1),
          color: '#eab308'
        })
      )
      thinGuide.name = 'Thin guide'
      scene.add(thinGuide)

      const parallelGuide = scene.expose(
        'parallel-guide',
        createLine({
          point1: new THREE.Vector3(-5, 0.5, 0.1),
          point2: new THREE.Vector3(5, 0.5, 0.1),
          color: '#84cc16'
        })
      )
      parallelGuide.name = 'Parallel guide'
      scene.add(parallelGuide)

      const ignoredGroup = new THREE.Group()
      ignoredGroup.add(createRectangle(6, 6, { color: '#a855f7' }))
      scene.add(ignoredGroup)

      const hiddenObstacle = createRectangle(6, 6, { color: '#ef4444' })
      hiddenObstacle.visible = false
      scene.add(hiddenObstacle)

      const transparentObstacle = createRectangle(6, 6, { color: '#ef4444' })
      transparentObstacle.material.opacity = 0
      scene.add(transparentObstacle)

      const farClippedObstacle = scene.expose(
        'far-clipped-obstacle',
        createRectangle(4, 4, { color: '#ef4444' })
      )
      farClippedObstacle.position.z = -2_000
      scene.add(farClippedObstacle)

      scene.watchCollisions('watched-subject', subject, {
        paddingPx: 2,
        ignore: [ignoredGroup]
      })

      scene.onEachTick((frame) => {
        const movingCollision =
          frame <= 9 ||
          (frame >= 129 && frame <= 138) ||
          frame >= 259
        movingObstacle.position.x = movingCollision ? 0 : 20
        thinGuide.visible = frame >= 200 && frame <= 205
        parallelGuide.visible = frame >= 200 && frame <= 205
      })

      scene.addAnims(wait((4_500) / 1000))
    }
  )
}
