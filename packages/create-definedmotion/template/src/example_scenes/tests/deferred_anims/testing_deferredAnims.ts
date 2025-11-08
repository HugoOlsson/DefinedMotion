// tutorial_deferred_closure_test.ts
import * as THREE from 'three'

import { AnimatedScene, HotReloadSetting, SpaceSetting } from '$renderer/lib/scene/sceneClass'
import { createRectangle } from '$renderer/lib/rendering/objects2d'
import { moveRotateCameraAnimation3D } from '$renderer/lib/animation/animations'
import { easeInOutQuad } from '$renderer/lib/animation/interpolations'
import { createAnim } from '$renderer/lib/animation/protocols'

/**
 * Demo: proves that addDeferredAnims (closure-based) captures runtime state.
 * - You can drag/orbit before pressing Play.
 * - When playback reaches the deferred blocks, the move starts from the *live* camera pose.
 * - Also shows an eager animation (card rocking) that’s precomputed with addAnims.
 */
export function test_deferred_anims(): AnimatedScene {
  return new AnimatedScene(
    1080,
    1920,
    SpaceSetting.ThreeDim,
    HotReloadSetting.TraceFromStart,
    async (scene) => {
      // Visual anchors
      scene.add(new THREE.GridHelper(30, 30))
      const card = createRectangle(6, 4)
      card.position.set(0, 2, 0)
      scene.add(card)

      // Initial camera (user can move it freely before Play)
      scene.camera.position.set(10, 6, 12)
      scene.camera.lookAt(new THREE.Vector3(0, 1, 0))

      // Eager anim (pure, precomputable) — keeps the scene alive regardless of camera
      const rock = createAnim(easeInOutQuad(-0.3, 0.3, 180), (v) => (card.rotation.z = v))
      scene.addAnims(rock)
      scene.addAnims(rock.copy().reverse()) // 360 ticks total
      scene.addWait(800)

      // -------- Deferred camera move #1 (uses your addDeferredAnims signature) --------
      // NOTE: Builders have no args; they close over `scene` to access live camera state.
      scene.addDeferredAnims(() =>
        moveRotateCameraAnimation3D(
          scene.camera,
          scene.camera.position,   // captured at runtime
          scene.camera.quaternion, // captured at runtime
          new THREE.Vector3(8, 8, 8),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.6, 0.6, 0)),
          2000
        )
      )

      scene.addWait(600)

      // -------- Deferred camera move #2 (chained) --------
      // Starts from the end pose of move #1, because it’s captured at that runtime tick.
      scene.addDeferredAnims(() =>
        moveRotateCameraAnimation3D(
          scene.camera,
          scene.camera.position,
          scene.camera.quaternion,
          new THREE.Vector3(0, 3, 16),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0.02, 0, 0)),
          2000
        )
      )

      // Tail for export
      scene.addWait(1200)
    }
  )
}
