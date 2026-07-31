import { wait } from 'definedmotion/animation'
import { defineScene } from 'definedmotion'
import { AnimatedScene, SpaceSetting } from "definedmotion";


export default defineScene({
  id: 'test-long-audio',
  name: 'Long Audio',
  isTest: true,
  create: test_long_audio
})
export function test_long_audio(): AnimatedScene {
    return new AnimatedScene(1000, 1000, SpaceSetting.TwoDim, (dm) => {
        const song = dm.asset('audio/testing_shadow_glow_song.mp3')
        dm.registerAudio(song)
        dm.playAudio(song)

        dm.addAnims(wait((60_000) / 1000))
    })
}
