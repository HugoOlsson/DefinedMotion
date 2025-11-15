import * as THREE from 'three';
import { AnimatedScene, HotReloadSetting, SpaceSetting } from '$renderer/lib/scene/sceneClass';
import { latexToSVG } from '$renderer/lib/rendering/svg/latexToSVG';
import { createSVGShape } from '$renderer/lib/rendering/svg/svgRendering';
import { queryLaTeXClass } from '$renderer/lib/rendering/svg/latexSVGQueries';
import { createAnim } from '$renderer/lib/animation/protocols';
import { easeInOutQuad } from '$renderer/lib/animation/interpolations';

export const test_latex_query_variables = (): AnimatedScene => {
  return new AnimatedScene(
    1000,
    1000,
    SpaceSetting.ThreeDim,
    HotReloadSetting.TraceFromStart,
    async (dm) => {
      // 1) More complicated LaTeX expression with many variables
      // Tag every variable occurrence with \dmClass{variable}{...}
      const latex = String.raw`
        f(\dmClass{variable}{x}, \dmClass{variable}{y}) 
        = \int_{\dmClass{variable}{x_0}}^{\dmClass{variable}{x_1}}
            \dmClass{variable}{y}(t)\, e^{-\dmClass{variable}{\alpha} t}
          \, dt
      `;

      // 2) Convert LaTeX → SVG → THREE.Group
      const svg = latexToSVG(latex);
      const equationGroup = createSVGShape(svg, 20); // width ≈ 10 units
      dm.add(equationGroup);

      // 3) Query all meshes that belong to class "variable"
      const hit = queryLaTeXClass(equationGroup, 'variable');
      if (!hit) {
        console.warn('No meshes found for LaTeX class "variable"');
        return;
      }

     // Somewhere when you build the meshes
    const targetColor = new THREE.Color(0x00ff88); // the “variable” color
    const white       = new THREE.Color(0xffffff);
    const tmpColor    = new THREE.Color();

    // Example: you have an array of meshes you want to tint
    const variableMeshes: THREE.Mesh[] = hit.meshes;

    // Make sure materials are independent if you plan to animate them
    for (const mesh of variableMeshes) {
        mesh.material = (mesh.material as THREE.Material).clone();
    }

    const colorAnim = createAnim(easeInOutQuad(0, 1, 300), (t) => {
        tmpColor.lerpColors(white, targetColor, t); // tmp = white * (1-t) + target * t
        for (const mesh of variableMeshes) {
            const mat = mesh.material as THREE.MeshBasicMaterial;
            mat.color.copy(tmpColor);
        }
    });


    for (let i = 0; i<20; i++) {
        dm.addAnims(colorAnim.copy())
        dm.addAnims(colorAnim.copy().reverse())
    }
   
    }
  );
};