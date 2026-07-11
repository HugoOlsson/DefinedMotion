import { collectSceneModules, type DefinedMotionSceneModule } from './project'

const bundledExamples = import.meta.glob<DefinedMotionSceneModule>(
  './example_scenes/**/*.scene.ts',
  { eager: true }
)
const userScenes = import.meta.glob<DefinedMotionSceneModule>('./scenes/**/*.scene.ts', {
  eager: true
})

export const scenes = collectSceneModules({ ...bundledExamples, ...userScenes })
