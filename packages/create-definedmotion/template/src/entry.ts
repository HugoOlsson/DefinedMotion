import { AnimatedScene } from './renderer/src/lib/scene/sceneClass'
import { alternativesScene } from './example_scenes/alternativesScene'
import { dependencyScene } from './example_scenes/dependencyScene'
import { fourierSeriesScene } from './example_scenes/fourierSeriesScene'
import { keyboardScene } from './example_scenes/keyboardScene'
import { surfaceScene } from './example_scenes/surfaceScene'
import { vectorFieldScene } from './example_scenes/vectorField'
import { functionsAnimation } from './example_scenes/visulizingFunctions'

export const screenFps = 120 //Your screen fps
export const renderSkip = 2 //Will divide your screenFps with this for render output fps
export const animationFPSThrottle = 1 // Use to change preview fps, will divide your fps with this value

export const renderOutputFps = () => screenFps / renderSkip
export const entryScene: () => AnimatedScene = () => functionsAnimation()
