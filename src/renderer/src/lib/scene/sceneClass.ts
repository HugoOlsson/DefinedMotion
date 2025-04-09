import { build } from 'vite'
import { captureCanvasFrame, triggerEncoder } from '../animation/captureCanvas'
import {
  createAnim,
  type DependencyUpdater,
  type InternalAnimation,
  type UserAnimation
} from '../animation/protocols'
import { generateID, setCameraPositionText } from '../general/helpers'
import { sleep } from '../rendering/helpers'
import { createScene } from '../rendering/setup'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { easeConstant } from '../animation/interpolations'
import { animationFPSThrottle, renderSkip } from '../../scenes/entry'
import { addDestroyFunction } from '../general/onDestory'

type SceneInstruction = (tick: number) => any

export let globalContainerRef: HTMLElement

export const setGlobalContainerRef = (ref: HTMLElement) => {
  globalContainerRef = ref
}

export class AnimatedScene {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera
  renderer: THREE.WebGLRenderer
  private controls: OrbitControls
  private container: HTMLElement

  sceneRenderTick: number = 0
  private sceneCalculationTick: number = 0
  totalSceneTicks: number = 0
  private sceneAnimations: InternalAnimation[] = []
  private sceneDependencies: DependencyUpdater[] = []
  private sceneInstructions: Map<number, SceneInstruction[]> = new Map()

  private pixelsWidth
  private pixelsHeight

  playEffectFunction: () => any = () => {}

  isPlaying = false

  private initialSceneChildren: THREE.Object3D[] = []
  private initialCameraState: {
    position: THREE.Vector3
    rotation: THREE.Euler
    zoom?: number
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

  private traceFromStart: boolean

  private controlsAnimationFrameId: number | null = null
  private animationFrameId: number | null = null

  constructor(
    pixelsWidth: number,
    pixelsHeight: number,
    threeDim: boolean = true,
    traceFromStart: boolean = true,
    buildFunctionGiven: (scene: AnimatedScene) => any
  ) {
    this.container = globalContainerRef
    this.pixelsHeight = pixelsHeight
    this.pixelsWidth = pixelsWidth
    this.traceFromStart = traceFromStart
    const { scene, camera, renderer, controls } = createScene(
      globalContainerRef,
      pixelsWidth,
      pixelsHeight,
      threeDim,
      this.zoom,
      this.farLimitRender
    )

    this.buildFunction = async () => {
      await buildFunctionGiven(this)
      this.end()
    }

    this.attachScreenSizeListener(globalContainerRef, threeDim)
    // Store initial state
    this.initialSceneChildren = [...scene.children]
    this.initialCameraState = this.captureCameraState(camera)
    this.initialRendererState = {
      clearColor: renderer.getClearColor(new THREE.Color()),
      clearAlpha: renderer.getClearAlpha(),
      shadowMapEnabled: renderer.shadowMap.enabled
    }

    this.scene = scene
    this.camera = camera
    this.renderer = renderer
    this.controls = controls

    this.startControls()

    addDestroyFunction(() => this.onDestroy())
  }

  onDestroy() {
    this.stopControls()
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId)
  }

  add = (...elements: THREE.Mesh[] | THREE.Group[] | THREE.Object3D[]) => {
    elements.forEach((e) => this.scene.add(e))
  }

  do(instruction: SceneInstruction) {
    this.appendInstruction(instruction, this.sceneCalculationTick)
  }

  addAnim(...animations: UserAnimation[]) {
    const longest = Math.max(...animations.map((a) => a.interpolation.length))
    for (const animation of animations) {
      this.appendAnimation(animation)
    }
    this.sceneCalculationTick += longest
  }

  onEachTick(updater: DependencyUpdater) {
    this.sceneDependencies.push(updater)
  }

  end() {
    this.totalSceneTicks = this.sceneCalculationTick + 1
  }

  addWait(duration: number) {
    this.addAnim(createAnim(easeConstant(0, duration), () => {}))
  }

