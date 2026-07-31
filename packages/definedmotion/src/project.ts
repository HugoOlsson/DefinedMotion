import type { AnimatedScene } from './runtime/scene/sceneClass'

export type SceneFactory = () => AnimatedScene

export type SceneAssetNamespace = 'project' | 'reference'

export interface DefinedMotionConfig {
  timelineFps: number
  renderEveryNthFrame: number
  seed: number | string
  defaultScene: string
}

export interface DefinedMotionSceneDefinition {
  /** Stable CLI-facing identifier. */
  id: string
  /** Optional human-readable name for Studio and other clients. */
  name?: string
  /** Marks a renderable scene as a visual test. */
  isTest?: boolean
  /** Runtime-owned asset namespace. Reference scenes are assigned this during discovery. */
  assetNamespace?: SceneAssetNamespace
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

export type ViewerSceneKind = 'project' | 'example' | 'test'

export interface ViewerSceneSummary {
  readonly id: string
  readonly name: string
  readonly kind: ViewerSceneKind
  readonly isDefault: boolean
  readonly isTest: boolean
}

export const defineScene = (
  definition: DefinedMotionSceneDefinition
): DefinedMotionSceneDefinition => {
  validateSceneDefinition(definition, 'scene definition')
  return definition
}

export const defineConfig = (config: DefinedMotionConfig): DefinedMotionConfig => {
  if (!Number.isFinite(config.timelineFps) || config.timelineFps <= 0) {
    throw new Error('DefinedMotion timelineFps must be a positive number')
  }
  if (!Number.isInteger(config.renderEveryNthFrame) || config.renderEveryNthFrame < 1) {
    throw new Error('renderEveryNthFrame must be a positive integer')
  }
  if (typeof config.seed === 'number' && !Number.isFinite(config.seed)) {
    throw new Error('DefinedMotion seed must be finite')
  }
  if (typeof config.defaultScene !== 'string' || config.defaultScene.trim() === '') {
    throw new Error('DefinedMotion defaultScene must be a non-empty string')
  }
  return config
}

const validateSceneDefinition: (
  definition: unknown,
  source: string
) => asserts definition is DefinedMotionSceneDefinition = (definition, source) => {
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
  if (
    candidate.assetNamespace !== undefined &&
    candidate.assetNamespace !== 'project' &&
    candidate.assetNamespace !== 'reference'
  ) {
    throw new Error(`Invalid scene module ${source}: unknown asset namespace`)
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
  modules: Record<string, unknown>,
  options: { assetNamespace?: SceneAssetNamespace; allowEmpty?: boolean } = {}
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

    scenes[definition.id] = options.assetNamespace
      ? { ...definition, assetNamespace: options.assetNamespace }
      : definition
    sourceById.set(definition.id, source)
  }

  if (!options.allowEmpty && Object.keys(scenes).length === 0) {
    throw new Error('No scenes found. Add a default-exported *.scene.ts file under src/scenes')
  }

  return scenes
}

export const mergeSceneRegistries = (
  ...registries: Array<Record<string, DefinedMotionSceneDefinition>>
): Record<string, DefinedMotionSceneDefinition> => {
  const scenes: Record<string, DefinedMotionSceneDefinition> = {}
  for (const registry of registries) {
    for (const [id, scene] of Object.entries(registry)) {
      if (scenes[id]) throw new Error(`Duplicate scene id "${id}" found across scene registries`)
      scenes[id] = scene
    }
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
): ViewerSceneSummary[] =>
  Object.values(project.scenes).map(({ id, name, isTest, assetNamespace }) => ({
    id,
    name: name ?? id,
    kind: isTest ? 'test' : assetNamespace === 'reference' ? 'example' : 'project',
    isDefault: id === project.defaultScene,
    isTest: isTest ?? false
  }))
