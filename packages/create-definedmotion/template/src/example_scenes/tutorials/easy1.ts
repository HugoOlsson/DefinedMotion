import { concatInterpols, easeInOutQuad, posXSigmoid } from '$renderer/lib/animation/interpolations'
import { createAnim } from '$renderer/lib/animation/protocols'
import { createCircle } from '$renderer/lib/rendering/objects2d'
import { AnimatedScene, HotReloadSetting, SpaceSetting } from '$renderer/lib/scene/sceneClass'

import * as THREE from 'three'

// Goal for this animation:
// Move a circle back and forth and continually change its color

// Step 1: Create function that returns AnimatedScene
export function tutorial_easy1(): AnimatedScene {
  // We return an animated scene that has some settings and lastly has a callback function
  // The first two parameters are resolution, this will be a vertical clip
  // The third argument sets if we want 3D or 2D
  // The forth allows us to say how hot reload should be handled,
  // With trace from start, at hot reload, the actions of all frames before the current, will be accounted for.
  // If you don't have accumulative changes (or if its fine without for debug), then it's much faster to use "HotReloadSetting.BeginFromCurrent" since it will only have to calculate the current frames actions.

  return new AnimatedScene(
    1080,
    1920,
    SpaceSetting.TwoDim,
    HotReloadSetting.TraceFromStart,
    (scene) => {
      // Helper function to create a "THREE.CircleGeometry"
      // You can just use any Three.js code if you want
      const circle = createCircle(5)

      // Add our circle to the scene
      scene.add(circle)

      // Create an animation that makes it move from left to right
      // This is very modular and easy to build on
      // createAnim takes two argument, an interpolation (just calculated number[]), and a call back function where you can use each value
      // So here we are creating the interpolation with easeInOutQuad: number[]
      // And give a function that is called for each frame with the current interpolation value
      const anim = createAnim(easeInOutQuad(-5, 5, 500), (value) => (circle.position.x = value))

      // We use "addAnims" to schedule an animation, it will run from the frame (tick) it was added at
      // Since this is our first added animation in this scene, we are currently at tick 0, So it will just add to the start.
      // But say that we are in a complex animation and our previous buildings would mean that we are at frame 49878 for example (we wouldn't know this)
      // Then it just adds the animation with that offset
      scene.addAnims(anim)

      // To make the circle also go back, we can reverse the entire animation and add it again
      // Notice that we are copying it, this is so that the reverse() doesn't affect the original variable "anim"
      scene.addAnims(anim.copy().reverse())

      // We now finally add a function that will be called at each frame (tick) in our animation
      // This doesn't push the tick forward like the "addAnims" does.
      // It just declares a function that should be run at each frame
      // For this animation, we want to set a color to the circle at each frame.
      scene.onEachTick((tick) => {
        circle.material.color = new THREE.Color().setRGB(posXSigmoid(circle.position.x / 4), 1, 1)
      })
    }
  )
}
