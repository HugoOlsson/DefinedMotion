import type { AnimatedScene } from './renderer/src/lib/scene/sceneClass'

export type SceneFactory = () => AnimatedScene

export interface DefinedMotionSceneDefinition {
  /** Stable CLI-facing identifier. */
  id: string
  /** Optional human-readable name for Studio and other clients. */
  name?: string
  create: SceneFactory
}

export interface DefinedMotionProjectDefinition {
  fps: number
  renderEveryNthFrame: number
  seed: number | string
  defaultScene: string
  scenes: Record<string, DefinedMotionSceneDefinition>
}

export const defineScene = (
  definition: DefinedMotionSceneDefinition
): DefinedMotionSceneDefinition => definition

export const defineProject = (
  definition: DefinedMotionProjectDefinition
): DefinedMotionProjectDefinition => {
  if (!Number.isFinite(definition.fps) || definition.fps <= 0) {
    throw new Error('DefinedMotion project FPS must be a positive number')
  }

  if (!Number.isInteger(definition.renderEveryNthFrame) || definition.renderEveryNthFrame < 1) {
    throw new Error('renderEveryNthFrame must be a positive integer')
  }

  if (typeof definition.seed === 'number' && !Number.isFinite(definition.seed)) {
    throw new Error('DefinedMotion project seed must be finite')
  }

  if (!definition.scenes[definition.defaultScene]) {
    throw new Error(`Default scene "${definition.defaultScene}" is not registered`)
  }

  for (const [key, scene] of Object.entries(definition.scenes)) {
    if (scene.id !== key) {
      throw new Error(`Scene registry key "${key}" must match scene id "${scene.id}"`)
    }
  }

  return definition
}

export const listProjectScenes = (
  project: DefinedMotionProjectDefinition
): Array<{ id: string; name: string; isDefault: boolean }> =>
  Object.values(project.scenes).map(({ id, name }) => ({
    id,
    name: name ?? id,
    isDefault: id === project.defaultScene
  }))