  async jumpToFrameAtIndex(index: number, notSize: boolean = false) {
    this.resetComponents(notSize)
    await this.buildFunction(this)

    if (index > this.totalSceneTicks - 1) {
      index = 0
    }

    if (this.traceFromStart) {
      await this.traceToFrameIndex(index)
    } else {
      const allInstructionUntilNow = this.getSceneInstructionsUpToIndex(index - 1)
      for (let i = 0; i < allInstructionUntilNow.length; i++) {
        await allInstructionUntilNow[i].instruction(allInstructionUntilNow[i].key)
      }
      await this.traceCurrentFrame(index)
    }

    this.renderCurrentFrame()
    this.sceneRenderTick = index
    await this.playEffectFunction()

    // console.log('INSTRUCTIONS', this.sceneInstructions)
  }

  getAspectRatio() {
    return this.pixelsWidth / this.pixelsHeight
  }

  private syncControlsWithCamera() {
    // Get the direction vector (works for both camera types)
    const direction = new THREE.Vector3(0, 0, -1)

    // Use the appropriate transformation based on camera type
    if (this.camera.type === 'OrthographicCamera') {
      direction.transformDirection(this.camera.matrixWorld)
    } else {
      direction.applyQuaternion(this.camera.quaternion)
    }

    // Calculate the new target (same for both camera types)
    const targetDistance = this.controls.target.distanceTo(this.controls.object.position)
    const newTarget = this.camera.position.clone().add(direction.multiplyScalar(targetDistance))
    this.controls.target.copy(newTarget)

    // Reset the internal state
    this.controls.update()
  }

  private startControls() {
    this.controls.enabled = true
    let animateCounter = 0
    // Animation loop
    const animate = () => {
      if (this.isPlaying) return
      this.controlsAnimationFrameId = requestAnimationFrame(animate)
      this.controls.update() // Always update controls
      this.renderCurrentFrame()
      animateCounter++

      if (animateCounter % 10 === 0) {
        setCameraPositionText(this.camera.position, this.camera.rotation)
      }
    }
    animate()
  }

  private stopControls() {
    this.controls.enabled = false
    if (this.controlsAnimationFrameId !== null) {
      cancelAnimationFrame(this.controlsAnimationFrameId)
    }
  }

  private attachScreenSizeListener(container: HTMLElement, threeDim: boolean) {
    const internalAspect = this.pixelsWidth / this.pixelsHeight
    // Resize handler
    const handleResize = () => {
      const newWidth = container.clientWidth
      const newHeight = container.clientHeight

      if (threeDim && this.camera instanceof THREE.PerspectiveCamera) {
        this.camera.aspect = internalAspect
      } else if (this.camera instanceof THREE.OrthographicCamera) {
        this.camera.left = -this.zoom * internalAspect
        this.camera.right = this.zoom * internalAspect
      }

      this.camera.updateProjectionMatrix()
      this.renderer.setSize(newWidth, newHeight)
      this.renderer.render(this.scene, this.camera)
    }
    window.addEventListener('resize', handleResize)
  }

  pause() {
    this.isPlaying = false
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId)

    this.syncControlsWithCamera()

