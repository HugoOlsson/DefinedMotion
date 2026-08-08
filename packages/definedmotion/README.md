# DefinedMotion

DefinedMotion is a TypeScript animation runtime and interactive viewer built on Three.js. It ships deterministic frame-based scheduling, measured text and LaTeX, 2D/3D rendering, scene verification, and an automation CLI for people and coding agents.

DefinedMotion requires Node.js 24.11 or newer.

Create a project:

```bash
npx create-definedmotion my-video
cd my-video
npm install
npm run dev
```

Minimal scene:

```ts
import { AnimatedScene, SpaceSetting, defineScene } from 'definedmotion'
import { fadeIn } from 'definedmotion/animation'
import { createText } from 'definedmotion/rendering'

const create = () =>
  new AnimatedScene(1920, 1080, SpaceSetting.TwoDim, async (scene) => {
    const title = await createText({ text: 'Defined motion', fontSize: 72 })
    scene.add(title)
    scene.addAnims(fadeIn(title))
  })

export default defineScene({ id: 'intro', name: 'Intro', create })
```

## Documentation

- [Documentation index](documentation/index.md)
- [Getting started](documentation/getting-started.md)
- [Scenes and timeline](documentation/scenes-and-timeline.md)
- [Animation effects](documentation/animation-effects.md)
- [Text, LaTeX, and layout](documentation/text-and-latex.md)
- [Verification](documentation/verification.md)
- [CLI](documentation/cli.md)

The interactive viewer can select any project scene and optionally expose packaged examples/tests. Final videos go to the consumer project's `renders/`; temporary runtime data stays under `.definedmotion/`.

The versioned [reference index](reference/INDEX.md) contains executable examples and regression scenes. Coding agents should also read the [agent workflow](reference/agent-workflow.md).
