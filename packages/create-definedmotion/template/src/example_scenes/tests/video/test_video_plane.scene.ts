import { defineScene } from '../../../project'
import { createVideoPlane } from '$renderer/lib/rendering/video'
import { AnimatedScene, HotReloadSetting, SpaceSetting } from '$renderer/lib/scene/sceneClass'

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
        scene.asset('for_tests/video/ScreenRecording_07-12-2026 20-12-04_1.MP4'),
        {
          id: 'screen-recording',
          width: 23.92,
          height: 52,
          fit: 'contain'
        }
      )
      video.name = 'timeline-video-plane'
      scene.expose('video-plane', video, {
        description: 'A video plane controlled by a normal DefinedMotion animation',
        tags: ['video', 'primary-subject']
      })
      scene.add(video)
      scene.addAnims(video.play(11_000).scaleLength(0.1))
    }
  )
}
