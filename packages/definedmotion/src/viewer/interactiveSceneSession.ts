import { createSceneById } from 'virtual:definedmotion-project'
import { loadFonts } from '../runtime/rendering/objects2d'
import {
  setGlobalContainerRef,
  setGlobalInteractiveMode,
  type AnimatedScene
} from '../runtime/scene/sceneClass'
import { disposeScene } from '../runtime/scene/disposeScene'
import { SelectionGeneration } from './sceneSelection'

export interface InteractiveSceneSelectionOptions {
  readonly requestedFrame?: number
  readonly usePreviewMarker: boolean
}

export class InteractiveSceneSession {
  private readonly selectionGeneration = new SelectionGeneration()
  private activeScene?: AnimatedScene
  private readonly pendingScenes = new Set<AnimatedScene>()

  constructor(private readonly viewport: HTMLElement) {}

  async selectScene(
    id: string,
    options: InteractiveSceneSelectionOptions
  ): Promise<AnimatedScene | undefined> {
    const generation = this.selectionGeneration.begin()
    this.disposeActiveScene()

    await loadFonts()
    if (!this.selectionGeneration.isCurrent(generation)) return undefined

    const container = document.createElement('div')
    container.dataset.viewerScene = id
    container.style.width = '100%'
    this.viewport.replaceChildren(container)

    setGlobalContainerRef(container)
    setGlobalInteractiveMode(true)

    let candidate: AnimatedScene
    try {
      candidate = createSceneById(id)
    } catch (error) {
      if (this.selectionGeneration.isCurrent(generation)) container.remove()
      throw error
    }

    this.pendingScenes.add(candidate)
    candidate.setViewerPreviewEnabled(options.usePreviewMarker)

    try {
      await candidate.jumpToFrameAtIndex(options.requestedFrame ?? 0)
    } catch (error) {
      this.pendingScenes.delete(candidate)
      disposeScene(candidate)
      if (!this.selectionGeneration.isCurrent(generation)) return undefined
      container.remove()
      throw error
    }

    this.pendingScenes.delete(candidate)
    if (!this.selectionGeneration.isCurrent(generation)) {
      disposeScene(candidate)
      return undefined
    }

    this.activeScene = candidate
    return candidate
  }

  dispose(): void {
    this.selectionGeneration.invalidate()
    this.disposeActiveScene()
    for (const scene of this.pendingScenes) disposeScene(scene)
    this.pendingScenes.clear()
    this.viewport.replaceChildren()
  }

  private disposeActiveScene(): void {
    if (!this.activeScene) return
    const scene = this.activeScene
    this.activeScene = undefined
    if (scene.isPlaying) scene.pause()
    disposeScene(scene)
  }
}
