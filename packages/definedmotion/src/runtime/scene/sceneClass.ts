import { captureCanvasFrame, triggerEncoder } from '../animation/captureCanvas'
import {
  createAnim,
  type DependencyUpdater,
  type UserAnimation
} from '../animation/protocols'
import { AnimationTimeline } from '../animation/timeline'
import { SceneTimeline } from '../animation/beats'
import {
  millisecondsToFrames as convertMillisecondsToFrames,
  secondsToFrames as convertSecondsToFrames,
  type AnimationPlan
} from '../animation/plan'
import { generateID } from '../id'
import { sleep } from '../rendering/helpers'
import { InteractiveViewportScheduler } from '../rendering/interactiveViewportScheduler'
import { createScene } from '../rendering/setup'
import * as THREE from 'three'
import Alea from 'alea'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { easeConstant } from '../animation/interpolations'
import { definedMotionConfig } from 'virtual:definedmotion-config'
import { addDestroyFunction } from '../lifecycle'
import { SceneRuntimeError } from './sceneErrors'
import {
  SceneExposureRegistry,
  type ExposedObjectMetadata,
  type ExposedSceneObject
} from './sceneExposure'
import {
  SceneCameraRegistry,
  type ExposedCameraMetadata,
  type ExposedSceneCamera,
  type InspectionCamera
} from './sceneCamera'
import {
  SceneCollisionRegistry,
  type CollisionWatch,
  type CollisionWatchOptions
} from './sceneCollision'
import {
  assetUrl,
  createAssetReference,
  type AssetSource,
  type AssetNamespace,
  type SceneAsset
} from '../assets'
import {
  AudioInScene,
  loadAllAudio,
  playAudio,
  registerAudio,
  seekToTick as audioSeekToTick,
  pauseAll as audioPauseAll,
  resumeAll as audioResumeAll,
  stopAll as audioStopAll
} from '../audio'
import {
  FrameResourceHost,
  type FrameResource,
  type FrameResourceDependency
} from './frameResource'
import { type Positioning, PositioningSystem } from '../positioning'
import type { RenderProgress } from '../../renderProgress'
import { resolveSceneLayouts } from '../visuals/layout'

export const screenFPS = await (window.api as any).getDisplayHz();   //Your screen fps

export const timelineFPS = definedMotionConfig.timelineFps
export const renderSkip = definedMotionConfig.renderEveryNthFrame

// Convert ticks (frames) to milliseconds
export const ticksToMillis = (ticks: number) => (ticks / timelineFPS) * 1000

// Convert milliseconds to the closest whole number of ticks
export const millisToTicks = (ms: number) => Math.ceil((ms / 1000) * timelineFPS)

export const renderOutputFps = () => timelineFPS / renderSkip

export interface RenderVideoOptions {
  outputFile?: string
  reportProgress?: boolean
}

export interface ExactFrameVisit {
  frame: number
  timeMs: number
  capturePng: (camera?: InspectionCamera) => Promise<Blob>
}

export enum SpaceSetting {
  ThreeDim,
  TwoDim
}

export enum HotReloadSetting {
  TraceFromStart,
  BeginFromCurrent,
  BeginFreshOnSave
}

export { SceneRuntimeError } from './sceneErrors'
export type {
  ExposedObjectDataValue,
  ExposedObjectMetadata,
  ExposedSceneObject
} from './sceneExposure'
export type { CollisionWatch, CollisionWatchOptions } from './sceneCollision'
export { MAIN_CAMERA_ID } from './sceneCamera'
export type { ExposedCameraMetadata, ExposedSceneCamera, InspectionCamera } from './sceneCamera'
export type {
  BeatAuthoringContext,
  BeatDefinitions,
  BeatFrameCoordinates,
  BeatRange,
  BeatTick,
  BeatTickUpdater
} from '../animation/beats'

export const hotreloadNameLookup = (mode: HotReloadSetting) => {
  switch (mode) {
    case HotReloadSetting.TraceFromStart:
      return "Trace from start";
    case HotReloadSetting.BeginFromCurrent:
      return "Begin from current frame without trace";
    case HotReloadSetting.BeginFreshOnSave:
      return "Go to the beginning";
  }
}

type SceneInstruction = (tick: number) => any

export let globalContainerRef: HTMLElement
let globalInteractiveMode = true
let globalAssetNamespace: AssetNamespace = 'project'

export const setGlobalContainerRef = (ref: HTMLElement) => {
  globalContainerRef = ref
}

/**
 * Configures whether newly-created scenes attach editor-only behavior such as
 * OrbitControls, ResizeObserver and change-driven viewport rendering.
 */
export const setGlobalInteractiveMode = (interactive: boolean): void => {
  globalInteractiveMode = interactive
}

export const setGlobalAssetNamespace = (namespace: AssetNamespace): void => {
  globalAssetNamespace = namespace
}

export class AnimatedScene {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera
  renderer: THREE.WebGLRenderer
  private controls: OrbitControls
  private container: HTMLElement

