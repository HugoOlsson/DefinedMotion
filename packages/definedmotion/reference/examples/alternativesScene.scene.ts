import { defineScene } from 'definedmotion'
import { wait } from 'definedmotion/animation'
import {
  createText,
  createRectangle
} from 'definedmotion/rendering'
import { AnimatedScene, SpaceSetting } from 'definedmotion'
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
    async (scene) => {
      const tickSound = scene.asset('audio/tick_sound.mp3')
      const background = scene.expose('background', createRectangle(200, 200), {
        description: 'Full-frame color field behind the current course name',
        tags: ['background', 'dynamic-color']
      })
      const textElement = scene.expose('course-name', await createText({ text: '', fontSize: 1.5 }), {
        description: 'The course name currently shown in the center of the frame',
        tags: ['text', 'primary-subject', 'dynamic']
      })
      scene.add(background, textElement)
      scene.registerAudio(tickSound)

      for (let index = 0; index < alternatives.length; index++) {
        scene.do(async () => {
          background.material.color = new THREE.Color(slideColors[index % slideColors.length])
          await textElement.setText(alternatives[index])
          scene.playAudio(tickSound)
        })
        scene.addAnims(wait(0.3))
      }
    }
  )
}
