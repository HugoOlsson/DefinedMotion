import * as THREE from 'three';
import { CONTENT_NAME } from './svgRendering';


export interface ClassQueryResult {
  className: string;      // e.g. "variable"
  meshes: THREE.Mesh[];   // all meshes that belong to this class
  box: THREE.Box3;        // combined bounding box (in world space)
  center: THREE.Vector3;  // center of that box (world space)
}

export function queryLaTeXClass(
  root: THREE.Object3D,
  className: string
): ClassQueryResult | null {
  // Try to use the inner content group if it exists
  const content =
    (root.getObjectByName(CONTENT_NAME) as THREE.Group | null) ??
    (root as THREE.Group);

  const meshes: THREE.Mesh[] = [];

  // Make sure transforms are current
  root.updateMatrixWorld(true);

  content.traverse(obj => {
    const mesh = obj as THREE.Mesh;
    // @ts-ignore: runtime check
    if (!mesh.isMesh) return;
    const classes: string[] | undefined = mesh.userData.dmClasses;
    if (!classes) return;
    if (classes.includes(className)) {
      meshes.push(mesh);
    }
  });

  if (!meshes.length) return null;

  const box = new THREE.Box3();
  for (const m of meshes) box.expandByObject(m);
  const center = box.getCenter(new THREE.Vector3());

  return { className, meshes, box, center };
}