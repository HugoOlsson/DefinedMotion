import * as THREE from 'three';
import { createSVGShape } from './svgRendering';

function disposeObject3D(obj: THREE.Object3D) {
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const anyMat = (mesh as any).material;
    if (anyMat) {
      if (Array.isArray(anyMat)) anyMat.forEach((m) => m?.dispose?.());
      else anyMat.dispose?.();
    }
  });
}

function getWorldSizeX(obj: THREE.Object3D): number {
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  box.getSize(size);
  return size.x;
}

const CONTENT_NAME = 'SVGContent';

export function updateSVGShape(
  existingGroup: THREE.Group,
  svg: string,
  opts: { detail?: number; targetWidth?: number } = {}
): THREE.Group {
  const { detail = 2 } = opts;

  // local width to preserve visual size
  let targetLocalWidth = opts.targetWidth ?? 0;
  if (!targetLocalWidth) {
    const worldWidth = getWorldSizeX(existingGroup);
    const worldScale = new THREE.Vector3(); existingGroup.getWorldScale(worldScale);
    targetLocalWidth = (worldWidth / (worldScale.x || 1)) || 1;
  }

  // build a fresh container (with inner CONTENT_NAME)
  const tempContainer = createSVGShape(svg, targetLocalWidth, detail);
  const newContent = tempContainer.getObjectByName(CONTENT_NAME) as THREE.Group || tempContainer;

  // remove old inner content (but keep the outer transforms intact)
  const oldContent = existingGroup.getObjectByName(CONTENT_NAME);
  if (oldContent) {
    existingGroup.remove(oldContent);
    disposeObject3D(oldContent);
  } else {
    // legacy: the old root held the flip/centering — clear everything
    for (const child of [...existingGroup.children]) {
      existingGroup.remove(child);
      disposeObject3D(child);
    }
  }

  existingGroup.add(newContent);
  return existingGroup;
}
