declare module 'virtual:definedmotion-config' {
  import type { DefinedMotionConfig } from './project'
  export const definedMotionConfig: DefinedMotionConfig
}

declare module 'virtual:definedmotion-project' {
  import type { AnimatedScene } from './runtime/scene/sceneClass'
  import type { DefinedMotionProjectDefinition } from './project'
  export const project: DefinedMotionProjectDefinition
  export const entryScene: () => AnimatedScene
  export const renderSkip: number
}
