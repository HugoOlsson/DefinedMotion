import * as THREE from 'three'
import { UserAnimation } from './protocols'
import { easeInOutQuad } from './interpolations'
import { setOpacity } from './animations'

/** Simple deterministic pseudo-random in [0,1) from an integer seed. */
function rand01(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

/** Sample a point inside triangle (a,b,c) using a seed for determinism. */
function samplePointInTriangle(
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  seed: number,
  out: THREE.Vector3
): THREE.Vector3 {
  let u = rand01(seed * 2 + 0)
  let v = rand01(seed * 2 + 1)
  // fold into triangle if outside
  if (u + v > 1) {
    u = 1 - u
    v = 1 - v
  }
  const w = 1 - u - v
  out.set(0, 0, 0)
  out.addScaledVector(a, u)
  out.addScaledVector(b, v)
  out.addScaledVector(c, w)
  return out
}

type Tri = { a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3; area: number; cdf: number }

/** Collect all world-space triangles + areas from the group. */
function collectWorldTriangles(group: THREE.Group): Tri[] {
  const tris: Tri[] = []

  const v0 = new THREE.Vector3()
  const v1 = new THREE.Vector3()
  const v2 = new THREE.Vector3()

  group.updateMatrixWorld(true)

  group.traverse(obj => {
    const mesh = obj as THREE.Mesh
    // @ts-ignore
    if (!mesh.isMesh) return

    const geom = mesh.geometry as THREE.BufferGeometry
    const posAttr = geom.getAttribute('position') as THREE.BufferAttribute | undefined
    if (!posAttr) return

    const matrix = mesh.matrixWorld
    const index = geom.index

    if (index) {
      const idx = index.array
      const triCount = idx.length / 3
      for (let t = 0; t < triCount; t++) {
        const i0 = idx[t * 3 + 0]
        const i1 = idx[t * 3 + 1]
        const i2 = idx[t * 3 + 2]

        v0.fromBufferAttribute(posAttr, i0).applyMatrix4(matrix)
        v1.fromBufferAttribute(posAttr, i1).applyMatrix4(matrix)
        v2.fromBufferAttribute(posAttr, i2).applyMatrix4(matrix)

        const area = v1.clone().sub(v0).cross(v2.clone().sub(v0)).length() * 0.5
        tris.push({ a: v0.clone(), b: v1.clone(), c: v2.clone(), area, cdf: 0 })
      }
    } else {
      const triCount = posAttr.count / 3
      for (let t = 0; t < triCount; t++) {
        const i0 = t * 3 + 0
        const i1 = t * 3 + 1
        const i2 = t * 3 + 2

        v0.fromBufferAttribute(posAttr, i0).applyMatrix4(matrix)
        v1.fromBufferAttribute(posAttr, i1).applyMatrix4(matrix)
        v2.fromBufferAttribute(posAttr, i2).applyMatrix4(matrix)

        const area = v1.clone().sub(v0).cross(v2.clone().sub(v0)).length() * 0.5
        tris.push({ a: v0.clone(), b: v1.clone(), c: v2.clone(), area, cdf: 0 })
      }
    }
  })

  // build CDF over area
  let total = 0
  for (const tri of tris) {
    total += tri.area
    tri.cdf = total
  }
  // guard against degenerate geometry
  if (total === 0) {
    tris.forEach((tri, i) => (tri.cdf = i + 1))
  }

  return tris
}

/**
 * Area-weighted surface sampling:
 * we pick triangles according to area so large regions get more particles.
 */
function buildSurfaceSamples(group: THREE.Group, count: number): Float32Array {
  const tris = collectWorldTriangles(group)
  const triCount = tris.length
  const out = new Float32Array(count * 3)

  if (triCount === 0) return out

  const totalArea = tris[triCount - 1].cdf
  const p = new THREE.Vector3()

  for (let i = 0; i < count; i++) {
    const r = rand01(1000 + i) * totalArea

    // binary search in CDF
    let lo = 0
    let hi = triCount - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (tris[mid].cdf >= r) hi = mid
      else lo = mid + 1
    }
    const tri = tris[lo]

    samplePointInTriangle(tri.a, tri.b, tri.c, i, p)
    const o3 = i * 3
    out[o3 + 0] = p.x
    out[o3 + 1] = p.y
    out[o3 + 2] = p.z
  }

  return out
}

