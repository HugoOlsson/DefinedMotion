import { createSceneById, listScenes, project } from 'virtual:definedmotion-project'
import type {
  AutomationRequest,
  AutomationResult,
  CameraGridAutomationRequest,
  CamerasAutomationRequest,
  InspectAutomationRequest,
  InspectSceneInfo,
  LayoutCheckAutomationRequest,
  RenderAutomationRequest,
  TimelineGridAutomationRequest,
  VerificationAutomationRequest
} from './types'
import { AutomationCommandError } from './errors'
import { loadFonts } from '../runtime/rendering/objects2d'
import {
  type AnimatedScene,
  setGlobalContainerRef,
  setGlobalInteractiveMode,
  renderOutputFps,
  renderSkip,
  ticksToMillis,
  timelineFPS
} from '../runtime/scene/sceneClass'
import { inspectScene } from './sceneInspection'
import { renderTimelineGrid, validateTimelineGridRequest } from './timelineGrid'
import { renderCameraGrid, validateCameraGridRequest } from './cameraGrid'
import { cameraSummary, listCameraSummaries, resolveInspectionCamera } from './inspectionCamera'
import { runLayoutCheck } from './layoutCheck'
import { runVerifications } from './verification'
import { disposeScene } from '../runtime/scene/disposeScene'

/**
 * Owns the currently loaded automation scene for one renderer generation.
 * The Electron/Vite host may persist, while this context is replaced whenever
 * source code changes and disposed between independent scene requests.
 */
export class RenderSession {
  private activeScene?: AnimatedScene
  // Scene state, the automation viewport, and frame capture are shared mutable resources.
  private requestQueue: Promise<void> = Promise.resolve()

