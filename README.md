# DefinedMotion - Programmatic Animations

###  Animate Three.js with all its power

This is a programmatic animation library, similar to 3Blue1Brown's Manim or Motion Canvas. It focuses on giving a tight feedback loop for development by seeing changes on save (hot reload) and providing the best capabilities for technical animations, both in 2D and 3D.



### Quick overview

- ⚡ **Hot-reload on save**  
  Tweak something, hit save, and see the change instantly in the viewer. No “render first, see later”. Saves minutes per iteration on heavy scenes.

- 🌌 **Full Three.js ecosystem**  
  Use *any* Three.js primitive or addon: PBR materials, lights, HDRI, helpers, post-processing, model loaders, controls — if it works in Three.js, you can animate it.

- 🚀 **One-line project setup**  
  Create a ready-to-run project with `npx create-definedmotion my-project` 

- 🔐 **Type-safe animations with TypeScript**  
  Build reusable helpers and scenes with full IDE support, refactors, and autocomplete.

- 🧭 **Interactive viewer**  
  Navigate your scene, orbit the camera, and copy the current position/rotation so you don’t have to guess values in code.

- 🧱 **Simple, low-level animation scheduler**  
  A small set of primitives (`addAnims`, `addDeferredAnims`, `onEachTick`, `doAt`, background sequences…) that stays easy to reason about and makes it trivial to build your own higher-level components and animation primitives.

- 🤖 **Great chatbot / AI assistant compatibility**  
  Because it uses standard TypeScript + Three.js, modern coding assistants already “understand” your scenes, shaders, loaders, cameras, and math, and can help you write and debug DefinedMotion code even though the library is new.

- 🎥 **One-click rendering**  
  When you’re happy with the result, click **Render** in the viewer. You only need FFmpeg installed when you’re ready for the final video.


<table>
  <tbody>
    <tr>
      <td><img src="resources/animation2.gif" alt="Fourier series animation" width="200" loading="lazy" decoding="async" /></td>
      <td><img src="resources/animation3.gif" alt="Keyboard clicking animation" width="200" loading="lazy" decoding="async" /></td>
    </tr>
    <tr>
     <td><img src="resources/animation5.gif" alt="Latex transition animation" width="200" loading="lazy" decoding="async" /></td>
      <td><img src="resources/animation4.gif" alt="3D Galton board producing a normal distribution" width="200" loading="lazy" decoding="async" /></td>
    </tr>
    <tr>
    <td><img src="resources/animation1.gif" alt="Math surface animation" width="200" loading="lazy" decoding="async" /></td>
    <td><img src="resources/animation6.gif" alt="Functions transition animation" width="200" loading="lazy" decoding="async" /></td>
     </tr>
  </tbody>
</table>


## How does it compare?

| Feature                  | **DefinedMotion**                                                                                               | **Manim (Community)**                                                                  | **Motion Canvas**                                                                                           |
|--------------------------|-----------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| **Performance**          | ⚡ Realtime playback in the viewer, even for heavy 3D scenes – no video render needed while iterating.          | Built for offline renders; seeing scenes often means waiting for a render             | ⚡ Realtime 2D playback in the viewer. No video render needed while iterating. However, no built-in 3D engine.                             |
| **Hot reload**           | ✅ Hot reload on save as a core workflow with timeline scrubbing.                                                                        | File-watch/CLI loops exist, but you still wait for each render (no true live hot reload) | ✅ Hot reload on save as a core workflow with timeline scrubbing.                                                    |
| **3D & rendering engine**| 🌌 Full **Three.js ecosystem**: PBR materials, lights, HDRI, helpers, post-processing, addons etc                  | Custom engine, 2D-first; 3D is possible but with less engine/ecosystem depth than Three.js | Designed for 2D Canvas. Great toolkit for this.             |
| **3D model import**      | 📦 Use any Three.js loader (GLTF/GLB, OBJ, FBX, STL, etc.) – imported models become first-class scene objects   | 3D object support is more limited; importing arbitrary 3D formats is possible but not a core focus | No native 3D mesh import; typically you work with shapes, images, and SVG in 2D                             |
| **Viewer & interaction** | 🧭 Interactive 3D and 2D viewer with timeline and helpers for camera handling.                            | A preview window. Often rendering to video and watching that.    | Great UI. Interactive 2D viewer with timeline and many helpers    |
| **Low-level control**    | 🧱 Low-level access: you work directly with Three.js objects and it's easy to build your own animation primitives      | Object model is extensible but more opinionated, deeper engine changes take more work. | Somewhat modular. Possibly awkward due to heavy use of generator functions and custom made engine.             |
| **LaTeX & math text**    | 🧮 LaTeX → SVG → 3D, plus APIs to query positions of substrings (for precise highlights, braces, arrows, etc.). LaTeX becomes true 3D. | Excellent LaTeX support out of the box, huge example base; finer spatial control is more manual | Great 2D LaTeX support with transitions.                     |
| **Install & first run**  | 🚀 `npx create-definedmotion my-project` – one line and you have it set up                                  | Python env + Manim install,  well-documented, lots of community resources. Very heavy LaTeX dependecy (~3–5GB).         | Nice easy setup. Uses npm like DM                             |
| **Rendering to video**   | 🎥 One-click render in the viewer, you only need `ffmpeg` when you’re ready for the final video                | Mature CLI rendering. Requires ffmpeg.                    | Easily rendering from the viewer. Requires ffmpeg.                                       |
| **Chatbot / AI support** | 🤖 Excellent: all major chatbots understand **TypeScript + Three.js**, so they can help with almost everything even though DefinedMotion is new | 🤖 Very good: Manim has a huge footprint; plus Python is well supported by chatbots | 🤖 Good; smaller ecosystem than Three.js means fewer pre-existing examples for assistants to draw from. |
| **Best fit for…**        | Technical animations in general, complex heavy scenes, math/CS/physics visuals, and Three.js-native workflows with fast iteration & hot reload | Math lectures, proofs, blackboard-style animations, especially in Python-centric stacks | 2D explainers with a visual timeline and audio sync. Nice primitives for building flexbox-like layouts and showing code |

