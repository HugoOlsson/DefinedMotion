

import { queryLaTeXClass } from "../svg/latexSVGQueries";
import * as THREE from 'three'

interface ProgressUpdater {
  updater(progress: number, frame?: number, isLast?: boolean): void
}

const corners = (bounds: THREE.Box3): THREE.Vector3[] => {
  const { min, max } = bounds
  return [
    new THREE.Vector3(min.x, min.y, min.z),
    new THREE.Vector3(min.x, min.y, max.z),
    new THREE.Vector3(min.x, max.y, min.z),
    new THREE.Vector3(min.x, max.y, max.z),
    new THREE.Vector3(max.x, min.y, min.z),
    new THREE.Vector3(max.x, min.y, max.z),
    new THREE.Vector3(max.x, max.y, min.z),
    new THREE.Vector3(max.x, max.y, max.z)
  ]
}

const meshBoundsInRoot = (
  root: THREE.Object3D,
  meshes: readonly THREE.Mesh[]
): THREE.Box3 => {
  root.updateWorldMatrix(true, true)
  const inverseRoot = root.matrixWorld.clone().invert()
  const localMatrix = new THREE.Matrix4()
  const result = new THREE.Box3()
  for (const mesh of meshes) {
    const geometry = mesh.geometry
    if (!geometry.boundingBox) geometry.computeBoundingBox()
    if (!geometry.boundingBox || geometry.boundingBox.isEmpty()) continue
    localMatrix.multiplyMatrices(inverseRoot, mesh.matrixWorld)
    for (const point of corners(geometry.boundingBox)) {
      result.expandByPoint(point.applyMatrix4(localMatrix))
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// LaTeX "mark" animation: pulsating brackets around a set of classes
// ---------------------------------------------------------------------------

export function createLatexMarkController(
  root: THREE.Object3D,
  classNames: string | string[],
  cfg: {
    color?: THREE.ColorRepresentation;
    padding?: number;     // fraction of the LaTeX visual's authored font size
    strokeWidth?: number; // fraction of the LaTeX visual's authored font size
    pulses?: number;      // how many pulses over the duration
    scaleAmp?: number;    // how much the brackets grow/shrink
    maxOpacity?: number;
  } = {}
): () => ProgressUpdater {
  const {
    color = 0xffffff,
    padding = 0.17,
    strokeWidth = 0.055,
    pulses = 1,
    scaleAmp = 0.02,
    maxOpacity = 1.0,
  } = cfg;

  const classList = Array.isArray(classNames) ? classNames : [classNames];

  return () => {
    let initialized = false;
    let bracketGroup: THREE.Group | null = null;
    let material: THREE.MeshBasicMaterial | null = null;
    let parent: THREE.Object3D | null = null;

    const tmpSize = new THREE.Vector3();
    const tmpCenterLocal = new THREE.Vector3();

    const buildBracketGroup = () => {
      // Combine selected geometry directly in the stable LaTeX root's local space.
      const combinedBox = new THREE.Box3();
      let haveAny = false;

      for (const name of classList) {
        const res = queryLaTeXClass(root, name);
        if (!res) continue;
        const localBounds = meshBoundsInRoot(root, res.meshes)
        if (localBounds.isEmpty()) continue
        if (!haveAny) {
          combinedBox.copy(localBounds);
          haveAny = true;
        } else {
          combinedBox.union(localBounds);
        }
      }

      // Fallback: if nothing found, mark the whole root
      if (!haveAny) {
        const meshes: THREE.Mesh[] = []
        root.traverse((object) => {
          const mesh = object as THREE.Mesh
          if (mesh.isMesh) meshes.push(mesh)
        })
        combinedBox.copy(meshBoundsInRoot(root, meshes));
      }

      if (combinedBox.isEmpty()) return

      combinedBox.getSize(tmpSize);
      combinedBox.getCenter(tmpCenterLocal);

      parent = root;

      const authoredFontSize = root.userData.definedMotionLatexFontSize
      const referenceSize =
        typeof authoredFontSize === 'number' &&
        Number.isFinite(authoredFontSize) &&
        authoredFontSize > 0
          ? authoredFontSize
          : tmpSize.y
      const paddingAmount = referenceSize * padding;
      const width = tmpSize.x + 2 * paddingAmount;
      const height = tmpSize.y + 2 * paddingAmount;
      const thickness = Math.max(referenceSize * strokeWidth, 0.001);

      const halfW = width  * 0.5;
      const halfH = height * 0.5;
      const stubLength = Math.min(referenceSize * 0.42, width * 0.18);

      material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
      });

      bracketGroup = new THREE.Group();
      bracketGroup.name = 'DefinedMotionLatexMark'

      const addStroke = (
        name: string,
        strokeWidthValue: number,
        strokeHeightValue: number,
        x: number,
        y: number
      ) => {
        const stroke = new THREE.Mesh(
          new THREE.PlaneGeometry(strokeWidthValue, strokeHeightValue),
          material!
        )
        stroke.name = name
        stroke.position.set(x, y, 0)
        bracketGroup!.add(stroke)
      }

      const leftX = -halfW + thickness * 0.5
      const rightX = halfW - thickness * 0.5
      const topY = halfH - thickness * 0.5
      const bottomY = -halfH + thickness * 0.5
      const leftStubX = -halfW + stubLength * 0.5
      const rightStubX = halfW - stubLength * 0.5

      addStroke('LatexMarkLeftStroke', thickness, height, leftX, 0)
      addStroke('LatexMarkRightStroke', thickness, height, rightX, 0)
      addStroke('LatexMarkTopLeftStub', stubLength, thickness, leftStubX, topY)
      addStroke('LatexMarkBottomLeftStub', stubLength, thickness, leftStubX, bottomY)
      addStroke('LatexMarkTopRightStub', stubLength, thickness, rightStubX, topY)
      addStroke('LatexMarkBottomRightStub', stubLength, thickness, rightStubX, bottomY)

      bracketGroup.position.copy(tmpCenterLocal);

      parent.add(bracketGroup);
    };

    const disposeBracketGroup = () => {
      if (!bracketGroup) return;
      if (parent) parent.remove(bracketGroup);

      bracketGroup.traverse((obj) => {
        const mesh = obj as any;
        if (mesh.geometry) mesh.geometry.dispose?.();
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m: any) => m?.dispose?.());
          } else {
            mesh.material.dispose?.();
          }
        }
      });

      bracketGroup = null;
      material = null;
    };

    return {
      updater(t: number, _tick?: number, isLast?: boolean) {
        if (!initialized) {
          buildBracketGroup();
          initialized = true;
        }
        if (!bracketGroup || !material) return;

        // Smooth overall interpolation is already in `t`
        const phase = t * pulses * Math.PI * 2;
        const pulse = 0.5 * (1 - Math.cos(phase)); // 0..1 repeating

        const s = 1 + scaleAmp * pulse;
        bracketGroup.scale.set(s, s, s);

        material.opacity = maxOpacity * pulse;

        if (isLast) {
          disposeBracketGroup();
        }
      }
    };
  };
}


