# DefinedMotion - An animation library

This is a programmatic animation library, similar to 3Blue1Brown's Manim or Motion Canvas. It focuses on giving a very tight feedback loop for the development by just saving file to see updates directly (hot reload). It uses Three.js as rendering backend to get very performant rendering.


The key features of this project are:

* Hot reload by just saving file.
* Strong 2D and 3D rendering supported by Three.js
* The animation is declaratively specified.
* Very easy to create new primitives and define animations.
* Interactive viewport for inspection of scene.
* It's easy to express dependencies, which technical animations often have.

<table>
  <tr>
    <td><img src="resources/animation2.gif" alt="Fourier series animation" width="200" /></td>
    <td><img src="resources/animation3.gif" alt="Keyboard clicking animation" width="200" /></td>
  </tr>
</table>
<img src="resources/animation1.gif" alt="Math surface animation" width="200" />


## Look at example scenes
Visit /src/renderer/src/scenes and look how scenes are made, this is likely a good way to learn the library.


### Create Scene 
```ts
export const yourSceneName = (): AnimatedScene => {
  return new AnimatedScene(1920, 1080, true, true, async (scene) => {

  })
}

```

### Scene tasks
```ts

  return new AnimatedScene(1920, 1080, true, true, async (scene) => {
    ...

    scene.addAnim(/* add animation, these will run in parallel*/)

    scene.onEachTick((tick, time) => {
        /* Run this function for every tick/frame */
        /* This is often used to set up dependencies or calculated movements */
        /* Conceptually it can be "On each tick, set the line endings at the position of sphere A and sphere B", this will make the line updated regardless of what happens to sphere A and B */
    })

    scene.do(() => {
        /* Add frame/tick instruction at current tick.
        This can be any function, it will be called at the tick.

        Often used to for example add elements to the scene
        */
    })

    scene.addWait(1000) //Will add an animation that does nothing (waits) for the duration

    scene.insertAnimAt(tick, /* animations */ ) // Works like addAnim(...) but you can just insert an animation anywhere anytime. You can insert animations in the future or present during onEachTick. This is very powerful for complex animations.
    ...
  })

```

This project is very new, more documentation will come soon.



## Project Setup
 
1. Clone this repo, and work within the folder /src/renderer/src/scenes.
You can create a folder like /src/renderer/src/scenes/yourname.
2. Install all dependencies with `npm install`
3. Run the animation viewer with `npm run dev`
4. Update the entry.ts file to use your animation.
5. When you want to render your animation, click "Render". You will need to have ffmpeg on your system and available in your system PATH.

This will hopefully have better documentation soon. If you have any questions, feel free to contact me at hugo.contact01@gmail.com

Previous names for this repository have been: 
* TickMotion
* MotionByDefinition