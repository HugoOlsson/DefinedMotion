import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'

export interface AnimationFrameDriver {
  request(callback: FrameRequestCallback): number
  cancel(handle: number): void
}

const browserAnimationFrames: AnimationFrameDriver = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle)
}

/**
 * Renders the interactive viewport only when OrbitControls or editor state
 * changes. Playback and output rendering keep their own deterministic loops
 * and suspend this scheduler while they own the canvas.
 */
export class InteractiveViewportScheduler {
  private frameHandle: number | null = null
  private active = false
  private dirty = false
  private disposed = false
  private updatingControls = false

  private readonly handleControlsChange = (): void => {
    // OrbitControls emits change synchronously from update(). That change is
    // rendered by the current tick, so it must not enqueue a redundant frame.
    if (this.updatingControls) return
    this.invalidate()
  }

  private readonly runFrame = (): void => {
    this.frameHandle = null
    if (!this.active || this.disposed) return

    const wasDirty = this.dirty
    this.dirty = false

    this.updatingControls = true
    let controlsChanged = false
    try {
      controlsChanged = this.controls.update()
    } finally {
      this.updatingControls = false
    }

    if (wasDirty || controlsChanged) this.render()
    if (controlsChanged) this.scheduleFrame()
  }

  constructor(
    private readonly controls: OrbitControls,
    private readonly render: () => void,
    private readonly animationFrames: AnimationFrameDriver = browserAnimationFrames
  ) {
    this.controls.addEventListener('change', this.handleControlsChange)
  }

  resume(renderCurrentState = false): void {
    if (this.disposed) return
    this.active = true
    this.controls.enabled = true
    if (renderCurrentState) this.invalidate()
  }

  suspend(): void {
    if (this.disposed) return
    this.active = false
    this.controls.enabled = false
    this.dirty = false
    this.cancelFrame()
  }

  invalidate(): void {
    if (!this.active || this.disposed) return
    this.dirty = true
    this.scheduleFrame()
  }

  dispose(): void {
    if (this.disposed) return
    this.suspend()
    this.disposed = true
    this.controls.removeEventListener('change', this.handleControlsChange)
  }

  private scheduleFrame(): void {
    if (!this.active || this.disposed || this.frameHandle !== null) return
    this.frameHandle = this.animationFrames.request(this.runFrame)
  }

  private cancelFrame(): void {
    if (this.frameHandle === null) return
    this.animationFrames.cancel(this.frameHandle)
    this.frameHandle = null
  }
}