// ---------------------------------------------------------------------------
// LaTeX "highlight" animation: pulse matched classes in a highlight color
// ---------------------------------------------------------------------------

type HighlightMatState = {
  mat: THREE.Material & {
    color?: THREE.Color;
    opacity?: number;
    transparent?: boolean;
  };
  baseColor: THREE.Color;
  baseOpacity: number;
  transparent: boolean;
};

/**
 * Late-bound highlight controller over one or more LaTeX classes.
 */
export function createLatexHighlightController(
  root: THREE.Object3D,
  classNames: string | string[],
  cfg: {
    highlightColor?: THREE.ColorRepresentation;
    pulses?: number;
    minMix?: number; // minimum mix factor between base and highlight
    maxMix?: number; // maximum mix factor between base and highlight
  } = {}
): () => ProgressUpdater {
  const {
    highlightColor = 0xffdd55,
    pulses = 2,
    minMix = 0.0,
    maxMix = 1.0,
  } = cfg;

  const classList = Array.isArray(classNames) ? classNames : [classNames];
  const hiColor = new THREE.Color(highlightColor);

  return () => {
    let initialized = false;
    const matStates = new Map<THREE.Material, HighlightMatState>();

    const collectMaterials = () => {
      root.updateMatrixWorld(true);

      for (const name of classList) {
        const res = queryLaTeXClass(root, name);
        if (!res) continue;

        for (const mesh of res.meshes) {
          const mat = (mesh as any).material as THREE.Material | THREE.Material[] | undefined;
          if (!mat) continue;

          const addMat = (m: THREE.Material) => {
            if (matStates.has(m)) return;
            const anyMat = m as any;
            if (!anyMat.color || !anyMat.color.isColor) return;

            const baseColor = anyMat.color.clone();
            const baseOpacity = anyMat.opacity ?? 1;
            const transparent = anyMat.transparent ?? false;

            matStates.set(m, {
              mat: anyMat,
              baseColor,
              baseOpacity,
              transparent,
            });
          };

          if (Array.isArray(mat)) {
            mat.forEach(addMat);
          } else {
            addMat(mat);
          }
        }
      }

      // Fallback: if nothing found, highlight whole root
      if (!matStates.size) {
        const tmpBox = new THREE.Box3().setFromObject(root);
        if (!tmpBox.isEmpty()) {
          (root as THREE.Object3D).traverse((obj) => {
            const mesh = obj as any;
            const mat = mesh?.material as THREE.Material | THREE.Material[] | undefined;
            if (!mat) return;

            const addMat = (m: THREE.Material) => {
              if (matStates.has(m)) return;
              const anyMat = m as any;
              if (!anyMat.color || !anyMat.color.isColor) return;

              const baseColor = anyMat.color.clone();
              const baseOpacity = anyMat.opacity ?? 1;
              const transparent = anyMat.transparent ?? false;

              matStates.set(m, {
                mat: anyMat,
                baseColor,
                baseOpacity,
                transparent,
              });
            };

            if (Array.isArray(mat)) mat.forEach(addMat);
            else addMat(mat);
          });
        }
      }
    };

    const restoreMaterials = () => {
      for (const state of matStates.values()) {
        const m: any = state.mat;
        if (m.color && m.color.isColor) {
          m.color.copy(state.baseColor);
        }
        m.opacity = state.baseOpacity;
        m.transparent = state.transparent;
      }
    };

    const tmp = new THREE.Color();

    return {
      updater(t: number, _tick?: number, isLast?: boolean) {
        if (!initialized) {
          collectMaterials();
          initialized = true;
        }

        if (!matStates.size) {
          if (isLast) restoreMaterials();
          return;
        }

        // Smooth t already passed in; add a sinusoidal pulse
        const phase = t * pulses * Math.PI * 2;
        const pulse = 0.5 * (1 - Math.cos(phase)); // 0..1

        const mix = minMix + (maxMix - minMix) * pulse;

        for (const state of matStates.values()) {
          const m: any = state.mat;
          if (!m.color || !m.color.isColor) continue;

          tmp.copy(state.baseColor).lerp(hiColor, mix);
          m.color.copy(tmp);

          // you can also add slight opacity modulation if you want:
          m.opacity = state.baseOpacity; // or e.g. state.baseOpacity * (0.9 + 0.1 * pulse)
          m.transparent = true;
        }

        if (isLast) {
          restoreMaterials();
        }
      }
    };
  };
}
