# DefinedMotion - An animation library

This is a programmatic animation library, similar to 3Blue1Brown's Manim or Motion Canvas. It focuses on giving a very tight feedback loop for the development by just saving file to see updates directly (hot reload). It uses Three.js as rendering backend to get very performant rendering.



The key features of this project are:

* Hot reload by just saving file.
* Strong 2D and 3D rendering supported by Three.js
* The animation is declaratively specified.
* Very easy to create new primitives and define animations.
* Interactive viewport for inspection of scene.
* It's easy to express dependencies, which technical animations often have.

This project is very new, documentation will come soon. If you want to use it already, clone the repo, download with "npm install" and create a scene similar to how its done in /src/renderer/src/scenes

This will hopefully have better documentation soon. If you have any questions, feel free to contact me at hugo.contact01@gmail.com

## Project Setup

### Install

```bash
$ npm install
```

### Run animation

```bash
$ npm run dev
```

Previous names for this repository have been: 
* TickMotion
* MotionByDefinition