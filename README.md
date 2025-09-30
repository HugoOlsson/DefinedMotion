# DefinedMotion - An animation library

### Animate Three.js with all its power

This is a programmatic animation library, similar to 3Blue1Brown's Manim or Motion Canvas. It focuses on giving a tight feedback loop for development by seeing changes on save (hot reload) and providing great rendering capabilities for 2D and 3D.


### Quick Overview

- Library + viewer for building animations in **TypeScript**
- **Hot-reload on save** for a super-fast feedback loop
- Use **ANY** primitive/feature the Three.js ecosystem gives.
- Type safety by building animation by using TypeScript.
- **One-click rendering** (FFmpeg) for final output
- **Interactive viewer** for navigating and inspecting the scene
- Performant for complex animations, Three.js plus the faster runtime speed of TypeScript compared to Python helps productivity.
- **Declarative** scene + animation API with easy dependency composition


<div style="
  display:grid;
  gap:8px;
  grid-template-columns:repeat(2, minmax(200px, 1fr));
  max-width:calc(2 * 200px + 8px);  /* cap at 2 cells wide */
  width:100%;
  margin:0 auto;
 "> 
  <img src="resources/animation1.gif" alt="Math surface animation" width="200" loading="lazy" decoding="async" />
  <img src="resources/animation4.gif" alt="3D Galton board producing a normal distribution" width="200" loading="lazy" decoding="async" />
  <img src="resources/animation2.gif" alt="Fourier series animation" width="200" loading="lazy" decoding="async" />
  <img src="resources/animation3.gif" alt="Keyboard clicking animation" width="200" loading="lazy" decoding="async" />
 
</div>


## Look at example scenes
Visit /src/example_scenes and look how scenes are made, this is likely a good way to learn the library. The entrypoint that specifies what scene that should be shown in the viewer is src/entry.ts.


### Create Scene 
```ts
export const yourSceneName = (): AnimatedScene => {
  return new AnimatedScene(1920, 1080, SpaceSetting.ThreeDim,
    HotReloadSetting.TraceFromStart, async (scene) => {

  })
}

```

### Scene tasks
```ts

  return new AnimatedScene(1920, 1080, SpaceSetting.ThreeDim,
    HotReloadSetting.TraceFromStart, async (scene) => {
    ...

    scene.addAnim(/* add animations, these will run in parallel*/)

    scene.onEachTick((tick, time) => {
        /* Run this function for every tick/frame */
        /* This is often used to set up dependencies or calculated movements */
        /* Conceptually it can be "On each tick, set the line endings at the position of sphere A and sphere B", this will make the line updated regardless of what happens to sphere A and B */
    })

    scene.do(() => {
        /* Add instruction at current tick/frame.
        This can be any function, it will be called at the tick.

        Often used to for example add elements to the scene
        */
    })

    scene.addWait(1000) //Will add an animation that does nothing (waits) for the duration

    scene.insertAnimAt(tick, /* animations */ ) // Works like addAnim(...) but you can just insert an animation anywhere anytime. You can insert animations in the future or present during onEachTick. This is very powerful for complex animations.

    scene.addSequentialBackgroundAnims(/* Animations, these will run in sequence */) // This function allows you to add animations that will not push the timeline pointer, if you are at frame X and add an animation that is 300 frames long, this will not make the next added thing to be at X+300, but instead just X (because this adds it in the "background").


    // Register an audio before use, this function is often used in the absolute beginning of the scene.
    scene.registerAudio(/* audio path */)

    // Anywhere in the code (but after registerAudio of the sound), play the sound
    scene.playAudio(/* audio path */, volume)
    ...
  })

```

This project is very new, more documentation will come soon.



## Project Setup
 
1. Run `npx create-definedmotion project_name`
2. Install all dependencies with `npm install`
3. Run the animation viewer with `npm run dev`
4. Add your scene in src/scenes
5. Update the src/entry.ts file to use your animation.
6. When you want to render your animation, click "Render". You will need to have ffmpeg on your system and available in your system PATH.

This will hopefully have better documentation soon. If you have any questions, feel free to contact me at hugo.contact01@gmail.com

## Easy example
```ts
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

      // We use "addAnim" to schedule an animation, it will run from the frame (tick) it was added at
      // Since this is our first added animation in this scene, we are currently at tick 0, So it will just add to the start.
      // But say that we are in a complex animation and our previous buildings would mean that we are at frame 49878 for example (we wouldn't know this)
      // Then it just adds the animation with that offset
      scene.addAnim(anim)

      // To make the circle also go back, we can reverse the entire animation and add it again
      // Notice that we are copying it, this is so that the reverse() doesn't affect the original variable "anim"
      scene.addAnim(anim.copy().reverse())

      // We now finally add a function that will be called at each frame (tick) in our animation
      // This doesn't push the tick forward like the "addAnim" does.
      // It just declares a function that should be run at each frame
      // For this animation, we want to set a color to the circle at each frame.
      scene.onEachTick((tick) => {
        circle.material.color = new THREE.Color().setRGB(posXSigmoid(circle.position.x / 4), 1, 1)
      })
    }
  )
}


```

#### Animated function surface
```ts
// Goal for this animation:
// 1) Render a time-varying mathematical surface (z = f(x, y, t))
// 2) Add a glowing orb with a point light
// 3) Animate the camera on a smooth orbit while the surface deforms

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

```

## Created with DefinedMotion

### Fourier series scenes:
* https://www.reddit.com/r/manim/comments/1k53byc/what_do_you_guys_think_of_my_animation/
* https://www.youtube.com/shorts/sF5wHVjqrGA
* https://www.youtube.com/shorts/2vC4DHrBxas

### Animated function plots:
* https://www.youtube.com/shorts/Pi6R351Vi5s
  
### Keyboard animation:
* https://www.youtube.com/shorts/4efvamUyjxU


