import { AnimatedScene, SpaceSetting, defineScene } from 'definedmotion'
import { moveTo } from 'definedmotion/animation'
import { createRectangle } from 'definedmotion/rendering'
import * as THREE from 'three'

export default defineScene({
  id: 'test-viewer-preview',
  name: 'Viewer Preview Boundary',
  isTest: true,
  create: testViewerPreview
})

export function testViewerPreview(): AnimatedScene {
  return new AnimatedScene(
    320,
    180,
    SpaceSetting.TwoDim,
    (scene) => {
      scene.timeline.defineBeats({
        setup: { start: 0, end: 2 },
        preview: { start: 2, end: 5 }
      })

      const card = createRectangle(12, 8, { color: '#2563eb' })
      card.position.x = -10
      scene.add(card)
      scene.expose('preview-card', card, { role: 'subject' })

      scene.timeline.beat('setup', () => {
        scene.addAnims(
          moveTo(card, new THREE.Vector3(0, 0, 0), { duration: 2 / scene.fps })
        )
      })
      scene.timeline.beat('preview', () => {
        scene.previewFromHere()
        scene.addAnims(
          moveTo(card, new THREE.Vector3(10, 0, 0), { duration: 3 / scene.fps })
        )
      })
    }
  )
}
