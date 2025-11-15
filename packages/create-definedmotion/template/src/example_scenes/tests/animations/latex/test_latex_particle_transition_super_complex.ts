// test_latex_particle_transition_super_complex.ts
import * as THREE from 'three'
import {
  AnimatedScene,
  HotReloadSetting,
  SpaceSetting
} from '$renderer/lib/scene/sceneClass'
import { latexToSVG } from '$renderer/lib/rendering/svg/latexToSVG'
import { createSVGShape } from '$renderer/lib/rendering/svg/svgRendering'
import { setOpacity } from '$renderer/lib/animation/animations'
import { latexParticleTransition } from '$renderer/lib/animation/latexParticleTransition'

export const test_latex_particle_transition_super_complex = (): AnimatedScene => {
  return new AnimatedScene(
    1600,
    1600,
    SpaceSetting.ThreeDim,
    HotReloadSetting.TraceFromStart,
    async (dm) => {
      // --- 1) Two super duper complex LaTeX expressions ---

      // A: Full softmax cross-entropy loss with explicit logits
      const latexA = String.raw`
        \begin{aligned}
          \mathcal{L}(\theta)
            &= - \sum_{i=1}^N \log p_\theta(y_i \mid x_i) \\
            &= - \sum_{i=1}^N \log
               \frac{\exp\big(f_\theta(x_i)_{y_i}\big)}
                    {\sum_{k=1}^K \exp\big(f_\theta(x_i)_k\big)} \\
            &= - \sum_{i=1}^N
               \left(
                 f_\theta(x_i)_{y_i}
                 - \log \sum_{k=1}^K \exp\big(f_\theta(x_i)_k\big)
               \right)
        \end{aligned}
      `

      // B: VI ELBO gradient with regularization and KL term
      const latexB = String.raw`
        \begin{aligned}
          \nabla_\theta \mathcal{L}_{\mathrm{ELBO}}(\theta,\phi)
            &= - \mathbb{E}_{q_\phi(z \mid x)}
                 \big[ \nabla_\theta \log p_\theta(x \mid z) \big] \\
            &\quad +\;
              \lambda \,\nabla_\theta \lVert \theta \rVert_2^2 \\
            \mathcal{L}_{\mathrm{ELBO}}(\theta,\phi)
            &= \mathbb{E}_{q_\phi(z \mid x)}
                 \big[ \log p_\theta(x \mid z) \big]
               - \mathrm{KL}\!\big(q_\phi(z\mid x)\,\|\,p(z)\big)
        \end{aligned}
      `

      // --- 2) LaTeX → SVG → THREE.Group ---

      const svgA = latexToSVG(latexA)
      const svgB = latexToSVG(latexB)

      // Wider target width to fit the long equations nicely
      const targetWidth = 32
      const groupA = createSVGShape(svgA, targetWidth)
      const groupB = createSVGShape(svgB, targetWidth)

      // Center them around the origin
      groupA.position.set(0, 0, 0)
      groupB.position.set(0, 0, 0)

      dm.add(groupA)
      dm.add(groupB)

      // --- 3) Make target invisible initially ---
      setOpacity(groupB, 0)

      // --- 4) Camera setup: small offset so everything is nicely framed ---
      dm.camera.position.set(0, 0, 40)
      dm.camera.lookAt(new THREE.Vector3(0, 0, 0))

      // --- 5) Particle transition ---
      //    - 2200 ms duration
      //    - particleCount controlled inside helper (default 2000)
      dm.addAnims(latexParticleTransition(groupA, groupB, 2200))

      // Leave a short pause when done
      dm.addWait(400)
    }
  )
}
