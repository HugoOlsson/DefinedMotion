import { defineScene } from 'definedmotion'

export default defineScene({
  id: 'test-material-on-latex',
  name: 'Material On LaTeX',
  isTest: true,
  create: test_material_on_latex
})
import { createBumpMap } from "definedmotion/rendering";
import { addHDRI, HDRIs, loadHDRIData } from "definedmotion/rendering";
import {  addSceneLighting,  } from "definedmotion/rendering";
import { latexToSVG } from "definedmotion/latex";
import { createSVGShape } from "definedmotion/latex";
import { AnimatedScene, HotReloadSetting, SpaceSetting } from "definedmotion";
import * as THREE from 'three';


export function test_material_on_latex(): AnimatedScene {
  return new AnimatedScene(
    1000, 1000,
    SpaceSetting.ThreeDim,
    HotReloadSetting.TraceFromStart,
    async (dm) => {
      const hdriData = await loadHDRIData(HDRIs.outdoor1, 1)

        
     await addHDRI(dm, hdriData, 6)
      const svg = latexToSVG(String.raw`\nabla \cdot \vec{E} = \frac{\rho}{\varepsilon_0}`);
      const group = createSVGShape(svg, 20);

      // the material you want to apply
    const metalMaterial = new THREE.MeshStandardMaterial({
       color: 0xffffff,   // slightly darker red often looks nicer for metal
        metalness: 0.9,    // close to 1 = very metallic
        roughness: 0.3,    // lower = more shiny, higher = more matte
        side: THREE.DoubleSide,
    });

    group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.material = metalMaterial;
    }
    });

      dm.add(group);
    }
  );
}
