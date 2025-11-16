
import * as THREE from 'three'
import { AnimatedScene, HotReloadSetting, SpaceSetting } from '$renderer/lib/scene/sceneClass'
import { latexToSVG } from '$renderer/lib/rendering/svg/latexToSVG'
import { createSVGShape } from '$renderer/lib/rendering/svg/svgRendering'
import { setOpacity } from '$renderer/lib/animation/animations'
import { latexParticleTransitionAnim } from '$renderer/lib/animation/latexTransitionsAndWrite' // <- your new helper

export const test_latex_particle_transition = (): AnimatedScene => {
  return new AnimatedScene(
    1000,
    1000,
    SpaceSetting.ThreeDim,
    HotReloadSetting.TraceFromStart,
    async (dm) => {
      // 1) Two related equations to morph between
      const latexA = String.raw`\nabla \cdot \vec{E} = \frac{\rho}{\varepsilon_0}`
      const latexB = String.raw`\nabla \cdot \vec{D} = \rho_{\mathrm{free}}`

      // 2) LaTeX → SVG → THREE.Group
      const svgA = latexToSVG(latexA)
      const svgB = latexToSVG(latexB)

      const groupA = createSVGShape(svgA, 20) // width ≈ 10 units
      const groupB = createSVGShape(svgB, 20)

      // Place both at origin
      groupA.position.set(0, 0, 0)
      groupB.position.set(0, 0, 0)

      // Add to scene
      dm.add(groupA)
      dm.add(groupB)

      // 3) Make the target equation invisible initially (required by your spec)
      setOpacity(groupB, 0)

      // 4) Simple camera setup so the equations are clearly visible
      dm.camera.position.set(0, 0, 30)
      dm.camera.lookAt(new THREE.Vector3(0, 0, 0))

      dm.addDeferredAnims(latexParticleTransitionAnim(groupA, groupB))

      // Optionally: leave a bit of time after the morph finishes
      dm.addWait(300)
    }
  )
}
