import { project } from '../../entry'
import { listProjectScenes } from '../../project'
import type { AutomationRequest, AutomationResult } from '../../automation/types'
import { loadFonts } from './lib/rendering/objects2d'
import {
  SceneRuntimeError,
  setGlobalContainerRef,
  setGlobalInteractiveMode,
  timelineFPS
} from './lib/scene/sceneClass'

const automationApi = window.api

class AutomationCommandError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'AutomationCommandError'
  }
}

const failure = (request: AutomationRequest | undefined, error: unknown): AutomationResult => {
  const normalized = error instanceof Error ? error : new Error(String(error))
  const code =
    error instanceof AutomationCommandError || error instanceof SceneRuntimeError
      ? error.code
      : 'AUTOMATION_FAILED'
  return {
    success: false,
    command: request?.command,
    error: {
      code,
      message: normalized.message,
      stack: normalized.stack
    }
  }
}

export const runAutomation = async (): Promise<void> => {
  let request: AutomationRequest | undefined
  const startedAt = performance.now()

  try {
    request = await automationApi.getAutomationRequest()

    if (request.command === 'scenes') {
      automationApi.completeAutomation({
        success: true,
        command: 'scenes',
        scenes: listProjectScenes(project)
      })
      return
    }

    if (request.command !== 'still') {
      throw new AutomationCommandError(
        'UNKNOWN_COMMAND',
        `Unsupported automation command: ${request.command}`
      )
    }

    if (!request.scene) {
      throw new AutomationCommandError('MISSING_SCENE', 'The still command requires a scene id')
    }
    if (request.frame === undefined) {
      throw new AutomationCommandError('MISSING_FRAME', 'The still command requires a frame')
    }
    if (!request.output) {
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
    container.style.width = `${scene.width}px`
    container.style.height = `${scene.height}px`

    await scene.seekExact(request.frame)
    const png = await scene.capturePng()
    const bytes = new Uint8Array(await png.arrayBuffer())
    const output = await automationApi.writeAutomationFile(request.output, bytes)

    const result: AutomationResult = {
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

    scene.onDestroy()
    automationApi.completeAutomation(result)
  } catch (error) {
    automationApi.completeAutomation(failure(request, error))
  }
}
