import type { AnimatedScene } from './renderer/src/lib/scene/sceneClass'

export type SceneFactory = () => AnimatedScene

export interface DefinedMotionSceneDefinition {
  /** Stable CLI-facing identifier. */
  id: string
  /** Optional human-readable name for Studio and other clients. */
  name?: string
  /** Marks a renderable scene as a visual test. */
  isTest?: boolean
  create: SceneFactory
}

export interface DefinedMotionSceneModule {
  default: DefinedMotionSceneDefinition
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
): DefinedMotionSceneDefinition => {
  validateSceneDefinition(definition, 'scene definition')
  return definition
}

const validateSceneDefinition = (
  definition: unknown,
  source: string
): asserts definition is DefinedMotionSceneDefinition => {
  if (!definition || typeof definition !== 'object') {
    throw new Error(`Invalid scene module ${source}: default export must use defineScene()`)
  }

  const candidate = definition as Partial<DefinedMotionSceneDefinition>
  if (typeof candidate.id !== 'string' || candidate.id.trim() === '') {
    throw new Error(`Invalid scene module ${source}: scene id must be a non-empty string`)
  }
  if (candidate.id !== candidate.id.trim()) {
    throw new Error(`Invalid scene module ${source}: scene id cannot start or end with whitespace`)
  }
  if (candidate.name !== undefined && typeof candidate.name !== 'string') {
    throw new Error(`Invalid scene module ${source}: scene name must be a string`)
  }
  if (candidate.isTest !== undefined && typeof candidate.isTest !== 'boolean') {
    throw new Error(`Invalid scene module ${source}: isTest must be a boolean`)
  }
  if (typeof candidate.create !== 'function') {
    throw new Error(`Invalid scene module ${source}: scene create must be a function`)
  }
}

/**
 * Converts eagerly discovered `*.scene.ts` modules into a stable scene registry.
 * File paths are retained in validation errors so duplicate IDs are actionable.
 */
export const collectSceneModules = (
  modules: Record<string, unknown>
): Record<string, DefinedMotionSceneDefinition> => {
  const scenes: Record<string, DefinedMotionSceneDefinition> = {}
  const sourceById = new Map<string, string>()

  for (const [source, importedModule] of Object.entries(modules).sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    const definition = (importedModule as Partial<DefinedMotionSceneModule> | undefined)?.default
    validateSceneDefinition(definition, source)

    const previousSource = sourceById.get(definition.id)
    if (previousSource) {
      throw new Error(
        `Duplicate scene id "${definition.id}" found in ${previousSource} and ${source}`
      )
    }

    scenes[definition.id] = definition
    sourceById.set(definition.id, source)
  }

  if (Object.keys(scenes).length === 0) {
    throw new Error('No scenes found. Add a default-exported *.scene.ts file under src/scenes')
  }

  return scenes
}

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
): Array<{ id: string; name: string; isDefault: boolean; isTest: boolean }> =>
  Object.values(project.scenes).map(({ id, name, isTest }) => ({
    id,
    name: name ?? id,
    isDefault: id === project.defaultScene,
    isTest: isTest ?? false
  }))
