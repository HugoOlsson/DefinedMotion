import { wait } from 'definedmotion/animation'
import { defineScene } from 'definedmotion'

// Tutorial 3 (medium1.ts)
// Goal for this animation:
// 1) Light the scene with an HDRI (image-based lighting) + soft gradient background
// 2) Spawn a flock of spheres that wander smoothly with damped random acceleration
// 3) Draw dependency lines between neighbors to form a living chain
// 4) Orbit the camera around the action

import * as THREE from 'three'

import { AnimatedScene, SpaceSetting } from 'definedmotion'

// If your helpers live elsewhere, tweak these paths:
import {
  addBackgroundGradient,
} from 'definedmotion/rendering'
import { createLine } from 'definedmotion/rendering'
import { addHDRI, HDRIs, loadHDRIData } from 'definedmotion/rendering'


const applyOpacity = <T extends THREE.Object3D>(
  object: T,
  opacity: number,
  enableTransparency = true,
  hideWhenZero = true
): T => {
  const visible = opacity > 0.001
  if (hideWhenZero) object.visible = visible
  object.traverse((child) => {
    const material = (child as THREE.Object3D & { material?: THREE.Material | THREE.Material[] }).material
    for (const current of Array.isArray(material) ? material : material ? [material] : []) {
      if (enableTransparency) current.transparent = true
      current.opacity = opacity
      current.depthWrite = visible
    }
  })
  return object
}

export default defineScene({
  id: 'tutorial-medium-1',
  name: 'Tutorial: Medium 1',
  create: tutorial_medium1
})
// ─────────────────────────────────────────────────────────────────────────────
// Step 0: Scene constants and materials
// ─────────────────────────────────────────────────────────────────────────────
const NODE_COUNT = 200
const BOUNDARY_RADIUS = 10
const ORBIT_SPEED = 0.01

const sphereMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.3,
  metalness: 1.0
})

type Node = {
  mesh: THREE.Mesh
  velocity: THREE.Vector3
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1: Helper to make a moving node (sphere + velocity)
// ─────────────────────────────────────────────────────────────────────────────
function createNode(): Node {
  const geometry = new THREE.SphereGeometry(0.15, 32, 32)
  const mesh = new THREE.Mesh(geometry, sphereMaterial.clone())
  // Start near the origin with a tiny random offset so lines aren’t degenerate
  mesh.position.set(
    THREE.MathUtils.randFloatSpread(1),
    THREE.MathUtils.randFloatSpread(1),
    THREE.MathUtils.randFloatSpread(1)
  )
  return { mesh, velocity: new THREE.Vector3() }
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2: Export an AnimatedScene (3D, hot-reload from current frame)
// We don’t need to replay long histories, so BeginFromCurrent makes iteration fast.
// ─────────────────────────────────────────────────────────────────────────────
export function tutorial_medium1(): AnimatedScene {
  return new AnimatedScene(
    1080, // width  (vertical clip like easy1)
    1920, // height
    SpaceSetting.ThreeDim, // 3D scene
    async (scene) => {
      // ───────────────────────────────────────────────────────────────────────
      // Step 3: Lighting & background
      // HDRI gives nice reflections/IBL; gradient provides a subtle backdrop.
      // ───────────────────────────────────────────────────────────────────────
      const hdriData = await loadHDRIData(HDRIs.photoStudio1, 2) // (lods, intensity normalization)
      await addHDRI(scene, hdriData, 0.3, 0.5) // envMap intensity

      addBackgroundGradient({
        scene,
        topColor: 0xaa9775, // warm top
        bottomColor: 0x483924, // rich brown base
        backgroundOpacity: 0.7
      })

      // Optional helpers if you like visual anchors:
      //scene.add(new THREE.GridHelper(30, 30))

      // ───────────────────────────────────────────────────────────────────────
      // Step 4: Create moving nodes and dependency lines (neighbor chain)
      // We connect each node i to node (i+1) to visualize a simple dependency.
      // ───────────────────────────────────────────────────────────────────────
      const nodes: Node[] = Array.from({ length: NODE_COUNT }, createNode)
      const lines = nodes.map(() => applyOpacity(createLine(), 0.12)) // faint lines

      scene.add(...nodes.map((n) => n.mesh), ...lines)

      // ───────────────────────────────────────────────────────────────────────
      // Step 5: Camera setup — start out on the +X axis and orbit around origin
      // ───────────────────────────────────────────────────────────────────────
      scene.camera.position.set(30, 20, 0)
      const center = new THREE.Vector3(0, 0, 0)
      const orbitRadius = scene.camera.position.distanceTo(center)
      let angle = 0

      // ───────────────────────────────────────────────────────────────────────
      // Step 6: Per-frame simulation
      // - Each node gets a tiny random acceleration (smooth wander)
      // - Velocity is damped for stability
      // - Soft boundary: gentle pull toward center if too far
      // - Lines update to connect neighbors (i -> i+1)
      // - Camera orbits and keeps looking at the center
      // ───────────────────────────────────────────────────────────────────────
      scene.onEachTick((tick) => {
        // Physics update
        for (const n of nodes) {
          // Small random acceleration
          const ax = (Math.random() - 0.5) * 0.05
          const ay = (Math.random() - 0.5) * 0.05
          const az = (Math.random() - 0.5) * 0.05
          n.velocity.x += ax
          n.velocity.y += ay
          n.velocity.z += az

          // Damping (retain ~95% of previous velocity)
          n.velocity.multiplyScalar(0.95)

          // Integrate
          n.mesh.position.add(n.velocity)

          // Soft boundary: if outside radius, nudge back toward origin
          const len = n.mesh.position.length()
          if (len > BOUNDARY_RADIUS) {
            const pull = n.mesh.position.clone().negate().normalize().multiplyScalar(0.02)
            n.velocity.add(pull)
          }
        }

        // Update dependency lines (chain)
        for (let i = 0; i < nodes.length; i++) {
          const a = nodes[i].mesh.position
          const b = nodes[(i + 1) % nodes.length].mesh.position // wrap to form a loop
          // createLine() returns a handle with updatePositions(start, end)
          lines[i].updatePositions(a, b)
        }

        // Camera orbit
        angle += ORBIT_SPEED
        scene.camera.position.x = Math.sin(angle) * orbitRadius
        scene.camera.position.z = Math.cos(angle) * orbitRadius
        scene.camera.lookAt(center)
      })

      // ───────────────────────────────────────────────────────────────────────
      // Step 7: Let it play for 20 seconds before finishing
      // ───────────────────────────────────────────────────────────────────────
      scene.addAnims(wait((20_000) / 1000))
    }
  )
}
