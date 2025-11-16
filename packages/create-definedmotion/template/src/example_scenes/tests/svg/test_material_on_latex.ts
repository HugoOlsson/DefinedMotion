import { createBumpMap } from "$renderer/lib/rendering/bumpMaps/noise";
import { addHDRI, HDRIs, loadHDRIData } from "$renderer/lib/rendering/hdri";
import {  addSceneLighting,  } from "$renderer/lib/rendering/lighting3d";
import { latexToSVG } from "$renderer/lib/rendering/svg/latexToSVG";
import { createSVGShape } from "$renderer/lib/rendering/svg/svgRendering";
import { AnimatedScene, HotReloadSetting, SpaceSetting } from "$renderer/lib/scene/sceneClass";
import * as THREE from 'three';


const hdriData = await loadHDRIData(HDRIs.outdoor1, 1)


export const test_material_on_latex = (): AnimatedScene => {
  return new AnimatedScene(
    1000, 1000,
    SpaceSetting.ThreeDim,
    HotReloadSetting.TraceFromStart,
    async (dm) => {

        
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
};