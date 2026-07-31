import { defineScene } from 'definedmotion'
import { moveTo } from 'definedmotion/animation'
import { createCircle } from 'definedmotion/rendering'
import { AnimatedScene, SpaceSetting } from 'definedmotion'

import * as THREE from 'three'


export default defineScene({
  id: 'tutorial-easy-1',
  name: 'Tutorial: Easy 1',
  create: tutorial_easy1
})
// Goal for this animation:
// Move a circle back and forth and continually change its color

// Step 1: Create function that returns AnimatedScene
export function tutorial_easy1(): AnimatedScene {
  // We return an animated scene that has some settings and lastly has a callback function
  // The first two parameters are resolution, this will be a vertical clip
  // The third argument sets if we want 3D or 2D
  // Use scene.previewFromHere() at a clean boundary when exact replay is too expensive during editing.

  return new AnimatedScene(
    1080,
    1920,
    SpaceSetting.TwoDim,
    (scene) => {
      // Helper function to create a "THREE.CircleGeometry"
      // You can just use any Three.js code if you want
      const circle = createCircle(5)
      circle.position.x = -5

      // Add our circle to the scene
      scene.add(circle)

      scene.addAnims(moveTo(circle, { x: 5, y: 0, z: 0 }, { duration: 0.5 }))
      scene.addAnims(moveTo(circle, { x: -5, y: 0, z: 0 }, { duration: 0.5 }))

      // We now finally add a function that will be called at each frame (tick) in our animation
      // This doesn't push the tick forward like the "addAnims" does.
      // It just declares a function that should be run at each frame
      // For this animation, we want to set a color to the circle at each frame.
      scene.onEachTick((tick) => {
        const distance = Math.abs(circle.position.x / 4)
        const colorMix = 2 * (1 / (1 + Math.exp(-distance)) - 0.5)
        circle.material.color = new THREE.Color().setRGB(colorMix, 1, 1)
      })
    }
  )
}
