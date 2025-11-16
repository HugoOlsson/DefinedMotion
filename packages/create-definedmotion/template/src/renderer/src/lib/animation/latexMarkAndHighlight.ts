

import { queryLaTeXClass } from "../rendering/svg/latexSVGQueries";
import { easeInOutQuad } from "./interpolations";
import { UserAnimation } from "./protocols";
import * as THREE from 'three'

// ---------------------------------------------------------------------------
// LaTeX "mark" animation: pulsating brackets around a set of classes
// ---------------------------------------------------------------------------

export function latexMarkAnim(
  root: THREE.Object3D,
  classNames: string | string[],
  cfg: {
    durationMs?: number;
    color?: THREE.ColorRepresentation;
    padding?: number;     // fraction of width/height
    pulses?: number;      // how many pulses over the duration
    scaleAmp?: number;    // how much the brackets grow/shrink
    maxOpacity?: number;
  } = {}
): () => UserAnimation {
  const {
    durationMs = 2000,
    color = 0xffffff,
    padding = 0.05,
    pulses = 2,
    scaleAmp = 0.02,
    maxOpacity = 1.0,
  } = cfg;

  const classList = Array.isArray(classNames) ? classNames : [classNames];

  return () => {
    const interpolation = easeInOutQuad(0, 1, durationMs);

    let initialized = false;
    let bracketGroup: THREE.Group | null = null;
    let line: THREE.LineSegments | null = null;
    let material: THREE.LineBasicMaterial | null = null;
    let parent: THREE.Object3D | null = null;

    const tmpBox = new THREE.Box3();
    const tmpSize = new THREE.Vector3();
    const tmpCenterWorld = new THREE.Vector3();
    const tmpCenterLocal = new THREE.Vector3();

    const buildBracketGroup = () => {
      // Combine boxes for all requested classes
      const combinedBox = new THREE.Box3();
      let haveAny = false;

      for (const name of classList) {
        const res = queryLaTeXClass(root, name);
        if (!res) continue;
        if (!haveAny) {
          combinedBox.copy(res.box);
          haveAny = true;
        } else {
          combinedBox.union(res.box);
        }
      }

      // Fallback: if nothing found, mark the whole root
      if (!haveAny) {
        tmpBox.setFromObject(root);
        combinedBox.copy(tmpBox);
      }

      combinedBox.getSize(tmpSize);
      combinedBox.getCenter(tmpCenterWorld);

      // Decide parent & local center
      parent = root.parent || root;
      tmpCenterLocal.copy(tmpCenterWorld);
      parent.worldToLocal(tmpCenterLocal);

      const width  = tmpSize.x * (1 + 2 * padding);
      const height = tmpSize.y * (1 + 2 * padding);

      const halfW = width  * 0.5;
      const halfH = height * 0.5;
      const hx    = width  * 0.08; // horizontal stub for brackets

      // Brackets live in their own local space centered at (0,0,0)
      const positions: number[] = [];

      // Left bracket corners (local)
      const TL = new THREE.Vector3(-halfW,  halfH, 0);
      const BL = new THREE.Vector3(-halfW, -halfH, 0);

      // Right bracket corners
      const TR = new THREE.Vector3( halfW,  halfH, 0);
      const BR = new THREE.Vector3( halfW, -halfH, 0);

      // Helper to push a line segment (a -> b)
      const seg = (a: THREE.Vector3, b: THREE.Vector3) => {
        positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
      };

      // Left bracket: ┌| and |└
      seg(TL.clone(), TL.clone().add(new THREE.Vector3( hx, 0, 0)));
      seg(TL.clone(), BL.clone());
      seg(BL.clone(), BL.clone().add(new THREE.Vector3( hx, 0, 0)));

      // Right bracket: |┐ and ┘|
      seg(TR.clone(), TR.clone().add(new THREE.Vector3(-hx, 0, 0)));
      seg(TR.clone(), BR.clone());
      seg(BR.clone(), BR.clone().add(new THREE.Vector3(-hx, 0, 0)));

      const geom = new THREE.BufferGeometry();
      geom.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3)
      );

      material = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
      });

      line = new THREE.LineSegments(geom, material);
      bracketGroup = new THREE.Group();
      bracketGroup.add(line);

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
      line = null;
      material = null;
    };

    return new UserAnimation(
      interpolation,
      (t: number, _tick?: number, isLast?: boolean) => {
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
    );
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
 * Deferred highlight animation over one or more LaTeX classes.
 *
 * It uses queryLaTeXClass(...) internally to find the meshes, then
 * pulses their color toward `highlightColor` for the duration.
 */
export function latexHighlightAnim(
  root: THREE.Object3D,
  classNames: string | string[],
  cfg: {
    durationMs?: number;
    highlightColor?: THREE.ColorRepresentation;
    pulses?: number;
    minMix?: number; // minimum mix factor between base and highlight
    maxMix?: number; // maximum mix factor between base and highlight
  } = {}
): () => UserAnimation {
  const {
    durationMs = 1000,
    highlightColor = 0xffdd55,
    pulses = 2,
    minMix = 0.0,
    maxMix = 1.0,
  } = cfg;

  const classList = Array.isArray(classNames) ? classNames : [classNames];
  const hiColor = new THREE.Color(highlightColor);

  return () => {
    const interpolation = easeInOutQuad(0, 1, durationMs);

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

    return new UserAnimation(
      interpolation,
      (t: number, _tick?: number, isLast?: boolean) => {
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
    );
  };
}
