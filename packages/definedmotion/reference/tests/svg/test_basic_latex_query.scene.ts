import { defineScene } from 'definedmotion'

export default defineScene({
  id: 'test-basic-latex-query',
  name: 'Basic LaTeX Query',
  isTest: true,
  create: test_basic_latex_query
})
import * as THREE from 'three';
import { AnimatedScene, HotReloadSetting, SpaceSetting } from 'definedmotion';
import { latexToSVG } from 'definedmotion/latex';
import { createSVGShape } from 'definedmotion/latex';
import { queryLaTeXClass } from 'definedmotion/latex';


export function test_basic_latex_query(): AnimatedScene {
  return new AnimatedScene(
    1000,
    1000,
    SpaceSetting.ThreeDim,
    HotReloadSetting.TraceFromStart,
    async (dm) => {
      // 1) Tag the vector E in LaTeX
      const latex = String.raw`
        \nabla \cdot \dmClass{E}{\vec{E}} = \frac{\rho}{\varepsilon_0}
      `;

      // 2) Convert LaTeX → SVG → THREE.Group
      const svg = latexToSVG(latex);
      const equationGroup = createSVGShape(svg, 10); // width ≈ 10 units
      dm.add(equationGroup);

      // 3) Query all meshes that belong to class "E"
      const hit = queryLaTeXClass(equationGroup, 'E');
      if (!hit) {
        console.warn('No meshes found for LaTeX class "E"');
        return;
      }

      // 4) Build a wireframe box around that region

      // Slight padding so the frame doesn’t sit exactly on glyph edges
      const padding = 0.5;

      const size = new THREE.Vector3();
      hit.box.getSize(size);
      size.x += 2 * padding;
      size.y += 2 * padding;
      size.z += 2 * padding; // tiny depth in case everything is flat

      const center = hit.center.clone();

      const boxGeom = new THREE.BoxGeometry(size.x, size.y, size.z);
      const edgesGeom = new THREE.EdgesGeometry(boxGeom);
      const frameMat = new THREE.LineBasicMaterial({ color: 0xffffff });

      const frame = new THREE.LineSegments(edgesGeom, frameMat);
      frame.position.copy(center);

      dm.add(frame);

      // (Optional) move camera back a bit if needed
      // dm.camera.position.set(0, 0, 30);
      // dm.camera.lookAt(0, 0, 0);
    }
  );
}