  execute(request: AutomationRequest): Promise<AutomationResult> {
    const result = this.requestQueue.then(
      () => this.executeExclusive(request),
      () => this.executeExclusive(request)
    )
    this.requestQueue = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  private async executeExclusive(request: AutomationRequest): Promise<AutomationResult> {
    const startedAt = performance.now()

    if (request.command === 'scenes') {
      this.disposeActiveScene()
      return {
        success: true,
        command: 'scenes',
        scenes: listScenes().filter((scene) => !request.excludeTests || !scene.isTest)
      }
    }

    if (
      request.command !== 'still' &&
      request.command !== 'timeline-grid' &&
      request.command !== 'inspect' &&
      request.command !== 'layout-check' &&
      request.command !== 'verify' &&
      request.command !== 'cameras' &&
      request.command !== 'camera-grid' &&
      request.command !== 'render'
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
    if (request.command === 'camera-grid') {
      validateCameraGridRequest(request)
    }
    if (request.command === 'inspect') {
      this.validateInspectRequest(request)
    }
    if (request.command === 'layout-check') {
      this.validateLayoutCheckRequest(request)
    }
    if (request.command === 'verify') {
      this.validateVerificationRequest(request)
    }
    if (request.command === 'cameras') {
      this.validateCamerasRequest(request)
    }
    if (
      request.command === 'still' ||
      request.command === 'timeline-grid' ||
      request.command === 'camera-grid' ||
      request.command === 'render'
    ) {
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

    const scene = createSceneById(request.scene)
    this.activeScene = scene
    container.style.width = `${scene.width}px`
    container.style.height = `${scene.height}px`

    if (request.command === 'timeline-grid') {
      return await this.renderTimelineGrid(request, scene, startedAt)
    }
    if (request.command === 'camera-grid') {
      return await this.renderCameraGrid(request, scene, startedAt)
    }
    if (request.command === 'cameras') {
      return await this.listCameras(request, scene, definition.name, definition.isTest, startedAt)
    }
    if (request.command === 'inspect') {
      return await this.inspect(request, scene, definition.name, definition.isTest, startedAt)
    }
    if (request.command === 'layout-check') {
      return await this.layoutCheck(request, scene, startedAt)
    }
    if (request.command === 'verify') {
      return await this.verify(request, scene, startedAt)
    }
    if (request.command === 'render') {
      return await this.renderVideo(request, scene, startedAt)
    }

    await scene.seekExact(request.frame)
    const selectedCamera = resolveInspectionCamera(scene, request.camera)
    const png = await scene.capturePng(selectedCamera.camera)
    const bytes = new Uint8Array(await png.arrayBuffer())
    const output = await window.api.writeAutomationFile(request.output, bytes)

    return {
      success: true,
      command: 'still',
      scene: request.scene,
      frame: request.frame,
      cameraId: selectedCamera.id,
      camera: cameraSummary(selectedCamera).camera,
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
    request: Extract<
      AutomationRequest,
      { command: 'still' | 'timeline-grid' | 'camera-grid' | 'render' }
    >
  ): void {
    if (typeof request.output !== 'string' || request.output === '') {
      throw new AutomationCommandError(
        'MISSING_OUTPUT',
        `The ${request.command} command requires an output path`
      )
    }
  }

  private async renderVideo(
    request: RenderAutomationRequest,
    scene: AnimatedScene,
    startedAt: number
  ): Promise<AutomationResult> {
    const output = await scene.renderToVideo({
      outputFile: request.output,
      reportProgress: true
    })
    return {
      success: true,
      command: 'render',
      scene: request.scene,
      durationInFrames: scene.totalSceneTicks,
      outputFrameCount: Math.ceil(scene.totalSceneTicks / renderSkip),
      durationMs: ticksToMillis(scene.totalSceneTicks),
      fps: renderOutputFps(),
      seed: project.seed,
      width: scene.width,
      height: scene.height,
      output,
      renderTimeMs: Math.round(performance.now() - startedAt)
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

  private validateCamerasRequest(request: CamerasAutomationRequest): void {
    if (!Number.isInteger(request.frame) || request.frame < 0) {
      throw new AutomationCommandError(
        'INVALID_FRAME',
        'The cameras command requires a non-negative integer frame'
      )
    }
  }

  private validateLayoutCheckRequest(request: LayoutCheckAutomationRequest): void {
    if (typeof request.outputDirectory !== 'string' || request.outputDirectory === '') {
      throw new AutomationCommandError(
        'MISSING_OUTPUT',
        'The layout-check command requires an output directory'
      )
    }
    if (!Number.isInteger(request.mergeGapFrames) || request.mergeGapFrames < 0) {
      throw new AutomationCommandError(
        'INVALID_ARGUMENTS',
        'The layout-check merge gap must be a non-negative integer'
      )
    }
  }

  private validateVerificationRequest(request: VerificationAutomationRequest): void {
    if (request.list && request.frame !== undefined) {
      throw new AutomationCommandError(
        'INVALID_ARGUMENTS',
        'Verification list and frame selection cannot be combined'
      )
    }
    if (request.frame !== undefined && (!Number.isInteger(request.frame) || request.frame < 0)) {
      throw new AutomationCommandError(
        'INVALID_FRAME',
        'The verify frame must be a non-negative integer'
      )
    }
    if (
      request.tests &&
      (request.tests.length === 0 ||
        request.tests.some((id) => typeof id !== 'string' || id.trim() === '') ||
        new Set(request.tests).size !== request.tests.length)
    ) {
      throw new AutomationCommandError(
        'INVALID_ARGUMENTS',
        'Verification IDs must be non-empty and unique'
      )
    }
  }

  private async verify(
    request: VerificationAutomationRequest,
    scene: AnimatedScene,
    startedAt: number
  ): Promise<AutomationResult> {
    const result = await runVerifications(request, scene)
    return {
      success: true,
      command: 'verify',
      scene: request.scene,
      checkedFrames: result.checkedFrames,
      verificationCount: result.definitions.length,
      executedCheckCount: result.executedCheckCount,
      passed: result.failures.length === 0,
      failureCount: result.failures.length,
      failures: result.failures,
      verifications: result.definitions,
      durationInFrames: scene.totalSceneTicks,
      fps: timelineFPS,
      seed: project.seed,
      width: scene.width,
      height: scene.height,
      renderTimeMs: Math.round(performance.now() - startedAt)
    }
  }

  private async layoutCheck(
    request: LayoutCheckAutomationRequest,
    scene: AnimatedScene,
    startedAt: number
  ): Promise<AutomationResult> {
    const check = await runLayoutCheck(request, scene)
    return {
      success: true,
      command: 'layout-check',
      scene: request.scene,
      checkedFrames: check.checkedFrames,
      watchedObjectCount: check.watchedObjectCount,
      incidentCount: check.incidents.length,
      clean: check.watchedObjectCount > 0 && check.incidents.length === 0,
      mergeGapFrames: request.mergeGapFrames,
      incidents: check.incidents,
      warnings: check.warnings,
      durationInFrames: scene.totalSceneTicks,
      fps: timelineFPS,
      seed: project.seed,
      width: scene.width,
      height: scene.height,
      outputDirectory: request.outputDirectory,
      renderTimeMs: Math.round(performance.now() - startedAt)
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
    const selectedCamera = resolveInspectionCamera(scene, request.camera)
    const inspection = inspectScene(scene, selectedCamera.camera)
    const beat = scene.timeline.getBeatAtFrame(request.frame)
    return {
      success: true,
      command: 'inspect',
      scene: request.scene,
      frame: request.frame,
      timeMs: scene.getCurrentTimeMs(),
      sceneInfo: this.sceneInfo(request.scene, scene, name, isTest),
      cameraId: selectedCamera.id,
      camera: inspection.camera,
      objects: inspection.objects,
      totalExposedObjects: inspection.totalExposedObjects,
      objectsTruncated: inspection.objectsTruncated,
      ...(beat ? { beat } : {}),
      renderTimeMs: Math.round(performance.now() - startedAt)
    }
  }

  private async listCameras(
    request: CamerasAutomationRequest,
    scene: AnimatedScene,
    name: string | undefined,
    isTest: boolean | undefined,
    startedAt: number
  ): Promise<AutomationResult> {
    await scene.seekExact(request.frame)
    const cameras = listCameraSummaries(scene)
    return {
      success: true,
      command: 'cameras',
      scene: request.scene,
      frame: request.frame,
      timeMs: scene.getCurrentTimeMs(),
      sceneInfo: this.sceneInfo(request.scene, scene, name, isTest),
      cameras,
      cameraCount: cameras.length,
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

  private async renderCameraGrid(
    request: CameraGridAutomationRequest,
    scene: AnimatedScene,
    startedAt: number
  ): Promise<AutomationResult> {
    const grid = await renderCameraGrid(request, scene)
    const output = await window.api.writeAutomationFile(
      request.output,
      new Uint8Array(await grid.png.arrayBuffer())
    )
    return {
      success: true,
      command: 'camera-grid',
      scene: request.scene,
      frame: request.frame,
      timeMs: scene.getCurrentTimeMs(),
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
      cameras: grid.cameras,
      cameraCount: grid.cameras.length,
      cameraCells: grid.cells,
      output,
      renderTimeMs: Math.round(performance.now() - startedAt)
    }
  }

  private sceneInfo(
    id: string,
    scene: AnimatedScene,
    name: string | undefined,
    isTest: boolean | undefined
  ): InspectSceneInfo {
    return {
      id,
      name: name ?? id,
      isDefault: id === project.defaultScene,
      isTest: isTest ?? false,
      width: scene.width,
      height: scene.height,
      fps: timelineFPS,
      durationInFrames: scene.totalSceneTicks,
      lastFrame: scene.totalSceneTicks - 1,
      durationMs: ticksToMillis(scene.totalSceneTicks),
      seed: project.seed
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

    disposeScene(scene)
  }
}