## A dead-easy architecture
<img src="resources/scheduler2.png" alt="Image of the tick-based scheduler"  />

## Look at example scenes
Visit /src/example_scenes and look how scenes are made, this is likely a good way to learn the library. The entrypoint that specifies what scene that should be shown in the viewer is src/entry.ts.


### Create Scene 
```ts
export const yourSceneName = (): AnimatedScene => {
  return new AnimatedScene(1920, 1080, SpaceSetting.ThreeDim,
    HotReloadSetting.TraceFromStart, async (dm) => {

  })
}

```

### Scene tasks
```ts

  return new AnimatedScene(1920, 1080, SpaceSetting.ThreeDim,
    HotReloadSetting.TraceFromStart, async (dm) => {
    ...

    dm.addAnims(/* add animations, these will run in parallel*/)

    dm.addDeferredAnims(/* add animations functions, these will run in parallel. 
    The animations will be evaluated later to use the values that will be when the animation starts.*/)

    dm.onEachTick((frame, time) => {
        /* Run this function for every tick/frame */
        /* This is often used to set up dependencies or calculated movements */
        /* Conceptually it can be "On each tick, set the line endings at the position of sphere A and sphere B", this will make the line updated regardless of what happens to sphere A and B */
    })

    dm.do(() => {
        /* Add instruction at current tick/frame.
        This can be any function, it will be called at the tick.

        Often used to for example add elements to the scene
        */
    })

     dm.doAt(frame, () => {
        /* Add instruction at a certain tick/frame.
        This can be any function, it will be called at the tick.

        Often used to for example add elements to the scene
        */
    })

    dm.addWait(1000) //Will add an animation that does nothing (waits) for the duration

    dm.insertAnimsAt(frame, /* animations */ ) // Works like addAnims(...) but you can just insert an animation anywhere anytime. You can insert animations in the future or present during onEachTick. This is very powerful for complex animations.

    dm.addSequentialBackgroundAnims(/* Animations, these will run in sequence */) // This function allows you to add animations that will not push the timeline pointer, if you are at frame X and add an animation that is 300 frames long, this will not make the next added thing to be at X+300, but instead just X (because this adds it in the "background").


    // Register an audio before use, this function is often used in the absolute beginning of the scene.
    dm.registerAudio(/* audio path */)

    // Anywhere in the code (but after registerAudio of the sound), play the sound
    dm.playAudio(/* audio path */, volume)
    ...
  })

```


## Project Setup
 
1. Run `npx create-definedmotion project_name`
2. Install all dependencies with `npm install`
3. Run the animation viewer with `npm run dev`
4. Add your scene in src/scenes
5. Update the src/entry.ts file to use your animation.
6. When you want to render your animation, click "Render". You will need to have ffmpeg on your system and available in your system PATH.


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
    (dm) => {
      // Helper function to create a "THREE.CircleGeometry"
      // You can just use any Three.js code if you want
      const circle = createCircle(5)

      // Add our circle to the scene
      dm.add(circle)

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
      dm.addAnims(anim)

      // To make the circle also go back, we can reverse the entire animation and add it again
      // Notice that we are copying it, this is so that the reverse() doesn't affect the original variable "anim"
      dm.addAnims(anim.copy().reverse())

      // We now finally add a function that will be called at each frame (tick) in our animation
      // This doesn't push the tick forward like the "addAnims" does.
      // It just declares a function that should be run at each frame
      // For this animation, we want to set a color to the circle at each frame.
      dm.onEachTick((tick) => {
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

## Contact

 If you have any questions, feel free to contact me Hugo Olsson at hugo.contact01@gmail.com
<!--
## Created with DefinedMotion

### Fourier series scenes:
* https://www.reddit.com/r/manim/comments/1k53byc/what_do_you_guys_think_of_my_animation/
* https://www.youtube.com/shorts/sF5wHVjqrGA
* https://www.youtube.com/shorts/2vC4DHrBxas

### Animated function plots:
* https://www.youtube.com/shorts/Pi6R351Vi5s
  
### Keyboard animation:
* https://www.youtube.com/shorts/4efvamUyjxU


-->