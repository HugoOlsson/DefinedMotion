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

export const screenFps = 120 //Your screen fps
export const renderSkip = 2 //Will divide your screenFps with this for render output fps
export const animationFPSThrottle = 1 // Use to change preview fps, will divide your fps with this value

export const renderOutputFps = () => screenFps / renderSkip
export const entryScene: () => AnimatedScene = () => tutorial_easy1()
