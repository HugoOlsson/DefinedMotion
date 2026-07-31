import { wait } from 'definedmotion/animation'
import { defineScene } from 'definedmotion'

// Tutorial 3 (easy3.ts)
// Goal for this animation:
// 1) Show a fullscreen-ish color card
// 2) Swap the headline text every few beats
// 3) Play a short tick sound on each swap

import * as THREE from 'three'

import { createText, createRectangle } from 'definedmotion/rendering'
import { AnimatedScene, SpaceSetting } from 'definedmotion'

export default defineScene({
  id: 'tutorial-easy-3',
  name: 'Tutorial: Easy 3',
  create: tutorial_easy3
})
// ─────────────────────────────────────────────────────────────────────────────
// Step 0: Slides = headline alternatives (translated to English)
// ─────────────────────────────────────────────────────────────────────────────
const ALTERNATIVES = [
  'Introductory Mathematical Analysis',
  'Linear Algebra',
  'The Physicist’s Toolkit',
  'Mathematical Analysis, Continued',
  'Mechanics 1',
  'Programming Techniques and Numerical Analysis',
  'Multivariable Calculus',
  'Probability and Statistics',
  'Mechanics 2',
  'Complex Analysis',
  'Experimental Physics 1',
  'Electrical Circuits and Systems',
  'Vector Fields and Electromagnetic Field Theory',
  'Control Engineering (F)',
  'Bayesian Inference and Machine Learning',
  'Fourier Analysis',
  'Optics',
  'Continuum Mechanics',
  'Thermodynamics and Statistical Mechanics',
  'Quantum Physics',
  'Data Structures and Algorithms',
  'Experimental Physics 2',
  'Solid State Physics',
  'Subatomic Physics',
  'Environmental Physics',
  'Algorithms',
  'Logic for Computer Science',
  'Introduction to Data Science and AI',
  'Programming Languages',
  'Design of AI Systems',
  'Algorithms for Machine Learning and Inference',
  'Computational Methods for Large-Scale Data',
  'Compiler Construction'
]

// Pleasant, varied card colors
const SLIDE_COLORS = [
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

// How long each slide stays on screen, measured in ticks/frames
const TICKS_PER_SLIDE = 300

// ─────────────────────────────────────────────────────────────────────────────
// Step 1: Export an AnimatedScene (2D, begin from current = fast hot reload)
// ─────────────────────────────────────────────────────────────────────────────
export function tutorial_easy3(): AnimatedScene {
  return new AnimatedScene(
    1000,
    1000,
    SpaceSetting.TwoDim,
    async (scene) => {
      const tickSound = scene.asset('audio/tick_sound.mp3')
      // ───────────────────────────────────────────────────────────────────────
      // Step 2: Create a background card and a headline text
      // The rectangle acts like a slide background; we’ll change its color.
      // ───────────────────────────────────────────────────────────────────────
      const card = createRectangle(200, 200) // simple square card
      const title = await createText({ text: '', fontSize: 1.5 }) // scale = 1.5 ⇒ nice big headline
      scene.add(card, title)

      // Optional: center them if your renderer doesn’t already
      card.position.set(0, 0, 0)
      title.position.set(0, 0, 0)

      // ───────────────────────────────────────────────────────────────────────
      // Step 3: Load the tick SFX and register it once
      // ───────────────────────────────────────────────────────────────────────
      scene.registerAudio(tickSound)

      // ───────────────────────────────────────────────────────────────────────
      // Step 4: Build a simple “switcher” animation
      // We map a linear 0→1 over (ALTERNATIVES.length * TICKS_PER_SLIDE) ticks.
      // On each whole-index step we:
      //   - update the background color
      //   - update the headline text
      //   - play a tick sound
      // ───────────────────────────────────────────────────────────────────────
      for (let index = 0; index < ALTERNATIVES.length; index++) {
        scene.do(async () => {
          const color = SLIDE_COLORS[index % SLIDE_COLORS.length]
          ;(card.material as THREE.MeshBasicMaterial).color = new THREE.Color(color)
          await title.setText(ALTERNATIVES[index])
          scene.playAudio(tickSound)
        })
        scene.addAnims(wait(TICKS_PER_SLIDE / 1000))
      }

      // Let it run a bit after the last change (nice tail for render/export)
      scene.addAnims(wait((1_000) / 1000))
    }
  )
}
