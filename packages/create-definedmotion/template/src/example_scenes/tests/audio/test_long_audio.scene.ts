import { defineScene } from '../../../project'
import { AnimatedScene, HotReloadSetting, SpaceSetting } from "$renderer/lib/scene/sceneClass";
import song from '$assets/audio/testing_shadow_glow_song.mp3'


export default defineScene({
  id: 'test-long-audio',
  name: 'Long Audio',
  isTest: true,
  create: test_long_audio
})
export function test_long_audio(): AnimatedScene {
    return new AnimatedScene(1000, 1000, SpaceSetting.TwoDim, HotReloadSetting.TraceFromStart, (dm) => {
        dm.registerAudio(song)
        dm.playAudio(song)

        dm.addWait(60_000)
    })
}
