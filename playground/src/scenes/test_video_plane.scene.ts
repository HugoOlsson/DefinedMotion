import { defineScene } from 'definedmotion'
import { createVideoPlane } from 'definedmotion/media'
import { AnimatedScene, HotReloadSetting, SpaceSetting } from 'definedmotion'

export default defineScene({
  id: 'test-video-plane',
  name: 'Timeline Video Plane',
  isTest: true,
  create: createVideoPlaneTest
})

export function createVideoPlaneTest(): AnimatedScene {
  return new AnimatedScene(
    720,
    1280,
    SpaceSetting.TwoDim,
    HotReloadSetting.TraceFromStart,
    async (scene) => {
      const video = createVideoPlane(
        scene,
        scene.asset('video/ScreenRecording_07-12-2026 20-12-04_1.MP4'),
        {
          id: 'screen-recording',
          width: 23.92,
          height: 52,
          fit: 'contain'
        }
      )
      video.name = 'timeline-video-plane'
      scene.expose('video-plane', video, {
        description: 'A video plane with embedded audio controlled by the scene timeline',
        tags: ['video', 'audio', 'primary-subject']
      })
      scene.add(video)
      scene.addAnims(await video.playWithAudio())
    }
  )
}