    this.startControls()
  }

  async render() {
    this.isPlaying = true
    this.stopControls()
    const renderName = generateID(10)

    const cpu_free_time = 5
    const div = this.container
    const originalPosition = div.style.position
    const originalTop = div.style.top
    const originalLeft = div.style.left
    const originalZIndex = div.style.zIndex
    // Set to position absolute
    div.style.position = 'absolute'
    div.style.top = '0' // Or whatever values you need
    div.style.left = '0'
    div.style.zIndex = '999' // Optional, to ensure it's on top
    div.style.opacity = '0'

    this.renderer.setSize(this.pixelsWidth, this.pixelsHeight, true)
    const startFrame = 0
    await this.jumpToFrameAtIndex(startFrame, true)
    for (let i = startFrame; i < this.totalSceneTicks; i++) {
      this.sceneRenderTick = i
      //To not trace start frame twice
      if (i !== startFrame) {
        await this.traceCurrentFrame(this.sceneRenderTick)
      }
      if (this.sceneRenderTick % renderSkip === 0) {
        this.renderCurrentFrame()
        captureCanvasFrame(Math.round(i / renderSkip), renderName, this.renderer.domElement)
      }
      await this.playEffectFunction()
      if (i % 10 === 0) {
        await sleep(cpu_free_time)
      }
    }

    triggerEncoder()

    div.style.opacity = '1'

    // Restore original positioning
    div.style.position = originalPosition
    div.style.top = originalTop
    div.style.left = originalLeft
    div.style.zIndex = originalZIndex

    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight)
    await this.jumpToFrameAtIndex(0)
    this.renderCurrentFrame()

    this.isPlaying = false
    this.startControls()
  }

  play() {
    this.playSequenceOfAnimation(0, this.totalSceneTicks - 1)
  }

  async playSequenceOfAnimation(fromFrame: number, toFrame: number) {
    this.isPlaying = true
    this.stopControls()
    await this.jumpToFrameAtIndex(fromFrame)
    setCameraPositionText(this.camera.position, this.camera.rotation)

    let currentFrame = fromFrame
    let numberCalledAnimate = 0
    const animate = async (trace: boolean) => {
      if (!this.isPlaying) return
      if (currentFrame <= toFrame) {
        if (numberCalledAnimate % animationFPSThrottle === 0) {
          this.sceneRenderTick = currentFrame
          //To not apply trace twice if we just jumped to startframe (and thus tranced it)
          if (trace) {
            await this.traceCurrentFrame(this.sceneRenderTick)
          }
          this.renderCurrentFrame()
          currentFrame++
          await this.playEffectFunction()
        }
        numberCalledAnimate++
        this.animationFrameId = requestAnimationFrame(async () => await animate(true))
      } else {
        await this.jumpToFrameAtIndex(0)
        currentFrame = 0
        this.animationFrameId = requestAnimationFrame(async () => await animate(false))
      }
    }

    this.animationFrameId = requestAnimationFrame(() => animate(false))
  }

  renderCurrentFrame() {
    this.renderer.render(this.scene, this.camera)
  }

  private async traceToFrameIndex(index: number) {
    //Trace all actions
    for (let traceTick = 0; traceTick <= index; traceTick++) {
      await this.traceCurrentFrame(traceTick)
    }
  }

  private async traceCurrentFrame(index: number) {
    //Trace all actions
    const frameInstructions = this.sceneInstructions.get(index)
    if (frameInstructions) {
      for (let i = 0; i < frameInstructions.length; i++) {
        await frameInstructions[i](index)
      }
    }
    const animationsForFrame = this.getActiveAnimationsForTick(index)
    for (let a = 0; a < animationsForFrame.length; a++) {
      const localInterpolationIndex = index - animationsForFrame[a].startTick
      await animationsForFrame[a].updater(
        animationsForFrame[a].interpolation[localInterpolationIndex],
        index
      )
    }

    for (let d = 0; d < this.sceneDependencies.length; d++) {
      await this.sceneDependencies[d](index)
    }
  }

  private getActiveAnimationsForTick(sceneTick: number): InternalAnimation[] {
    return this.sceneAnimations.filter(
      (anim) => anim.startTick <= sceneTick && anim.endTick >= sceneTick
    )
  }

  private appendAnimation(userAnimation: UserAnimation) {
    const internalAnimation: InternalAnimation = {
      startTick: this.sceneCalculationTick,
      endTick: this.sceneCalculationTick + userAnimation.interpolation.length - 1,
      updater: userAnimation.updater,
      interpolation: userAnimation.interpolation
    }

    this.sceneAnimations.push(internalAnimation)
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
    this.resetSceneVars()
    this.resetScene()
    this.resetCamera()
    this.resetRenderer(notSize)
  }

  private resetSceneVars() {
    this.sceneRenderTick = 0
    this.sceneCalculationTick = 0
    this.totalSceneTicks = 0
    this.sceneAnimations = []
    this.sceneDependencies = []
    this.sceneInstructions = new Map()
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
