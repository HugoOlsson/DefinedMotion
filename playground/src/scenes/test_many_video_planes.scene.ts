import * as THREE from 'three'
import { defineScene } from 'definedmotion'
import { createVideoPlane } from 'definedmotion/media'
import { AnimatedScene, SpaceSetting } from 'definedmotion'

const COLUMNS = 4
const ROWS = 3
const VIDEO_COUNT = COLUMNS * ROWS

export default defineScene({
  id: 'test-many-video-planes',
  name: 'Many Timeline Video Planes',
  isTest: true,
  create: createManyVideoPlanesTest
})

export function createManyVideoPlanesTest(): AnimatedScene {
  return new AnimatedScene(
    1280,
    720,
    SpaceSetting.TwoDim,
    async (scene) => {
      scene.scene.background = new THREE.Color(0x111318)
      const videos = Array.from({ length: VIDEO_COUNT }, (_, index) =>
        createVideoPlane(
          scene,
          scene.asset('video/ScreenRecording_07-12-2026 20-12-04_1.MP4'),
          {
            id: `grid-video-${index}`,
            width: 7.4,
            height: 16,
            fit: 'contain'
          }
        )
      )

      videos.forEach((video, index) => {
        const column = index % COLUMNS
        const row = Math.floor(index / COLUMNS)
        video.position.set((column - 1.5) * 18, (1 - row) * 18, 0)
      })

      scene.expose('video-grid-anchor', videos[0], {
        description: 'The first of twelve independently timed video planes',
        tags: ['video', 'performance-test'],
        data: { videoCount: VIDEO_COUNT }
      })
      scene.add(...videos)
      scene.addAnims(
        ...videos.map((video, index) =>
          video.play(11, {
            sourceStartMs: (index % COLUMNS) * 750,
            loop: true
          })
        )
      )
    }
  )
}
