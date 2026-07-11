import type { AnimatedScene } from './renderer/src/lib/scene/sceneClass'
import { definedMotionConfig } from './definedmotion.config'
import { defineProject } from './project'
import { scenes } from './sceneRegistry'

export const project = defineProject({
  fps: definedMotionConfig.timelineFps,
  renderEveryNthFrame: definedMotionConfig.renderEveryNthFrame,
  seed: definedMotionConfig.seed,
  defaultScene: definedMotionConfig.defaultScene,
  scenes
})

/** Backwards-compatible exports used by the existing Studio and render path. */
export const renderSkip = project.renderEveryNthFrame
export const animationFPSDivider = 1
export const entryScene: () => AnimatedScene = () => project.scenes[project.defaultScene].create()
