import { defineScene } from '../project'
import { easeLinear } from '../renderer/src/lib/animation/interpolations'
import { createAnim } from '../renderer/src/lib/animation/protocols'
import {
  createFastText,
  createRectangle,
  updateText
} from '../renderer/src/lib/rendering/objects2d'
import { AnimatedScene, HotReloadSetting, SpaceSetting } from '../renderer/src/lib/scene/sceneClass'
import * as THREE from 'three'


export default defineScene({
  id: 'alternatives',
  name: 'Alternatives',
  create: alternativesScene
})
let alternatives = [
  'Inledande matematisk analys',
  'Linjär algebra',
  'Fysikingenjörens verktyg',
  'Matematisk analys, fortsättning',
  'Mekanik 1',
  'Programmeringsteknik och numerisk analys',
  'Flervariabelanalys',
  'Sannolikhet och statistik',
  'Mekanik 2',
  'Komplex analys',
  'Experimentell fysik 1',
  'Elektriska kretsar och system',
  'Vektorfält och elektromagnetisk fältteori',
  'Reglerteknik F',
  'Bayesiansk inferens och maskininlärning',
  'Fourieranalys',
  'Optik',
  'Kontinuummekanik',
  'Termodynamik och statistisk mekanik',
  'Kvantfysik',
  'Datastrukturer och algoritmer',
  'Experimentell fysik 2',
  'Fasta tillståndets fysik',
  'Subatomär fysik',
  'Miljöfysik',
  'Algoritmer',
  'Logik för datavetenskap',
  'Introduktion till data science och AI',
  'Programspråk',
  'Design av AI-system',
  'Algoritmer för maskininlärning och slutledning',
  'Beräkningsmetoder för storskaliga data',
  'Kompilatorkonstruktion'
]

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

export function alternativesScene(): AnimatedScene {
  return new AnimatedScene(
    1000,
    1000,
    SpaceSetting.TwoDim,
    HotReloadSetting.BeginFromCurrent,
    async (scene) => {
      const tickSound = scene.asset('audio/tick_sound.mp3')
      const background = createRectangle(200, 200)
      const textElement = await createFastText('', 1.5)
      scene.add(background, textElement)
      scene.registerAudio(tickSound)

      let lastIndex
      const switchAnimation = createAnim(easeLinear(0, 1, alternatives.length * 300), (value) => {
        const index = Math.floor(value * alternatives.length)

        if (index !== lastIndex) {
          lastIndex = index
          background.material.color = new THREE.Color(slideColors[index % slideColors.length])
          updateText(textElement, alternatives[index % alternatives.length])
          scene.playAudio(tickSound)
        }
      })

      scene.addAnims(switchAnimation)
    }
  )
}
