import { defineScene } from 'definedmotion'

// Tutorial 2 (easy2.ts)
// Goal for this animation:
// 1) Render a time-varying mathematical surface (z = f(x, y, t))
// 2) Add a glowing orb with a point light
// 3) Animate the camera on a smooth orbit while the surface deforms

import * as THREE from 'three'

import { AnimatedScene, HotReloadSetting, SpaceSetting } from 'definedmotion'

// If your helpers live elsewhere, tweak these paths:'
import { createFunctionSurface, updateFunctionSurface } from 'definedmotion/rendering'
import { addBackgroundGradient } from 'definedmotion/rendering'


export default defineScene({
  id: 'tutorial-easy-2',
  name: 'Tutorial: Easy 2',
  create: tutorial_easy2
})
// ─────────────────────────────────────────────────────────────────────────────
// Step 0: Materials used by our surface and our glowing sphere
// MeshStandardMaterial gives us physically-based shading that reacts to lights.
// For the sphere, we use a strong emissive color so it "glows" even without light.
// ─────────────────────────────────────────────────────────────────────────────
const surfaceMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  metalness: 0.8,
  roughness: 0.1,
  side: THREE.DoubleSide
}) as any // cast to any to satisfy TS if createFunctionSurface has a stricter type

const sphereMaterial = new THREE.MeshStandardMaterial({
  color: 0x000000, // base color (almost irrelevant since emissive dominates)
  emissive: 0xffffff, // self-illumination color
  emissiveIntensity: 200 // strong glow
})

// ─────────────────────────────────────────────────────────────────────────────
// Step 1: A time-dependent function that returns a surface height function.
// We return a function (x, y) => z that changes smoothly over time.
// Try tweaking constants to see different wave behaviors.
// ─────────────────────────────────────────────────────────────────────────────
const sineTimeFunction = (time: number): ((x: number, y: number) => number) => {
  return (x: number, y: number) =>
    (5 * (Math.sin(x * 2 + time) * Math.cos(y * 2 + time))) /
      (Math.pow(Math.abs(x) + Math.abs(y), 2) + 5) +
    3
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2: Export an AnimatedScene just like in tutorial 1, but in 3D.
// We use HotReloadSetting.BeginFromCurrent since it will be much faster during debug.
// Since this has accumulative effects (angle += 0.005) notice that the angle is not correct at hot reload.
// Regardless of our HotReloadSetting, the renders will always be correct
// ─────────────────────────────────────────────────────────────────────────────
export function tutorial_easy2(): AnimatedScene {
  return new AnimatedScene(
    1500, // width  (square clip)
    1500, // height
    SpaceSetting.ThreeDim, // 3D scene
    HotReloadSetting.BeginFromCurrent,
    async (scene) => {
      // ───────────────────────────────────────────────────────────────────────
      // Step 3: Basic environment (background gradient)
      // ───────────────────────────────────────────────────────────────────────
      addBackgroundGradient({
        scene,
        topColor: 0x0c8ccd, // blue-ish
        bottomColor: 0x000000, // black
        lightingIntensity: 10
      })

      // We use three.js directly to create a grid and axes
      const gridHelper = new THREE.GridHelper(20, 20)
      const axesHelper = new THREE.AxesHelper(20)
      scene.add(gridHelper, axesHelper)

      // ───────────────────────────────────────────────────────────────────────
      // Step 4: Create a function surface over a domain.
      // We start with t = 0, then update it every frame in onEachTick.
      // The returned object is a THREE.Mesh we can style like any other mesh.
      // ───────────────────────────────────────────────────────────────────────
      const DOMAIN: [number, number, number, number] = [-7, 7, -7, 7] // [xMin, xMax, yMin, yMax]
      const surface = createFunctionSurface(sineTimeFunction(0), ...DOMAIN)
      surface.material = surfaceMaterial
      scene.add(surface)

      // ───────────────────────────────────────────────────────────────────────
      // Step 5: Add a glowing sphere with a point light.
      // We put them in a Group so they move together if we want.
      // The light’s position is kept in sync with the sphere.
      // ───────────────────────────────────────────────────────────────────────
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 32), sphereMaterial)
      const pointLight = new THREE.PointLight(0xffffff, 50) // (color, intensity)
      pointLight.position.copy(sphere.position)

      const orbGroup = new THREE.Group()
      orbGroup.add(sphere, pointLight)
      orbGroup.position.y = 6 // float above the surface a bit
      scene.add(orbGroup)

      // ───────────────────────────────────────────────────────────────────────
      // Step 6: Camera setup + gentle orbit animation.
      // We place the camera, measure its distance to the origin, and then
      // slowly orbit around (0,0,0). The wobble changes radius over time.
      // Thees numbers for the position is difficult to guess,
      // the workflow is therefore to navigate the scene to where you want it and then copy the positions it prints.
      // This avoids awkward value guessing for position and rotation
      // ───────────────────────────────────────────────────────────────────────
      scene.camera.position.set(3.889329, 7.895859, 10.51772)
      scene.camera.rotation.set(-0.6027059, 0.3079325, 0.2056132)

      const LOOK_AT = new THREE.Vector3(0, 0, 0)
      const baseRadius = scene.camera.position.distanceTo(LOOK_AT)
      let angle = 0

      // ───────────────────────────────────────────────────────────────────────
      // Step 7: Per-frame updates.
      // - Update the surface with the current time (tick)
      // - Keep the orb group floating
      // - Orbit the camera and keep it looking at the center
      // ───────────────────────────────────────────────────────────────────────
      scene.onEachTick((tick) => {
        const t = tick / 20
        const f = sineTimeFunction(t)
        updateFunctionSurface(surface, f, ...DOMAIN)

        // Keep the orb hovering above the surface
        orbGroup.position.y = 6

        // Camera orbit with a subtle radius wobble
        angle += 0.005
        const wobble = (Math.sin(tick / 50) + 2) / 2 // ranges roughly [0.5, 1.5]
        scene.camera.position.x = Math.sin(angle) * baseRadius * wobble
        scene.camera.position.z = Math.cos(angle) * baseRadius * wobble
        scene.camera.lookAt(LOOK_AT)
      })

      // ───────────────────────────────────────────────────────────────────────
      // Step 8: Let the animation run for a while before finishing.
      // This adds 10 seconds of "play time" to the scene’s schedule.
      // ───────────────────────────────────────────────────────────────────────
      scene.addWait(10_000)
    }
  )
}