  sceneRenderTick: number = 0
  totalSceneTicks: number = 0
  private readonly animationTimeline = new AnimationTimeline(timelineFPS)
  readonly timeline: SceneTimeline
  private sceneDependencies: DependencyUpdater[] = []
  private sceneInstructions: Map<number, SceneInstruction[]> = new Map()
  private planedSounds: Map<number, AudioInScene[]> = new Map()
  private exposureRegistry = new SceneExposureRegistry()
  private cameraRegistry = new SceneCameraRegistry()
  private collisionRegistry = new SceneCollisionRegistry()
  private readonly frameResources = new FrameResourceHost()
  private readonly positioningSystem = new PositioningSystem()

  private pixelsWidth
  private pixelsHeight

  playEffectFunction: () => any = () => {}

  renderingEventFunction: (start: boolean) => any = () => {}

  isPlaying = false

  private initialSceneChildren: THREE.Object3D[] = []
  private initialCameraChildren: THREE.Object3D[] = []
  private initialCameraState: {
    position: THREE.Vector3
    rotation: THREE.Euler
    zoom?: number
    fov?: number  
    left?: number
    right?: number
    top?: number
    bottom?: number
  }
  private initialRendererState: {
    clearColor: THREE.Color
    clearAlpha: number
    shadowMapEnabled: boolean
  }

  private zoom = 30
  farLimitRender = 1000

  private buildFunction: (scene: this) => any

  public hotReloadSetting: HotReloadSetting
  private traceFromStart: boolean

  private interactiveViewport?: InteractiveViewportScheduler
  private animationFrameId: number | null = null

  private isBuilding = false
  private isRendering = false
  private presentationOperation?: string
  private doNotPlayAudio = false
  private renderingAudioGather: AudioInScene[] = []
  private renderingAudioByFrame = new Map<
    number,
    Map<string, AudioInScene>
  >()

  private playbackTargetDistance: number | null = null

  private resizeObserver?: ResizeObserver
  private interactive: boolean
  private readonly assetNamespace: AssetNamespace
  private randomGenerator = Alea(definedMotionConfig.seed)
  // Cold library initialization must not advance the explicit scene.random() stream.
  private patchedMathRandomGenerator = Alea(definedMotionConfig.seed)
  private unregisterDestroy?: () => void
  private destroyed = false
  

  constructor(
    pixelsWidth: number,
    pixelsHeight: number,
    spaceSetting: SpaceSetting = SpaceSetting.ThreeDim,
    hotReloadSetting: HotReloadSetting = HotReloadSetting.TraceFromStart,
    buildFunctionGiven: (scene: AnimatedScene) => any
  ) {
    this.container = globalContainerRef
    this.pixelsHeight = pixelsHeight
    this.pixelsWidth = pixelsWidth
    this.hotReloadSetting = hotReloadSetting
    this.traceFromStart = hotReloadSetting !== HotReloadSetting.BeginFromCurrent
    this.interactive = globalInteractiveMode
    this.assetNamespace = globalAssetNamespace

    const threeDim = spaceSetting === SpaceSetting.ThreeDim

    const { scene, camera, renderer, controls } = createScene(
      globalContainerRef,
      pixelsWidth,
      pixelsHeight,
      threeDim,
      this.zoom,
      this.farLimitRender
    )

    this.scene = scene
    this.camera = camera
    this.renderer = renderer
    this.controls = controls
    this.timeline = new SceneTimeline(
      this.animationTimeline,
      timelineFPS,
      (dependency) => this.sceneDependencies.push(dependency),
      () => this.isBuilding
    )

    // Store initial state
    this.initialSceneChildren = [...scene.children]
    this.initialCameraChildren = [...camera.children]
    this.initialCameraState = this.captureCameraState(camera)
    this.initialRendererState = {
      clearColor: renderer.getClearColor(new THREE.Color()),
      clearAlpha: renderer.getClearAlpha(),
      shadowMapEnabled: renderer.shadowMap.enabled
    }


    this.buildFunction = async () => {
      await buildFunctionGiven(this)
      this.end()
    }

    if (this.interactive) {
      this.attachScreenSizeListener(globalContainerRef, threeDim)
      this.interactiveViewport = new InteractiveViewportScheduler(
        this.controls,
        () => this.renderCurrentFrame()
      )
      this.interactiveViewport.resume()
    } else {
      this.controls.enabled = false
    }

    this.unregisterDestroy = addDestroyFunction(() => this.onDestroy())
  }

  onDestroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.isPlaying = false
    this.unregisterDestroy?.()
    this.unregisterDestroy = undefined
    this.interactiveViewport?.dispose()
    this.controls.dispose()
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId)
    this.resizeObserver?.disconnect()
    this.clearExposedObjects()
    this.clearExposedCameras()
    this.clearCollisionWatches()
    this.frameResources.dispose()
  }

  add = (...elements: THREE.Mesh[] | THREE.Group[] | THREE.Object3D[]) => {
    elements.forEach((e) => this.scene.add(e))
  }

  /** Registers one-way positioning relationships using world-axis-aligned bounds. */
  positioning(): Positioning {
    return this.positioningSystem
  }

  do(instruction: SceneInstruction) {
    const frame = this.animationTimeline.getPointer()
    this.animationTimeline.assertFrameCanBeScheduled(frame, 'scene.do()')
    this.appendInstruction(instruction, frame)
  }

  doAt(tick: number, instruction: SceneInstruction) {
    if (tick < 0) throw new Error('doAt: tick must be ≥ 0')
    this.animationTimeline.assertFrameCanBeScheduled(tick, 'scene.doAt()')
    this.appendInstruction(instruction, tick)
  }

  getCurrentTimeMs() {
    return ticksToMillis(this.sceneRenderTick)
  }

  getTimelinePointer(): number {
    return this.animationTimeline.getPointer()
  }

  setTimelinePointer(frame: number): void {
    this.animationTimeline.setPointer(frame)
  }

  secondsToFrames(seconds: number): number {
    return convertSecondsToFrames(seconds, timelineFPS)
  }

  millisecondsToFrames(milliseconds: number): number {
    return convertMillisecondsToFrames(milliseconds, timelineFPS)
  }

  get fps(): number {
    return timelineFPS
  }

  get width(): number {
    return this.pixelsWidth
  }

  get height(): number {
    return this.pixelsHeight
  }

  /** Deterministic scene-local replacement for Math.random(). */
  random = (): number => this.randomGenerator()

  randomBetween = (min: number, max: number): number => min + this.random() * (max - min)

  /**
   * Creates a validated, lazy reference to a file below `src/assets`.
   * No file is read until a loader or one of the reference's read methods uses it.
   */
  asset(path: string): SceneAsset {
    return createAssetReference(path, this.assetNamespace)
  }

  /**
   * Gives an object a stable semantic ID for opt-in agent inspection.
   * Registration is build-scoped and performs no geometry measurements.
   */
  expose<T extends THREE.Object3D>(
    id: string,
    object: T,
    metadata: ExposedObjectMetadata = {}
  ): T {
    if (!this.isBuilding) {
      throw new SceneRuntimeError(
        'EXPOSE_OUTSIDE_BUILD',
        'scene.expose() must be called while the scene build function is running'
      )
    }
    return this.exposureRegistry.expose(id, object, metadata)
  }

  /** Current-build registrations for tooling. The returned array is a snapshot. */
  getExposedObjects(): ExposedSceneObject[] {
    return this.exposureRegistry.snapshot()
  }

  get exposedObjectCount(): number {
    return this.exposureRegistry.size
  }

  /**
   * Registers an object for screen-space collision checks by the layout-check CLI command.
   * The watched object can be any renderable object or group; text is a common use case.
   */
  watchCollisions<T extends THREE.Object3D>(
    id: string,
    object: T,
    options: CollisionWatchOptions = {}
  ): T {
    if (!this.isBuilding) {
      throw new SceneRuntimeError(
        'COLLISION_WATCH_OUTSIDE_BUILD',
        'scene.watchCollisions() must be called while the scene build function is running'
      )
    }
    return this.collisionRegistry.watch(id, object, options)
  }

  /** Current-build collision registrations for tooling. The returned array is a snapshot. */
  getCollisionWatches(): CollisionWatch[] {
    return this.collisionRegistry.snapshot()
  }

  get collisionWatchCount(): number {
    return this.collisionRegistry.size
  }

  /**
   * Gives a perspective or orthographic camera a stable ID for agent-only rendering.
   * The camera is not added to the Three.js scene and never changes the authored output.
   */
  exposeCamera<T extends InspectionCamera>(
    id: string,
    camera: T,
    metadata: ExposedCameraMetadata = {}
  ): T {
    if (!this.isBuilding) {
      throw new SceneRuntimeError(
        'EXPOSE_CAMERA_OUTSIDE_BUILD',
        'scene.exposeCamera() must be called while the scene build function is running'
      )
    }
    return this.cameraRegistry.expose(id, camera, metadata)
  }

  /** Current-build inspection camera registrations. The returned array is a snapshot. */
  getExposedCameras(): ExposedSceneCamera[] {
    return this.cameraRegistry.snapshot()
  }

  getExposedCamera(id: string): ExposedSceneCamera | undefined {
    return this.cameraRegistry.get(id)
  }

  get exposedCameraCount(): number {
    return this.cameraRegistry.size
  }

  addAnims(...animations: (AnimationPlan | UserAnimation)[]) {
    this.animationTimeline.add(...animations)
  }

  insertAnimsAt(tick: number, ...animations: UserAnimation[]) {
    this.animationTimeline.insertLegacyAt(tick, ...animations)
  }

  addDeferredAnims(...futureAnimations: (() => UserAnimation)[]) {
    // Execute once during planning just to get durations
    const tempAnims = futureAnimations.map(fn => fn())
    const longest = Math.max(...tempAnims.map((a) => a.interpolation.length))
    
    this.do((tick) => {
      const calculatedAnimations: UserAnimation[] = []
      for (const futureAnimation of futureAnimations) {
        calculatedAnimations.push(futureAnimation()) // Execute again at runtime
      }
      this.insertAnimsAt(tick, ...calculatedAnimations)
    })
    this.animationTimeline.reservePointerAdvance(longest)
  }

  addSequentialBackgroundAnims(...sequentialAnimations: UserAnimation[]) {
    this.animationTimeline.addSequentialLegacy(...sequentialAnimations)
  }

  onEachTick(updater: DependencyUpdater) {
    this.timeline.assertGlobalRuntimeRegistrationAllowed('scene.onEachTick()')
    this.sceneDependencies.push(updater)
  }

  /** @internal Returns a persistent resource owned by this scene. */
  getOrCreateFrameResource<T extends FrameResource>(
    id: string,
    signature: string,
    create: () => T
  ): T {
    if (!this.isBuilding) {
      throw new SceneRuntimeError(
        'FRAME_RESOURCE_OUTSIDE_BUILD',
        'Frame resources must be created while the scene is building'
      )
    }
    return this.frameResources.getOrCreate(id, signature, create)
  }

  /** @internal Adds a persistent resource to the current build's frame plan. */
  useFrameResource(dependency: FrameResourceDependency): void {
    if (!this.isBuilding) {
      throw new SceneRuntimeError(
        'FRAME_RESOURCE_OUTSIDE_BUILD',
        'Frame resources must be used while the scene is building'
      )
    }
    this.frameResources.use(dependency)
  }

  end() {
    this.positioningSystem.compile()
    const lastInstructionTick = Array.from(this.sceneInstructions.keys()).reduce(
      (latest, tick) => Math.max(latest, tick + 1),
      0
    )
    this.totalSceneTicks = Math.max(
      this.animationTimeline.getEndFrame(),
      lastInstructionTick,
      this.timeline.getDeclaredEndFrame()
    )
  }

  registerAudio(audio: AssetSource) {
    registerAudio(assetUrl(audio))
  }

  playAudio(audio: AssetSource, volume: number = 1) {
    const audioPath = assetUrl(audio)
    if (this.isBuilding) {
      const timelinePointer = this.animationTimeline.getPointer()
      this.animationTimeline.assertFrameCanBeScheduled(timelinePointer, 'scene.playAudio()')
      const listForFrame = this.planedSounds.get(timelinePointer)

      if (!listForFrame) {
        this.planedSounds.set(timelinePointer, [
          {
            audioPath,
            atFrame: timelinePointer,
            volume
          }
        ])
      } else {
        listForFrame.push({
          audioPath,
          atFrame: timelinePointer,
          volume
        })
      }
    } else if (this.isRendering) {
      const atFrame = Math.round(this.sceneRenderTick / renderSkip)
      let audioForFrame = this.renderingAudioByFrame.get(atFrame)
      if (!audioForFrame) {
        audioForFrame = new Map()
        this.renderingAudioByFrame.set(atFrame, audioForFrame)
      }
      const existing = audioForFrame.get(audioPath)
      if (existing) {
        existing.volume += volume
      } else {
        const event = { audioPath, volume, atFrame }
        audioForFrame.set(audioPath, event)
        this.renderingAudioGather.push(event)
      }
    } else if (this.isPlaying && this.doNotPlayAudio === false) {
      playAudio(audioPath, volume)
    }
  }

  addWait(duration: number) {
    this.addAnims(createAnim(easeConstant(0, duration), () => {}))
  }

  jumpToFrameAtIndex(index: number, notSize: boolean = false): Promise<void> {
    return this.runPresentationOperation('seek', () =>
      this.presentInteractiveFrameAtIndex(index, notSize)
    )
  }

  private async presentInteractiveFrameAtIndex(index: number, notSize: boolean): Promise<void> {
    this.interactiveViewport?.suspend()
    try {
      await this.presentFrameAtIndex(index, notSize, 'exact')
    } finally {
      if (!this.destroyed && !this.isPlaying && !this.isRendering) {
        this.interactiveViewport?.resume()
      }
    }
  }

  private async presentFrameAtIndex(
    index: number,
    notSize: boolean,
    presentation: 'exact' | 'realtime'
  ): Promise<void> {
    await this.prepareSceneForSeek(
      notSize,
      true,
      presentation === 'exact' ? 'suspend' : 'preserve'
    )

    if (index > this.totalSceneTicks - 1 || index < 0) {
      index = 0
    }

    if (this.traceFromStart) {
      await this.traceToFrameIndex(index, false)
    } else {
      const allInstructionUntilNow = this.getSceneInstructionsUpToIndex(index - 1)
      for (let i = 0; i < allInstructionUntilNow.length; i++) {
        await allInstructionUntilNow[i].instruction(allInstructionUntilNow[i].key)
      }
      await this.traceCurrentFrame(index, false, false)
    }

    this.sceneRenderTick = index
    if (presentation === 'exact') await this.prepareExactFrame()
    else this.updateRealtimeFrame({ discontinuity: true })
    if (this.interactive) this.syncControlsWithCamera()
    this.renderCurrentFrame()
    await this.playEffectFunction()

    this.doNotPlayAudio = false

    // Only (re)start audio when actively playing or rendering
    if (this.isPlaying && !this.doNotPlayAudio && !this.isRendering) {
      audioSeekToTick(this.sceneRenderTick, this.planedSounds, timelineFPS)
    }
  }

  /**
   * Rebuilds the scene and deterministically traces every tick through the
   * requested frame. Unlike editor scrubbing, this never uses a hot-reload
   * shortcut and rejects invalid frame numbers instead of wrapping to zero.
   */
  seekExact(index: number): Promise<void> {
    return this.runPresentationOperation('exact seek', () => this.seekExactFrame(index))
  }

  private async seekExactFrame(index: number): Promise<void> {
    if (!Number.isInteger(index) || index < 0) {
      throw new SceneRuntimeError(
        'INVALID_FRAME',
        `Frame must be a non-negative integer, received ${index}`
      )
    }

    await this.prepareSceneForSeek(true, false)

    if (this.totalSceneTicks <= 0) {
      throw new SceneRuntimeError('EMPTY_SCENE', 'Scene has no frames')
    }

    if (index >= this.totalSceneTicks) {
      throw new SceneRuntimeError(
        'FRAME_OUT_OF_RANGE',
        `Frame ${index} is outside scene range 0-${this.totalSceneTicks - 1}`
      )
    }

    await this.traceToFrameIndex(index, false)
    this.sceneRenderTick = index
    this.prepareOutputViewport()
    await this.prepareExactFrame()
    this.renderCurrentFrame()
    await this.playEffectFunction()
    this.doNotPlayAudio = false
  }

  /**
   * @internal Builds once and visits authored frames sequentially without real-time playback.
   * Returning false from the visitor stops the sequence early.
   */
  visitExactFrames(
    visitor: (visit: ExactFrameVisit) => Promise<boolean | void> | boolean | void
  ): Promise<number> {
    return this.runPresentationOperation('exact frame sequence', async () => {
      await this.prepareSceneForSeek(true, false)
      if (this.totalSceneTicks <= 0) {
        throw new SceneRuntimeError('EMPTY_SCENE', 'Scene has no frames')
      }

      this.prepareOutputViewport()
      let visitedFrames = 0
      for (let frame = 0; frame < this.totalSceneTicks; frame++) {
        this.sceneRenderTick = frame
        await this.traceCurrentFrame(frame, false, false)
        await this.prepareExactFrame()
        this.scene.updateMatrixWorld(true)
        this.camera.updateProjectionMatrix()
        this.camera.updateWorldMatrix(true, false)
        visitedFrames++

        const continueSequence = await visitor({
          frame,
          timeMs: ticksToMillis(frame),
          capturePng: (camera = this.camera) => this.capturePreparedPng(camera)
        })
        if (continueSequence === false) break
      }
      return visitedFrames
    })
  }

  /** Sets the WebGL drawing buffer to the scene's logical output resolution. */
  prepareOutputViewport(): void {
    this.resizeObserver?.disconnect()
    this.renderer.setPixelRatio(1)
    this.renderer.setSize(this.pixelsWidth, this.pixelsHeight, false)
    this.renderer.setViewport(0, 0, this.pixelsWidth, this.pixelsHeight)
    this.camera.updateProjectionMatrix()
  }

  capturePng(camera: InspectionCamera = this.camera): Promise<Blob> {
    return this.runPresentationOperation('capture', () => this.captureExactPng(camera))
  }

  captureViewportPng(): Promise<Blob> {
    return this.runPresentationOperation('viewport capture', () =>
      this.captureFullResolutionViewportPng()
    )
  }

  private async captureFullResolutionViewportPng(): Promise<Blob> {
    const originalPixelRatio = this.renderer.getPixelRatio()
    const originalSize = this.renderer.getSize(new THREE.Vector2())
    const originalViewport = this.renderer.getViewport(new THREE.Vector4())
    this.interactiveViewport?.suspend()

    try {
      this.prepareOutputViewport()
      return await this.captureExactPng(this.camera)
    } finally {
      this.renderer.setPixelRatio(originalPixelRatio)
      this.renderer.setSize(originalSize.x, originalSize.y, false)
      this.renderer.setViewport(originalViewport)
      this.resizeObserver?.observe(this.container)
      if (!this.destroyed && !this.isPlaying && !this.isRendering) {
        this.interactiveViewport?.resume(true)
      }
    }
  }

  private async captureExactPng(camera: InspectionCamera): Promise<Blob> {
    await this.prepareExactFrame()
    return await this.capturePreparedPng(camera)
  }

  private async capturePreparedPng(camera: InspectionCamera): Promise<Blob> {
    this.renderCurrentFrame(camera)
    const canvas = this.renderer.domElement
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('Could not encode the WebGL canvas as PNG')
    return blob
  }

  private async prepareSceneForSeek(
    notSize: boolean,
    loadAudioAssets: boolean,
    frameResourceMode: 'suspend' | 'preserve' = 'suspend'
  ): Promise<void> {
    this.doNotPlayAudio = true
    this.frameResources.beginBuild(frameResourceMode)
    this.resetComponents(notSize)
    this.isBuilding = true
    let buildCompleted = false
    try {
      await this.withSeededRandom(() => this.buildFunction(this))
      buildCompleted = true
    } finally {
      this.isBuilding = false
      this.frameResources.finishBuild(buildCompleted)
    }

    if (loadAudioAssets) {
      await loadAllAudio()
    }
  }

  getAspectRatio() {
    return this.pixelsWidth / this.pixelsHeight
  }

  private syncControlsWithCamera(): void {
    const direction = new THREE.Vector3()
    this.camera.getWorldDirection(direction)
    const distance =
      this.playbackTargetDistance ?? this.controls.target.distanceTo(this.camera.position)
    const target = this.camera.position.clone().add(direction.multiplyScalar(distance))
    this.controls.target.copy(target)
    this.controls.update()
  }

  private attachScreenSizeListener(container: HTMLElement, threeDim: boolean) {
  const targetAspect = this.pixelsWidth / this.pixelsHeight

  const handleResize = (width: number) => {
    if (!width) return

    if (this.isRendering) {
      return
    }

    // Respect the animation's logical aspect ratio
    const height = width / targetAspect

    // Set container size manually
    container.style.height = `${height}px`

    // Update camera based on that aspect
    const aspect = width / height

    if (threeDim && this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.aspect = aspect
    } else if (this.camera instanceof THREE.OrthographicCamera) {
      this.camera.left   = -this.zoom * aspect
      this.camera.right  =  this.zoom * aspect
      this.camera.top    =  this.zoom
      this.camera.bottom = -this.zoom
    }

    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
    this.renderer.render(this.scene, this.camera)
  }

  // Initial sizing
  handleResize(container.clientWidth)

  // React to container size changes (e.g. inspector open/close)
  this.resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width } = entry.contentRect
      handleResize(width)
    }
  })

  this.resizeObserver.observe(container)

}

  pause() {
    this.isPlaying = false
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId)
    this.frameResources.suspend()


    audioPauseAll()
    // use the captured distance one last time
    this.syncControlsWithCamera();
    this.playbackTargetDistance = null;

    this.interactiveViewport?.resume(true)
  }

  render(): Promise<void> {
    return this.runPresentationOperation('render', async () => {
      await this.renderAnimation({})
    })
  }

  /** @internal Used by the automation CLI to select an output and report progress. */
  renderToVideo(options: RenderVideoOptions): Promise<string> {
    return this.runPresentationOperation('render', () => this.renderAnimation(options))
  }

  private async renderAnimation(options: RenderVideoOptions): Promise<string> {
    const ro = this.resizeObserver
    const renderName = generateID(10)
    const cpu_free_time = 5
    const div = this.container
    const originalPosition = div.style.position
    const originalTop = div.style.top
    const originalLeft = div.style.left
    const originalZIndex = div.style.zIndex
    const originalOpacity = div.style.opacity
    const reportProgress = (progress: RenderProgress): void => {
      if (options.reportProgress) window.api.reportRenderProgress(progress)
    }

    this.renderingEventFunction(true)
    this.isRendering = true
    this.isPlaying = true
    this.clearRenderingAudioGather()

    try {
      this.interactiveViewport?.suspend()
      ro?.disconnect()

      div.style.position = 'absolute'
      div.style.top = '0'
      div.style.left = '0'
      div.style.zIndex = '999'
      div.style.opacity = '0'

      this.prepareOutputViewport()
      window.scrollTo(0, 0)
      const startFrame = 0
      reportProgress({
        phase: 'preparing',
        message: 'Preparing scene'
      })
      await this.presentFrameAtIndex(startFrame, true, 'exact')
      const totalOutputFrames = Math.ceil(this.totalSceneTicks / renderSkip)
      let renderedFrames = 0
      let lastProgressAt = -Infinity
      for (let i = startFrame; i < this.totalSceneTicks; i++) {
        this.sceneRenderTick = i
        //To not trace start frame twice

        await this.traceCurrentFrame(this.sceneRenderTick, true, i === startFrame)

        if (this.sceneRenderTick % renderSkip === 0) {
          await this.prepareExactFrame()
          this.renderCurrentFrame()
          await captureCanvasFrame(
            Math.round(this.sceneRenderTick / renderSkip),
            renderName,
            this.renderer
          )
          renderedFrames++
          const now = performance.now()
          if (
            renderedFrames === 1 ||
            renderedFrames === totalOutputFrames ||
            now - lastProgressAt >= 1_000
          ) {
            const percent =
              totalOutputFrames > 0 ? (renderedFrames / totalOutputFrames) * 100 : 100
            reportProgress({
              phase: 'rendering-frames',
              message: 'Rendering frames',
              completed: renderedFrames,
              total: totalOutputFrames,
              percent,
              frame: this.sceneRenderTick
            })
            lastProgressAt = now
          }
        }
        await this.playEffectFunction()
        if (i % 10 === 0) {
          await sleep(cpu_free_time)
        }
      }

      const outputFile = await triggerEncoder(
        this.pixelsWidth,
        this.pixelsHeight,
        this.renderingAudioGather,
        {
          outputFile: options.outputFile,
          renderName,
          frameCount: renderedFrames
        }
      )

      this.clearRenderingAudioGather()
      this.isRendering = false
      this.isPlaying = false
      await this.presentFrameAtIndex(0, false, 'exact')
      this.renderCurrentFrame()
      return outputFile
    } finally {
      this.isPlaying = false
      this.isRendering = false
      this.clearRenderingAudioGather()
      div.style.position = originalPosition
      div.style.top = originalTop
      div.style.left = originalLeft
      div.style.zIndex = originalZIndex
      div.style.opacity = originalOpacity
      this.renderer.setPixelRatio(window.devicePixelRatio)
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight)
      ro?.observe(this.container)
      this.interactiveViewport?.resume(true)
      this.renderingEventFunction(false)
    }
  }

  play() {
    this.playSequenceOfAnimation(0, this.totalSceneTicks - 1)
  }

  playSequenceOfAnimation(fromFrame: number, toFrame: number): Promise<void> {
    return this.runPresentationOperation('playback start', () =>
      this.startPlayback(fromFrame, toFrame)
    )
  }

  private async startPlayback(fromFrame: number, toFrame: number): Promise<void> {
    this.isPlaying = true
    this.interactiveViewport?.suspend()
    try {
      await this.presentFrameAtIndex(fromFrame, false, 'exact')
    } catch (error) {
      this.pause()
      throw error
    }
    if (!this.isPlaying) return

    // If we were previously paused and had partial offsets captured, this also ensures clean resume:
    audioResumeAll()

    // Capture a distance that OrbitControls will keep during play
    this.playbackTargetDistance =
    this.controls.target.distanceTo(this.camera.position)

    let currentFrame = fromFrame
    let cycleStartFrame = fromFrame
    let firstFrameInCycle = true
    let cycleStartedAt = performance.now()
    const frameDurationMs = 1000 / timelineFPS

    const animate = async (now: number): Promise<void> => {
      if (!this.isPlaying) return
      if (currentFrame <= toFrame) {
        const elapsedFrames = Math.floor((now - cycleStartedAt) / frameDurationMs)
        const targetFrame = Math.min(toFrame, cycleStartFrame + elapsedFrames)
        let frameWasTraced = false

        while (currentFrame <= targetFrame && this.isPlaying) {
          this.sceneRenderTick = currentFrame
          // presentFrameAtIndex() already traced the first visual frame.
          await this.traceCurrentFrame(this.sceneRenderTick, true, firstFrameInCycle)
          firstFrameInCycle = false
          currentFrame++
          frameWasTraced = true
        }

        if (!this.isPlaying) return
        if (frameWasTraced) {
          // --- Keep controls.target aligned with the animated camera ---
          if (this.playbackTargetDistance != null) {
            const camDir = new THREE.Vector3()
            this.camera.getWorldDirection(camDir)         // forward (-Z in view space)
            const target = this.camera.position.clone()
              .add(camDir.multiplyScalar(this.playbackTargetDistance))
            this.controls.target.copy(target)
            this.controls.update() // ok to call while disabled; just updates internals
          }

          this.updateRealtimeFrame({ continuesAfterFrame: this.sceneRenderTick === toFrame })
          this.renderCurrentFrame()
          await this.playEffectFunction()
        }

        scheduleNextFrame()
      } else {
        await this.presentFrameAtIndex(0, false, 'realtime')
        currentFrame = 0
        cycleStartFrame = 0
        firstFrameInCycle = true
        cycleStartedAt = performance.now()
        scheduleNextFrame()
      }
    }

    const scheduleNextFrame = (): void => {
      this.animationFrameId = requestAnimationFrame((now) => {
        if (!this.isPlaying) return
        this.presentationOperation = 'playback frame'
        void animate(now)
          .catch((error) => {
            this.pause()
            this.playEffectFunction()
            console.error('Playback stopped after an error:', error)
          })
          .finally(() => {
            if (this.presentationOperation === 'playback frame') {
              this.presentationOperation = undefined
            }
          })
      })
    }

    scheduleNextFrame()
  }

  renderCurrentFrame(camera: InspectionCamera = this.camera): void {
    this.scene.updateMatrixWorld(true)
    camera.updateProjectionMatrix()
    camera.updateWorldMatrix(true, false)
    this.renderer.render(this.scene, camera)
  }

  private async runPresentationOperation<T>(
    name: string,
    operation: () => Promise<T>
  ): Promise<T> {
    if (this.destroyed) {
      throw new SceneRuntimeError('SCENE_DESTROYED', 'The scene has been destroyed')
    }
    const activeOperation = this.presentationOperation ?? (this.isPlaying ? 'playback' : undefined)
    if (activeOperation) {
      throw new SceneRuntimeError(
        'SCENE_BUSY',
        `Cannot start ${name} while ${activeOperation} is active`
      )
    }

    this.presentationOperation = name
    try {
      return await operation()
    } finally {
      this.presentationOperation = undefined
      this.doNotPlayAudio = false
    }
  }

  private prepareExactFrame(): Promise<void> {
    return this.frameResources.prepareExact(
      this.sceneRenderTick,
      ticksToMillis(this.sceneRenderTick)
    )
  }

  private updateRealtimeFrame(
    options: { discontinuity?: boolean; continuesAfterFrame?: boolean } = {}
  ): void {
    this.frameResources.updateRealtime({
      frame: this.sceneRenderTick,
      timeMs: ticksToMillis(this.sceneRenderTick),
      discontinuity: options.discontinuity ?? false,
      continuesAfterFrame: options.continuesAfterFrame ?? false
    })
  }

  private async traceToFrameIndex(index: number, withAudio: boolean) {
    //Trace all actions
    for (let traceTick = 0; traceTick <= index; traceTick++) {
      await this.traceCurrentFrame(traceTick, withAudio, false)
    }
  }

  private async traceCurrentFrame(index: number, withAudio: boolean, onlyAudio: boolean) {
    return this.withSeededRandom(async () => {
      if (withAudio) {
        const soundsForTick = this.planedSounds.get(index)
        if (soundsForTick) {
          for (const sound of soundsForTick) {
            this.playAudio(sound.audioPath, sound.volume)
          }
        }
      }
      if (onlyAudio) return
      //Trace all actions
      const frameInstructions = this.sceneInstructions.get(index)
      if (frameInstructions) {
        for (let i = 0; i < frameInstructions.length; i++) {
          await frameInstructions[i](index)
        }
      }
      await this.animationTimeline.runFrame(index)

      for (let d = 0; d < this.sceneDependencies.length; d++) {
        await this.sceneDependencies[d](index, ticksToMillis(index))
      }

      resolveSceneLayouts(this.scene)
      this.positioningSystem.solve(this.scene)
    })
  }

  private appendInstruction(instruction: SceneInstruction, atTick: number) {
    // Check if the map already has an entry for this tick.
    if (this.sceneInstructions.has(atTick)) {
      // If yes, append the new instruction to the existing list.
      this.sceneInstructions.get(atTick)!.push(instruction)
    } else {
      // Otherwise, create a new list with this instruction and add it to the map.
      this.sceneInstructions.set(atTick, [instruction])
    }
  }

  // Replace recreateComponents with reset logic
  private resetComponents(notSize: boolean) {
    audioStopAll()   
    this.resetSceneVars()
    this.resetScene()
    this.resetCamera()
    this.resetRenderer(notSize)
  }

  private resetSceneVars() {
    this.clearExposedObjects()
    this.clearExposedCameras()
    this.clearCollisionWatches()
    this.sceneRenderTick = 0
    this.totalSceneTicks = 0
    this.animationTimeline.reset()
    this.timeline.reset()
    this.sceneDependencies = []
    this.positioningSystem.reset()
    this.sceneInstructions = new Map()
    this.planedSounds = new Map()
    this.clearRenderingAudioGather()
    this.randomGenerator = Alea(definedMotionConfig.seed)
    this.patchedMathRandomGenerator = Alea(definedMotionConfig.seed)
  }

  private clearExposedObjects(): void {
    this.exposureRegistry.clear()
  }

  private clearRenderingAudioGather(): void {
    this.renderingAudioGather = []
    this.renderingAudioByFrame.clear()
  }

  private clearExposedCameras(): void {
    this.cameraRegistry.clear()
  }

  private clearCollisionWatches(): void {
    this.collisionRegistry.clear()
  }

  private async withSeededRandom<T>(operation: () => Promise<T> | T): Promise<T> {
    const originalRandom = Math.random
    Math.random = () => this.patchedMathRandomGenerator()
    try {
      return await operation()
    } finally {
      Math.random = originalRandom
    }
  }

  private captureCameraState(camera: THREE.Camera) {
    const state: typeof this.initialCameraState = {
      position: camera.position.clone(),
      rotation: camera.rotation.clone()
    }

    if (camera instanceof THREE.OrthographicCamera) {
      state.zoom = camera.zoom
      state.left = camera.left
      state.right = camera.right
      state.top = camera.top
      state.bottom = camera.bottom
    } else if (camera instanceof THREE.PerspectiveCamera) {
      state.zoom = camera.zoom
      state.fov  = (camera as THREE.PerspectiveCamera).fov
    }

    return state
  }

  private resetScene() {
    // Remove all non-initial objects
    const currentChildren = [...this.scene.children]
    currentChildren.forEach((child) => {
      if (!this.initialSceneChildren.includes(child)) {
        this.scene.remove(child)
        // Dispose geometry and materials if needed
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose()
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose())
          } else {
            child.material?.dispose()
          }
        }
      }
    })
  }

  private resetCamera() {
    const cam = this.camera
    for (const child of [...cam.children]) {
      if (!this.initialCameraChildren.includes(child)) cam.remove(child)
    }
    cam.position.copy(this.initialCameraState.position)
    cam.rotation.copy(this.initialCameraState.rotation)

    if (cam instanceof THREE.OrthographicCamera) {
      cam.zoom = this.initialCameraState.zoom!
      cam.left = this.initialCameraState.left!
      cam.right = this.initialCameraState.right!
      cam.top = this.initialCameraState.top!
      cam.bottom = this.initialCameraState.bottom!
      cam.updateProjectionMatrix()
    }

    if (cam instanceof THREE.PerspectiveCamera) {
      cam.zoom = this.initialCameraState.zoom!
      if (this.initialCameraState.fov != null) {
        (cam as THREE.PerspectiveCamera).fov = this.initialCameraState.fov  
      }
    }
  }

  private resetRenderer(notSize: boolean) {
    if (!notSize) {
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight)
    }

    this.renderer.setClearColor(
      this.initialRendererState.clearColor,
      this.initialRendererState.clearAlpha
    )
    this.renderer.shadowMap.enabled = this.initialRendererState.shadowMapEnabled
  }

  private getSceneInstructionsUpToIndex(
    index: number
  ): Array<{ key: number; instruction: SceneInstruction }> {
    // Filter keys that are less than or equal to the provided index and sort them in ascending order.
    const sortedKeys = Array.from(this.sceneInstructions.keys())
      .filter((key) => key <= index)
      .sort((a, b) => a - b)

    // Create a result array to hold objects that couple each key with its corresponding instruction.
    const coupledInstructions: Array<{ key: number; instruction: SceneInstruction }> = []

    // For each key, retrieve its instructions and push an object for each instruction.
    sortedKeys.forEach((key) => {
      const instructions = this.sceneInstructions.get(key)
      if (instructions) {
        instructions.forEach((instruction) => {
          coupledInstructions.push({ key, instruction })
        })
      }
    })

    return coupledInstructions
  }
}
