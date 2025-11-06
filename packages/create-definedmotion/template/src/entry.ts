import { AnimatedScene } from './renderer/src/lib/scene/sceneClass'
import { dependencyScene } from './example_scenes/dependencyScene'
import { alternativesScene } from './example_scenes/alternativesScene'
import { fourierSeriesScene } from './example_scenes/fourierSeriesScene'
import { keyboardScene } from './example_scenes/keyboardScene'
import { surfaceScene } from './example_scenes/surfaceScene'
import { vectorFieldScene } from './example_scenes/vectorField'
import { functionsAnimation } from './example_scenes/visulizingFunctions'
import { tutorial_easy1 } from './example_scenes/tutorials/easy1'
import { tutorial_easy2 } from './example_scenes/tutorials/easy2'
import { tutorial_medium1 } from './example_scenes/tutorials/medium1'
import { tutorial_easy3 } from './example_scenes/tutorials/easy3'


export const renderSkip = 1 // Must be an integer. Will only render only N:th frame
export const animationFPSDivider = 1 //Must be an integer. Will change the fundamental animation FPS, how many ticks/frames that are played in a certain time

export const entryScene: () => AnimatedScene = () => tutorial_easy1()
