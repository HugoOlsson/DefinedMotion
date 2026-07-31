import { wait } from 'definedmotion/animation'
// test_latex_particle_transition_complex.ts
import { defineScene } from 'definedmotion'
import * as THREE from 'three'
import {
  AnimatedScene,
  SpaceSetting
} from 'definedmotion'
import { latexToSVG } from 'definedmotion/latex'
import { createSVGShape } from 'definedmotion/latex'
import { setOpacity } from 'definedmotion/animation'
import { latexParticleTransitionAnim } from 'definedmotion/animation'


export default defineScene({
  id: 'test-latex-particle-transition-complex',
  name: 'LaTeX Particle Transition Complex',
  isTest: true,
  create: test_latex_particle_transition_complex
})
export function test_latex_particle_transition_complex(): AnimatedScene {
  return new AnimatedScene(
    1600,
    1600,
    SpaceSetting.ThreeDim,
    async (dm) => {
      // 1) Two related, more complex LaTeX expressions
      const latexA = String.raw`
        \oint_{\partial V} \vec{D} \cdot d\vec{A}
        \;=\;
        \int_V \rho_{\mathrm{free}}\, dV
      `

      const latexB = String.raw`
        \nabla \cdot \vec{D}(\vec{r})
        \;=\;
        \rho_{\mathrm{free}}(\vec{r})
      `

      // 2) LaTeX → SVG → THREE.Group
      const svgA = latexToSVG(latexA)
      const svgB = latexToSVG(latexB)

      // Slightly wider target width to give the integral signs room
      const groupA = createSVGShape(svgA, 28)
      const groupB = createSVGShape(svgB, 28)

      // Place both at origin
      groupA.position.set(0, 0, 0)
      groupB.position.set(0, 0, 0)

      // Add to scene
      dm.add(groupA)
      dm.add(groupB)

      // 3) Target expression starts invisible
      setOpacity(groupB, 0)

      // 4) Camera setup
      dm.camera.position.set(0, 0, 35)
      dm.camera.lookAt(new THREE.Vector3(0, 0, 0))

      // 5) Particle transition:
      //    - 2000 ms duration
      //    - default particleCount from helper (tune inside helper if needed)
      dm.addDeferredAnims(latexParticleTransitionAnim(groupA, groupB))

      // A small pause after the morph
      dm.addAnims(wait((400) / 1000))
    }
  )
}
