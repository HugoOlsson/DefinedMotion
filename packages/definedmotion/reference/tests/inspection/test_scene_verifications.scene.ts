import { AnimatedScene, HotReloadSetting, SpaceSetting, defineScene } from 'definedmotion'
import { moveTo } from 'definedmotion/animation'
import { createRectangle } from 'definedmotion/rendering'
import * as THREE from 'three'

export default defineScene({
  id: 'test-scene-verifications',
  name: 'Scene Verification Contract',
  isTest: true,
  create: testSceneVerifications
})

export function testSceneVerifications(): AnimatedScene {
  return new AnimatedScene(
    320,
    180,
    SpaceSetting.TwoDim,
    HotReloadSetting.TraceFromStart,
    async (scene) => {
      scene.timeline.defineBeats({
        intro: { start: 0, end: 3 },
        move: { start: 3, end: 6 }
      })

      const panel = createRectangle(30, 16, { color: '#1e293b' })
      const content = createRectangle(10, 4, { color: '#38bdf8' })
      const offscreen = createRectangle(2, 2, { color: '#f97316' })
      offscreen.position.x = 80
      const hiddenParent = new THREE.Group()
      hiddenParent.visible = false
      const hiddenChild = createRectangle(1, 1, { color: '#ffffff' })
      hiddenParent.add(hiddenChild)
      scene.add(panel, content, offscreen, hiddenParent)

      scene.timeline.beat('move', () => {
        scene.addAnims(moveTo(content, new THREE.Vector3(5, 0, 0), { duration: 3 / scene.fps }))
      })

      const movementStart = 3
      const movementEnd = 6
      scene.verify(
        'panel-padding',
        { during: 'move', frames: { start: movementStart, end: movementEnd } },
        (context) => {
          const contentBounds = context.screenBounds(content)
          const panelBounds = context.screenBounds(panel)
          context.assert(
            contentBounds !== null &&
              panelBounds !== null &&
              contentBounds.left >= panelBounds.left + 15 &&
              contentBounds.right <= panelBounds.right - 15 &&
              contentBounds.top >= panelBounds.top + 15 &&
              contentBounds.bottom <= panelBounds.bottom - 15,
            'Content must remain 15px inside the panel',
            { contentBounds, panelBounds, requiredMargin: 15 }
          )
        }
      )

      scene.verify('measurement-semantics', {}, (context) => {
        const outside = context.screenBounds(offscreen)
        context.assert(
          outside !== null && outside.left > context.viewport.width,
          'Bounds are unclipped'
        )
        context.assert(
          !context.isVisibleInHierarchy(hiddenChild),
          'Ancestor visibility is respected'
        )
        context.assert(!context.worldBounds(content).isEmpty(), 'World bounds include geometry')
      })

      scene.verify(
        'intentional-failure',
        { during: 'move', frames: { start: 4, end: 6 } },
        (context) => {
          context.assert(context.globalFrame !== 4, 'Intentional contract failure', {
            observedFrame: context.globalFrame
          })
        }
      )
    }
  )
}
