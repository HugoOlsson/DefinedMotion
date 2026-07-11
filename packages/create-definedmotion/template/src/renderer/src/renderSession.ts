import { project } from '../../entry'
import { listProjectScenes } from '../../project'
import type {
  AutomationRequest,
  AutomationResult,
  InspectAutomationRequest,
  TimelineGridAutomationRequest
} from '../../automation/types'
import { AutomationCommandError } from './automationError'
import { loadFonts } from './lib/rendering/objects2d'
import {
  type AnimatedScene,
  setGlobalContainerRef,
  setGlobalInteractiveMode,
  ticksToMillis,
  timelineFPS
} from './lib/scene/sceneClass'
import { inspectScene } from './sceneInspection'
import { renderTimelineGrid, validateTimelineGridRequest } from './timelineGrid'

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

    if (
      request.command !== 'still' &&
      request.command !== 'timeline-grid' &&
      request.command !== 'inspect'
    ) {
      throw new AutomationCommandError(
        'UNKNOWN_COMMAND',
        `Unsupported automation command: ${(request as { command?: unknown }).command}`
      )
    }

    this.validateSceneId(request)
    if (request.command === 'still' && (!Number.isInteger(request.frame) || request.frame < 0)) {
      throw new AutomationCommandError(
        'INVALID_FRAME',
        'The still command requires a non-negative integer frame'
      )
    }
    if (request.command === 'timeline-grid') {
      validateTimelineGridRequest(request)
    }
    if (request.command === 'inspect') {
      this.validateInspectRequest(request)
    }
    if (request.command !== 'inspect') {
      this.validateOutputRequest(request)
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

    if (request.command === 'timeline-grid') {
      return await this.renderTimelineGrid(request, scene, startedAt)
    }
    if (request.command === 'inspect') {
      return await this.inspect(request, scene, definition.name, definition.isTest, startedAt)
    }

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

  private validateSceneId(request: Exclude<AutomationRequest, { command: 'scenes' }>): void {
    if (typeof request.scene !== 'string' || request.scene === '') {
      throw new AutomationCommandError(
        'MISSING_SCENE',
        `The ${request.command} command requires a scene id`
      )
    }
  }

  private validateOutputRequest(
    request: Extract<AutomationRequest, { command: 'still' | 'timeline-grid' }>
  ): void {
    if (typeof request.output !== 'string' || request.output === '') {
      throw new AutomationCommandError(
        'MISSING_OUTPUT',
        `The ${request.command} command requires an output path`
      )
    }
  }

  private validateInspectRequest(request: InspectAutomationRequest): void {
    if (!Number.isInteger(request.frame) || request.frame < 0) {
      throw new AutomationCommandError(
        'INVALID_FRAME',
        'The inspect command requires a non-negative integer frame'
      )
    }
  }

  private async inspect(
    request: InspectAutomationRequest,
    scene: AnimatedScene,
    name: string | undefined,
    isTest: boolean | undefined,
    startedAt: number
  ): Promise<AutomationResult> {
    await scene.seekExact(request.frame)
    const inspection = inspectScene(scene)
    return {
      success: true,
      command: 'inspect',
      scene: request.scene,
      frame: request.frame,
      timeMs: scene.getCurrentTimeMs(),
      sceneInfo: {
        id: request.scene,
        name: name ?? request.scene,
        isDefault: request.scene === project.defaultScene,
        isTest: isTest ?? false,
        width: scene.width,
        height: scene.height,
        fps: timelineFPS,
        durationInFrames: scene.totalSceneTicks,
        lastFrame: scene.totalSceneTicks - 1,
        durationMs: ticksToMillis(scene.totalSceneTicks),
        seed: project.seed
      },
      camera: inspection.camera,
      objects: inspection.objects,
      totalExposedObjects: inspection.totalExposedObjects,
      objectsTruncated: inspection.objectsTruncated,
      renderTimeMs: Math.round(performance.now() - startedAt)
    }
  }

  private async renderTimelineGrid(
    request: TimelineGridAutomationRequest,
    scene: AnimatedScene,
    startedAt: number
  ): Promise<AutomationResult> {
    const grid = await renderTimelineGrid(request, scene)
    const output = await window.api.writeAutomationFile(
      request.output,
      new Uint8Array(await grid.png.arrayBuffer())
    )

    return {
      success: true,
      command: 'timeline-grid',
      scene: request.scene,
      frames: grid.frames,
      cells: grid.cells,
      durationInFrames: scene.totalSceneTicks,
      fps: timelineFPS,
      seed: project.seed,
      width: grid.width,
      height: grid.height,
      sceneWidth: scene.width,
      sceneHeight: scene.height,
      columns: grid.columns,
      rows: grid.rows,
      cellWidth: request.cellWidth,
      cellHeight: grid.cellHeight,
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