/**
 * Sort positions in *x-buckets* (left→right) and by y inside each bucket.
 * This keeps mapping local: left-side points in "from" mostly pair with
 * left-side points in "to", etc.
 */
function sortPositions(positions: Float32Array, bucketCount: number = 36): Float32Array {
  const n = positions.length / 3
  if (n === 0) return positions

  // bounds
  let minX = +Infinity, maxX = -Infinity
  let minY = +Infinity, maxY = -Infinity
  for (let i = 0; i < n; i++) {
    const x = positions[i * 3 + 0]
    const y = positions[i * 3 + 1]
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  const scaleX = maxX > minX ? 1 / (maxX - minX) : 1
  const scaleY = maxY > minY ? 1 / (maxY - minY) : 1

  const buckets: number[][] = Array.from({ length: bucketCount }, () => [])

  // assign indices to x-buckets
  for (let i = 0; i < n; i++) {
    const xNorm = (positions[i * 3 + 0] - minX) * scaleX // 0..1
    let b = Math.floor(xNorm * bucketCount)
    if (b < 0) b = 0
    if (b >= bucketCount) b = bucketCount - 1
    buckets[b].push(i)
  }

  // sort each bucket primarily by y (and x as tie-breaker)
  for (const bucket of buckets) {
    bucket.sort((ia, ib) => {
      const ya = (positions[ia * 3 + 1] - minY) * scaleY
      const yb = (positions[ib * 3 + 1] - minY) * scaleY
      if (ya !== yb) return ya - yb
      const xa = (positions[ia * 3 + 0] - minX) * scaleX
      const xb = (positions[ib * 3 + 0] - minX) * scaleX
      return xa - xb
    })
  }

  // flatten buckets left→right into new ordered array
  const sorted = new Float32Array(positions.length)
  let dst = 0
  for (const bucket of buckets) {
    for (const idx of bucket) {
      const src = idx * 3
      sorted[dst + 0] = positions[src + 0]
      sorted[dst + 1] = positions[src + 1]
      sorted[dst + 2] = positions[src + 2]
      dst += 3
    }
  }

  return sorted
}

/** Choose a particle size roughly based on the combined bounding box. */
function estimateParticleSize(fromGroup: THREE.Group, toGroup: THREE.Group): number {
  const box = new THREE.Box3()
  box.expandByObject(fromGroup)
  box.expandByObject(toGroup)
  const size = box.getSize(new THREE.Vector3())
  const diag = size.length() || 1
  return diag * 0.003
}

function easeInOut(t: number): number {
  return t < 0.5
    ? 2 * t * t
    : 1 - Math.pow(-2 * t + 2, 2) / 2
}

function pickColorFromGroup(group: THREE.Group): THREE.Color {
  let picked: THREE.Color | null = null

  group.traverse(obj => {
    if (picked) return
    const mesh = obj as THREE.Mesh
    // @ts-ignore
    if (!mesh.isMesh) return

    const mat = mesh.material
    if (Array.isArray(mat)) {
      for (const m of mat) {
        const anyMat = m as any
        if (anyMat && anyMat.color && anyMat.color.isColor) {
          picked = anyMat.color.clone()
          return
        }
      }
    } else {
      const anyMat = mat as any
      if (anyMat && anyMat.color && anyMat.color.isColor) {
        picked = anyMat.color.clone()
      }
    }
  })

  return picked ?? new THREE.Color(0xffffff) // fallback
}

/**
 * DEFERRED VERSION
 *
 * Returns a factory () => UserAnimation so you can use:
 *
 *   dm.addDeferredAnims(
 *     latexParticleTransitionAnim(groupA, groupB, { durationMs: 1500, particleCount: 3000 })
 *   )
 *
 * No scene side-effects happen until the animation's updater runs.
 */
export function latexParticleTransitionAnim(
  fromGroup: THREE.Group,
  toGroup: THREE.Group,
  cfg: { durationMs?: number; particleCount?: number } = {}
): () => UserAnimation {
  const { durationMs = 1000, particleCount = 2500 } = cfg

  return () => {
    // Surface-sampled positions for both formulas (runtime, after layout)
    let startPositions = buildSurfaceSamples(fromGroup, particleCount)
    let endPositions   = buildSurfaceSamples(toGroup,   particleCount)

    if (startPositions.length === 0 || endPositions.length === 0) {
      const I = easeInOutQuad(0, 1, durationMs)
      return new UserAnimation(
        I,
        (t: number, _tick?: number, isLast?: boolean) => {
          setOpacity(fromGroup, 1 - t)
          setOpacity(toGroup, t)
          if (isLast) {
            setOpacity(fromGroup, 0)
            setOpacity(toGroup, 1)
          }
        }
      )
    }

    // Spatially sort both sets so index i ↔ i is a "nearby" mapping
    startPositions = sortPositions(startPositions)
    endPositions   = sortPositions(endPositions)

    // Create the particle geometry and material
    const geometry = new THREE.BufferGeometry()
    const currentPositions = new Float32Array(startPositions) // copy
    geometry.setAttribute('position', new THREE.BufferAttribute(currentPositions, 3))

    const particleSize = estimateParticleSize(fromGroup, toGroup)
    const baseColor    = pickColorFromGroup(fromGroup)

    const material = new THREE.PointsMaterial({
      size:        particleSize,
      color:       baseColor,
      transparent: true,
      opacity:     0,
      depthWrite:  false
    })

    const particles = new THREE.Points(geometry, material)
    particles.name = 'LatexParticleTransition'

    const parent = fromGroup.parent || toGroup.parent || null

    // Precompute deltas for lerp
    const deltas = new Float32Array(startPositions.length)
    for (let i = 0; i < startPositions.length; i++) {
      deltas[i] = endPositions[i] - startPositions[i]
    }

    const phase1End = 0.15
    const phase2End = 0.85
    const interpolation = easeInOutQuad(0, 1, durationMs)

    // Lazy init so the "planning" call in addDeferredAnims doesn't touch the scene
    let initialized = false

    return new UserAnimation(
      interpolation,
      (t: number, _tick?: number, isLast?: boolean) => {
        // One-time scene setup, only on first actual tick
        if (!initialized) {
          if (parent) parent.add(particles)
          setOpacity(fromGroup, 1)
          setOpacity(toGroup, 0)
          initialized = true
        }

        const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute
        const arr = posAttr.array as Float32Array

        const tt = easeInOut(t)
        for (let i = 0; i < arr.length; i += 3) {
          arr[i + 0] = startPositions[i + 0] + deltas[i + 0] * tt
          arr[i + 1] = startPositions[i + 1] + deltas[i + 1] * tt
          arr[i + 2] = startPositions[i + 2] + deltas[i + 2] * tt
        }
        posAttr.needsUpdate = true

        if (t < phase1End) {
          const s = t / phase1End
          setOpacity(fromGroup, 1 - s)
          setOpacity(toGroup, 0)
          material.opacity = s
        } else if (t < phase2End) {
          setOpacity(fromGroup, 0)
          setOpacity(toGroup, 0)
          material.opacity = 1
        } else {
          const s = (t - phase2End) / (1 - phase2End)
          setOpacity(fromGroup, 0)
          setOpacity(toGroup, s)
          material.opacity = 1 - s
        }

        if (isLast) {
          setOpacity(fromGroup, 0)
          setOpacity(toGroup, 1)
          material.opacity = 0

          if (parent) parent.remove(particles)
          geometry.dispose()
          material.dispose()
        }
      }
    )
  }
}


type SavedMaterialState = {
  mat: THREE.Material & { opacity?: number; transparent?: boolean };
  opacity: number;
  transparent: boolean;
};

type GlyphEntry = {
  centerX: number;
  mats: SavedMaterialState[];
};

/**
 * Deferred "Write" animation for a LaTeX SVG group.
 *
 * Usage:
 *   dm.addDeferredAnims(
 *     latexWriteAnim(latexGroup, {
 *       durationMs: 1200,
 *       direction: 'ltr',   // or 'rtl'
 *       penWidth: 0.18      // relative brush width (0.0–1.0-ish)
 *     })
 *   );
 */
export function latexWriteAnim(
  targetGroup: THREE.Group,
  cfg: {
    durationMs?: number;
    direction?: 'ltr' | 'rtl';
    penWidth?: number; // relative width of the "pen" over [minX,maxX]
  } = {}
): () => UserAnimation {
  const {
    durationMs = 1000,
    direction = 'ltr',
    penWidth = 0.15,
  } = cfg;

  return () => {
    targetGroup.updateMatrixWorld(true);

    const glyphs: GlyphEntry[] = [];
    const tmpBox = new THREE.Box3();
    const tmpCenter = new THREE.Vector3();

    let minX = +Infinity;
    let maxX = -Infinity;

    // Collect glyphs + save original material state
    targetGroup.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      // @ts-ignore
      if (!mesh.isMesh) return;
      if (!mesh.geometry) return;

      tmpBox.setFromObject(mesh);
      tmpBox.getCenter(tmpCenter);
      const cx = tmpCenter.x;

      const mat = mesh.material as any;
      const mats: SavedMaterialState[] = [];

      if (Array.isArray(mat)) {
        for (const m of mat) {
          if (!m) continue;
          const anyMat = m as any;
          mats.push({
            mat: anyMat,
            opacity: anyMat.opacity ?? 1,
            transparent: anyMat.transparent ?? false,
          });
        }
      } else if (mat) {
        const anyMat = mat as any;
        mats.push({
          mat: anyMat,
          opacity: anyMat.opacity ?? 1,
          transparent: anyMat.transparent ?? false,
        });
      }

      if (!mats.length) return;

      glyphs.push({ centerX: cx, mats });

      if (cx < minX) minX = cx;
      if (cx > maxX) maxX = cx;
    });

    // Degenerate fallback: simple fade-in
    if (!glyphs.length || !isFinite(minX) || !isFinite(maxX)) {
      const I = easeInOutQuad(0, 1, durationMs);
      return new UserAnimation(
        I,
        (t: number, _tick?: number, isLast?: boolean) => {
          setOpacity(targetGroup, t);
          if (isLast) setOpacity(targetGroup, 1);
        }
      );
    }

    const span = Math.max(maxX - minX, 1e-6);
    const brushHalf = span * Math.max(0.01, penWidth * 0.5);

  
   const startX = minX - brushHalf;
    const endX   = maxX + brushHalf;
    const totalPath = endX - startX;

    const hideAllGlyphs = () => {
      for (const g of glyphs) {
        for (const s of g.mats) {
          const m: any = s.mat;
          m.transparent = true;
          m.opacity = 0;
        }
      }
    };

    const restoreAllGlyphs = () => {
      for (const g of glyphs) {
        for (const s of g.mats) {
          const m: any = s.mat;
          m.opacity = s.opacity;
          m.transparent = s.transparent;
        }
      }
    };

    const interpolation = easeInOutQuad(0, 1, durationMs);
    let initialized = false;

    return new UserAnimation(
      interpolation,
      (t: number, _tick?: number, isLast?: boolean) => {
        if (!initialized) {
          hideAllGlyphs();
          initialized = true;
        }

        // smooth progress 0..1
        const tt = t//easeInOut(t);

        // Pen center moves on the extended path [startX, endX]
        const penCenter =
          direction === 'ltr'
            ? startX + totalPath * tt
            : endX   - totalPath * tt;

        for (const g of glyphs) {
          const dist = g.centerX - penCenter;

          let alpha: number;
          if (dist <= -brushHalf) {
            // far behind the pen -> fully visible
            alpha = 1;
          } else if (dist >= brushHalf) {
            // far ahead of the pen -> fully invisible
            alpha = 0;
          } else {
            // inside soft pen window, fade 0..1
            const u = (dist + brushHalf) / (2 * brushHalf); // 0..1
            alpha = 1 - u; // 1 at back edge, 0 at front edge
          }

          alpha = Math.max(0, Math.min(1, alpha));

          for (const s of g.mats) {
            const m: any = s.mat;
            m.transparent = true;
            m.opacity = s.opacity * alpha;
          }
        }

        if (isLast) {
          // By now everything should already be ~1.0, this just restores exact originals
          restoreAllGlyphs();
        }
      }
    );
  };
}