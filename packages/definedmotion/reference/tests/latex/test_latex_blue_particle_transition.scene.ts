// test_latex_particle_transition_blue.ts
import { defineScene } from 'definedmotion'
import * as THREE from 'three'
import {
  AnimatedScene,
  HotReloadSetting,
  SpaceSetting
} from 'definedmotion'
import { latexToSVG } from 'definedmotion/latex'
import { createSVGShape } from 'definedmotion/latex'
import { setOpacity } from 'definedmotion/animation'
import { latexParticleTransitionAnim } from 'definedmotion/animation'


export default defineScene({
  id: 'test-latex-blue-particle-transition',
  name: 'LaTeX Blue Particle Transition',
  isTest: true,
  create: test_latex_blue_particle_transition
})
export function test_latex_blue_particle_transition(): AnimatedScene {
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

      const groupA = createSVGShape(svgA, 20)
      const groupB = createSVGShape(svgB, 20)

      // 2.5) Tint both equations blue
      const blue = new THREE.Color('#3b82f6')

      const tintGroupBlue = (group: THREE.Group) => {
        group.traverse(obj => {
          const mesh = obj as THREE.Mesh
          // @ts-ignore
          if (!mesh.isMesh) return
          const mat = mesh.material
          if (Array.isArray(mat)) {
            mat.forEach(m => {
              const anyMat = m as any
              if (anyMat && anyMat.color && anyMat.color.isColor) {
                anyMat.color.copy(blue)
              }
            })
          } else {
            const anyMat = mat as any
            if (anyMat && anyMat.color && anyMat.color.isColor) {
              anyMat.color.copy(blue)
            }
          }
        })
      }

      tintGroupBlue(groupA)
      tintGroupBlue(groupB)

      // 3) Place both at origin
      groupA.position.set(0, 0, 0)
      groupB.position.set(0, 0, 0)

      // Add to scene
      dm.add(groupA)
      dm.add(groupB)

      // 4) Make the target equation invisible initially
      setOpacity(groupB, 0)

      // 5) Simple camera setup so the equations are clearly visible
      dm.camera.position.set(0, 0, 30)
      dm.camera.lookAt(new THREE.Vector3(0, 0, 0))

      // 6) Add the particle transition animation
      //    (particles will pick up the same blue via pickColorFromGroup)
      dm.addDeferredAnims(latexParticleTransitionAnim(groupA, groupB))

      // Optional pause after the morph
      dm.addWait(300)
    }
  )
}
