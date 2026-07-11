// tutorial_deferred_minimal.ts
import { defineScene } from '../../../project'
import * as THREE from 'three'

import { AnimatedScene, HotReloadSetting, SpaceSetting } from '$renderer/lib/scene/sceneClass'
import { createRectangle } from '$renderer/lib/rendering/objects2d'
import { easeInOutQuad } from '$renderer/lib/animation/interpolations'
import { createAnim } from '$renderer/lib/animation/protocols'


export default defineScene({
  id: 'test-deferred-anims-2',
  name: 'Deferred Anims2',
  isTest: true,
  create: test_deferred_anims2
})
/**
 * Minimal proof of deferred usefulness:
 * 1) Eager move: x: -3 → 0 (precomputed)
 * 2) Deferred move: from whatever x is *at runtime* → x + 4
 * 3) Deferred move: from the new live x → 0 (return)
 *
 * If you hot-reload or change earlier timing, the deferred steps still start from
 * the correct, current position because they capture runtime state via closure.
 */
export function test_deferred_anims2(): AnimatedScene {
  return new AnimatedScene(
    1000,
    1000,
    SpaceSetting.TwoDim,
    HotReloadSetting.TraceFromStart,
    async (scene) => {
      // A simple square (centered), easy to see
      const box = createRectangle(4, 4) as THREE.Mesh
      scene.add(box)

      // Start a bit left so we can see the eager move clearly
      box.position.set(-3, 0, 0)

      // --- 1) Eager (precomputed) move: -3 → 0 over 600 ticks ---
      const moveToCenter = createAnim(
        easeInOutQuad(-3, 0, 600),
        (x) => (box.position.x = x)
      )
      scene.addAnims(moveToCenter)

      // Give a short beat
      scene.addWait(300)

      // --- 2) Deferred move: from *current* x → x + 4 over 400 ticks ---
      // Captures box.position.x at runtime, not planning time.
      scene.addDeferredAnims(() =>
        createAnim(
          easeInOutQuad(box.position.x, box.position.x + 4, 400),
          (x) => (box.position.x = x)
        )
      )

      scene.addWait(200)

      // --- 3) Deferred move back: from *current* x → 0 over 400 ticks ---
      scene.addDeferredAnims(() =>
        createAnim(
          easeInOutQuad(box.position.x, 0, 400),
          (x) => (box.position.x = x)
        )
      )

      // Tail for renders
      scene.addWait(600)
    }
  )
}
