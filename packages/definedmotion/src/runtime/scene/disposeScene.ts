import type { AnimatedScene } from './sceneClass'

const disposedScenes = new WeakSet<AnimatedScene>()

export const disposeScene = (scene: AnimatedScene): void => {
  if (disposedScenes.has(scene)) return
  disposedScenes.add(scene)
  scene.onDestroy()
  scene.renderer.dispose()
  scene.renderer.forceContextLoss()
  scene.renderer.domElement.remove()
}
