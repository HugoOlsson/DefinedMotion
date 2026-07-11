import { AnimatedScene } from './renderer/src/lib/scene/sceneClass'
import { dependencyScene } from './example_scenes/dependencyScene'
import { alternativesScene } from './example_scenes/alternativesScene'
import { fourierSeriesScene } from './example_scenes/fourierSeriesScene'
import { keyboardScene } from './example_scenes/keyboardScene'
import { surfaceScene } from './example_scenes/surfaceScene'
import { vectorFieldScene } from './example_scenes/vectorField'
import { animatedFunctionsScene } from './example_scenes/visulizingFunctions'
import { tutorial_easy1 } from './example_scenes/tutorials/easy1'
import { tutorial_easy2 } from './example_scenes/tutorials/easy2'
import { tutorial_medium1 } from './example_scenes/tutorials/medium1'
import { tutorial_easy3 } from './example_scenes/tutorials/easy3'
import { definedMotionConfig } from './definedmotion.config'
import { defineProject, defineScene } from './project'

export const project = defineProject({
  fps: definedMotionConfig.timelineFps,
  renderEveryNthFrame: definedMotionConfig.renderEveryNthFrame,
  seed: definedMotionConfig.seed,
  defaultScene: 'tutorial-easy-1',
  scenes: {
    'tutorial-easy-1': defineScene({
      id: 'tutorial-easy-1',
      name: 'Tutorial: Easy 1',
      create: tutorial_easy1
    }),
    'tutorial-easy-2': defineScene({
      id: 'tutorial-easy-2',
      name: 'Tutorial: Easy 2',
      create: tutorial_easy2
    }),
    'tutorial-easy-3': defineScene({
      id: 'tutorial-easy-3',
      name: 'Tutorial: Easy 3',
      create: tutorial_easy3
    }),
    'tutorial-medium-1': defineScene({
      id: 'tutorial-medium-1',
      name: 'Tutorial: Medium 1',
      create: tutorial_medium1
    }),
    dependency: defineScene({
      id: 'dependency',
      name: 'Dependency Scene',
      create: dependencyScene
    }),
    alternatives: defineScene({
      id: 'alternatives',
      name: 'Alternatives',
      create: alternativesScene
    }),
    'fourier-series': defineScene({
      id: 'fourier-series',
      name: 'Fourier Series',
      create: fourierSeriesScene
    }),
    keyboard: defineScene({ id: 'keyboard', name: 'Keyboard', create: keyboardScene }),
    surface: defineScene({ id: 'surface', name: 'Surface', create: surfaceScene }),
    'vector-field': defineScene({
      id: 'vector-field',
      name: 'Vector Field',
      create: vectorFieldScene
    }),
    functions: defineScene({
      id: 'functions',
      name: 'Visualizing Functions',
      create: animatedFunctionsScene
    })
  }
})

/** Backwards-compatible exports used by the existing Studio and render path. */
export const renderSkip = project.renderEveryNthFrame
export const animationFPSDivider = 1
export const entryScene: () => AnimatedScene = () => project.scenes[project.defaultScene].create()
