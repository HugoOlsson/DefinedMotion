import { project } from '../../entry'
import { listProjectScenes } from '../../project'
import type { AutomationRequest, AutomationResult } from '../../automation/types'
import { loadFonts } from './lib/rendering/objects2d'
import {
  type AnimatedScene,
  setGlobalContainerRef,
  setGlobalInteractiveMode,
  timelineFPS
} from './lib/scene/sceneClass'

export class AutomationCommandError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'AutomationCommandError'
  }
}

/**
 * Owns the currently loaded automation scene for one renderer generation.
 * The Electron/Vite host may persist, while this context is replaced whenever
 * source code changes and disposed between independent scene requests.
 */
export class RenderSession {
  private activeScene?: AnimatedScene

  async execute(request: AutomationRequest): Promise<AutomationResult> {
    const startedAt = performance.now()

    if (request.command === 'scenes') {
      this.disposeActiveScene()
      return {
        success: true,
        command: 'scenes',
        scenes: listProjectScenes(project).filter((scene) => !request.excludeTests || !scene.isTest)
      }
    }

    if (request.command !== 'still') {
      throw new AutomationCommandError(
        'UNKNOWN_COMMAND',
        `Unsupported automation command: ${(request as { command?: unknown }).command}`
      )
    }

    if (typeof request.scene !== 'string' || request.scene === '') {
      throw new AutomationCommandError('MISSING_SCENE', 'The still command requires a scene id')
    }
    if (!Number.isInteger(request.frame) || request.frame < 0) {
      throw new AutomationCommandError(
        'INVALID_FRAME',
        'The still command requires a non-negative integer frame'
      )
    }
    if (typeof request.output !== 'string' || request.output === '') {
      throw new AutomationCommandError(
        'MISSING_OUTPUT',
        'The still command requires an output path'
      )
    }

    const definition = project.scenes[request.scene]
    if (!definition) {
      throw new AutomationCommandError(
        'UNKNOWN_SCENE',
        `Unknown scene "${request.scene}". Available scenes: ${Object.keys(project.scenes).join(', ')}`
      )
    }

    this.disposeActiveScene()
    await loadFonts()

    const container = document.createElement('div')
    container.id = 'definedmotion-automation-viewport'
    container.style.position = 'fixed'
    container.style.inset = '0'
    container.style.overflow = 'hidden'
    document.body.replaceChildren(container)

    setGlobalContainerRef(container)
    setGlobalInteractiveMode(false)

    const scene = definition.create()
    this.activeScene = scene
    container.style.width = `${scene.width}px`
    container.style.height = `${scene.height}px`

    await scene.seekExact(request.frame)
    const png = await scene.capturePng()
    const bytes = new Uint8Array(await png.arrayBuffer())
    const output = await window.api.writeAutomationFile(request.output, bytes)

    return {
      success: true,
      command: 'still',
      scene: request.scene,
      frame: request.frame,
      timeMs: scene.getCurrentTimeMs(),
      durationInFrames: scene.totalSceneTicks,
      fps: timelineFPS,
      seed: project.seed,
      width: scene.width,
      height: scene.height,
      output,
      renderTimeMs: Math.round(performance.now() - startedAt)
    }
  }

  dispose(): void {
    this.disposeActiveScene()
    document.body.replaceChildren()
  }

  private disposeActiveScene(): void {
    const scene = this.activeScene
    if (!scene) return
    this.activeScene = undefined

    scene.onDestroy()
    scene.renderer.dispose()
    scene.renderer.forceContextLoss()
    scene.renderer.domElement.remove()
  }
}
