import * as THREE from 'three'
import {
  AnimatedScene,
  HotReloadSetting,
  SpaceSetting
} from '$renderer/lib/scene/sceneClass'
import { latexToSVG } from '$renderer/lib/rendering/svg/latexToSVG'
import { createSVGShape } from '$renderer/lib/rendering/svg/svgRendering'
import { setOpacity } from '$renderer/lib/animation/animations'
import { latexParticleTransitionAnim } from '$renderer/lib/animation/latexParticleTransition'

export const latex_text_transitions_scene = (): AnimatedScene => {
  return new AnimatedScene(
    1600,
    1600,
    SpaceSetting.ThreeDim,
    HotReloadSetting.TraceFromStart,
    async (dm) => {
      // 1) Five varied "flex" LaTeX expressions (all rendered in white)
      const latexExprs = [
        // Maxwell–Faraday law
        String.raw`
          \nabla \times \vec{E}(\vec{r}, t)
          \;=\;
          -\,\frac{\partial \vec{B}(\vec{r}, t)}{\partial t}
        `,
        // Gradient descent update
        String.raw`
          \theta_{t+1}
          \;=\;
          \theta_t
          \;-\;
          \eta \,\nabla_\theta \mathcal{L}(\theta_t)
        `,
        // Schr\"odinger equation
        String.raw`
          i\,\hbar\,\frac{\partial}{\partial t} \Psi(\vec{r}, t)
          \;=\;
          \Bigl[
            -\,\frac{\hbar^2}{2m}\,\nabla^2
            \;+\;
            V(\vec{r}, t)
          \Bigr]\,
          \Psi(\vec{r}, t)
        `,
        // Einstein field equations
        String.raw`
          R_{\mu\nu}
          \;-\;
          \tfrac{1}{2}\,g_{\mu\nu} R
          \;+\;
          \Lambda g_{\mu\nu}
          \;=\;
          \frac{8\pi G}{c^4}\,T_{\mu\nu}
        `,
        // Transformer attention
        String.raw`
          \mathrm{Attention}(Q,K,V)
          \;=\;
          \mathrm{softmax}\!
          \Bigl(
            \frac{QK^\top}{\sqrt{d_k}}
          \Bigr)V
        `
      ]

      const targetWidth = 60

      // 2) LaTeX → SVG → THREE.Group, all white
      const groups = latexExprs.map((latex) => {
        const svg = latexToSVG(latex)
        const group = createSVGShape(svg, targetWidth)
        group.position.set(0, 0, 0)
        // ensure white materials (in case your SVG pipeline adds colors)
        group.traverse(obj => {
          const mesh = obj as THREE.Mesh
          // @ts-ignore
          if (!mesh.isMesh) return
          const mat = mesh.material
          if (Array.isArray(mat)) {
            mat.forEach(m => {
              const anyMat = m as any
              if (anyMat && anyMat.color && anyMat.color.isColor) {
                anyMat.color.set(0xffffff)
              }
            })
          } else {
            const anyMat = mat as any
            if (anyMat && anyMat.color && anyMat.color.isColor) {
              anyMat.color.set(0xffffff)
            }
          }
        })

        dm.add(group)
        return group
      })

      if (groups.length < 2) return

      const [first, ...rest] = groups

      // 3) Only the first expression is visible initially
      setOpacity(first, 1)
      for (const g of rest) setOpacity(g, 0)

      // 4) Camera: slight angle + distance so it feels more 3D
      dm.camera.position.set(0, 5, 45)
      dm.camera.lookAt(new THREE.Vector3(0, 0, 0))

      // 5) Chain particle transitions:
      //    expr1 -> expr2 -> expr3 -> expr4 -> expr5
      const baseDuration   = 1600
      const baseParticles  = 2600
      const pauseAfterEach = 350

      for (let i = 0; i < groups.length - 1; i++) {
        const fromGroup = groups[i]
        const toGroup   = groups[i + 1]

        dm.addDeferredAnims(
          latexParticleTransitionAnim(fromGroup, toGroup, {
            durationMs: baseDuration + i * 150,
            particleCount: baseParticles + i * 400
          })
        )
        dm.addWait(pauseAfterEach)
      }

  dm.camera.position.set(
  -31.85278, 
  2.348312, 
  28.14598
);

dm.camera.quaternion.set(
  -0.05007873, 
  -0.3123886, 
  -0.01649361, 
  0.9484901
);
      // Extra pause at the end so the final expression lingers
      dm.addWait(800)
    }
  )
}
