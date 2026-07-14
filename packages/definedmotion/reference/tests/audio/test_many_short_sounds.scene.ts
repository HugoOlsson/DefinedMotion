


import { defineScene } from 'definedmotion'
import { easeLinear } from 'definedmotion/animation'
import { createAnim } from 'definedmotion/animation'
import { createRectangle } from 'definedmotion/rendering'
import { AnimatedScene, HotReloadSetting, SpaceSetting } from 'definedmotion'
import * as THREE from 'three'


export default defineScene({
  id: 'test-many-short-sounds',
  name: 'Many Short Sounds',
  isTest: true,
  create: test_many_short_sounds
})
const slideColors = [
  '#3D6680',
  '#2F6666',
  '#2F3D66',
  '#592659',
  '#3D2F66',
  '#2F665C',
  '#5C662F',
  '#66332F',
  '#3D2F66',
  '#2F4D66'
]

export function test_many_short_sounds(): AnimatedScene {
  return new AnimatedScene(
    1000,
    1000,
    SpaceSetting.TwoDim,
    HotReloadSetting.BeginFromCurrent,
    async (scene) => {
      const tickSound = scene.asset('audio/tick_sound.mp3')
      const background = createRectangle(200, 200)
      scene.add(background)
      scene.registerAudio(tickSound)

      let lastIndex
      const switchAnimation = createAnim(easeLinear(0, 0.999, slideColors.length * 300), (value) => {
        const index = Math.floor(value * slideColors.length)

        if (index !== lastIndex) {
          lastIndex = index
          background.material.color = new THREE.Color(slideColors[index])
          scene.playAudio(tickSound)
        }
      })

      scene.addAnims(switchAnimation)
    }
  )

}
