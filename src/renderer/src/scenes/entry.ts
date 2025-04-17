import { AnimatedScene } from '../lib/scene/sceneClass'
import { alternativesScene } from './exampleScenes/alternativesScene'
import { dependencyScene } from './exampleScenes/dependencyScene'
import { keyboardScene } from './exampleScenes/keyboardScene'
import { surfaceScene } from './exampleScenes/surfaceScene'

export const screenFps = 120 //Your screen fps
export const renderSkip = 2 //Will divide your screenFps with this for render output fps
export const animationFPSThrottle = 1 // Use to change preview fps, will divide your fps with this value

export const renderOutputFps = () => screenFps / renderSkip
export const entryScene: () => AnimatedScene = () => keyboardScene()
