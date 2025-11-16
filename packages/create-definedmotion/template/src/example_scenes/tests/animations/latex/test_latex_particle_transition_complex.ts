// test_latex_particle_transition_complex.ts
import * as THREE from 'three'
import {
  AnimatedScene,
  HotReloadSetting,
  SpaceSetting
} from '$renderer/lib/scene/sceneClass'
import { latexToSVG } from '$renderer/lib/rendering/svg/latexToSVG'
import { createSVGShape } from '$renderer/lib/rendering/svg/svgRendering'
import { setOpacity } from '$renderer/lib/animation/animations'
import { latexParticleTransitionAnim } from '$renderer/lib/animation/latexTransitionsAndWrite'

export const test_latex_particle_transition_complex = (): AnimatedScene => {
  return new AnimatedScene(
    1600,
    1600,
    SpaceSetting.ThreeDim,
    HotReloadSetting.TraceFromStart,
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
      dm.addWait(400)
    }
  )
}
