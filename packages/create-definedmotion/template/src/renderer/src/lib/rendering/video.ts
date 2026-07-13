import * as THREE from 'three'
import { createAnim, type UserAnimation } from '../animation/protocols'
import { easeLinear } from '../animation/interpolations'
import { assetUrl, type AssetSource } from '../assets/assetReference'
import type {
  ExactFramePreparationContext,
  FrameResource,
  RealtimeFrameContext
} from '../scene/frameResource'
import { timelineFPS, type AnimatedScene } from '../scene/sceneClass'

export interface VideoPlaneOptions {
  /** Stable identity for the decoder and texture across scene rebuilds. */
  id: string
  width?: number
  height?: number
  fit?: 'cover' | 'contain' | 'stretch'
  initialTimeMs?: number
}

export interface VideoPlayOptions {
  sourceStartMs?: number
  playbackRate?: number
  loop?: boolean
}

export interface VideoPlane extends THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> {
  play(durationMs: number, options?: VideoPlayOptions): UserAnimation
}

interface VideoFrameState {
  timeSeconds: number
  advancing: boolean
  playbackRate: number
  loop: boolean
}

const MEDIA_TIMEOUT_MS = 10_000
const FRAME_TIMEOUT_MS = 2_000
const SOFT_DRIFT_SECONDS = 0.03
const START_DRIFT_SECONDS = 0.12
const HARD_DRIFT_SECONDS = 0.5
const HARD_SYNC_INTERVAL_MS = 1_000
const MAX_RATE_CORRECTION = 0.05
const TIME_TOLERANCE_SECONDS = 0.0005

/**
 * Creates a silent video surface. The returned mesh is immediate; metadata and
 * decoding are awaited only when the scene actually presents a frame.
 */
export function createVideoPlane(
  scene: AnimatedScene,
  source: AssetSource,
  options: VideoPlaneOptions
): VideoPlane {
  const id = validId(options.id)
  const width = positive(options.width ?? 9, 'width')
  const height = positive(options.height ?? 16, 'height')
  const fit = options.fit ?? 'cover'
  const initialTime = nonNegative(options.initialTimeMs ?? 0, 'initialTimeMs') / 1000
  const sourceUrl = assetUrl(source)
  const targetAspect = width / height
  const videoSource = scene.getOrCreateFrameResource(
    `video:${id}`,
    sourceUrl,
    () => new VideoSource(sourceUrl)
  )

  const state: VideoFrameState = {
    timeSeconds: initialTime,
    advancing: false,
    playbackRate: 1,
    loop: false
  }
  const geometry = new THREE.PlaneGeometry(width, height)
  const material = new THREE.MeshBasicMaterial({
    map: videoSource.texture,
    transparent: true,
    toneMapped: false
  })
  const mesh = new THREE.Mesh(geometry, material) as VideoPlane
  let presentationFitted = false

  const fitPresentation = (): void => {
    if (presentationFitted || !videoSource.ready) return
    fitTexture(videoSource.texture, videoSource.aspect, targetAspect, fit)
    if (fit === 'contain') fitContainedGeometry(geometry, videoSource.aspect, targetAspect)
    presentationFitted = true
  }

  scene.useFrameResource({
    resource: videoSource,
    updateRealtime: (context) => {
      videoSource.updateRealtime(state, context)
      fitPresentation()
      return undefined
    },
    prepareExact: async (context) => {
      await videoSource.prepareExact(state, context)
      fitPresentation()
    }
  })

  Object.defineProperty(mesh, 'play', {
    value: (durationMs: number, playOptions: VideoPlayOptions = {}) =>
      videoAnimation(videoSource, state, durationMs, playOptions)
  })
  return mesh
}

class VideoSource implements FrameResource {
  readonly video: HTMLVideoElement
  readonly texture: ControlledVideoTexture
  private readonly lifetime = new AbortController()
  private readonly metadata: Promise<void>
  private metadataReady = false
  private realtime = false
  private playPending = false
  private playRequest = 0
  private nativePlaybackUnavailable = false
  private warnedAboutFallback = false
  private preparedTime = Number.NaN
  private desiredRealtimeTime = 0
  private desiredPlaybackRate = 1
  private desiredLoop = false
  private lastHardSyncAt = Number.NEGATIVE_INFINITY
  private videoFrameCallbackId?: number
  private lastMarkedMediaTime = Number.NaN
  private disposed = false

  constructor(sourceUrl: string) {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    video.src = sourceUrl
    this.video = video

    const texture = new ControlledVideoTexture(video)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.generateMipmaps = false
    this.texture = texture

    this.metadata = waitForMetadata(video, this.lifetime.signal).then(() => {
      this.metadataReady = true
    })
    void this.metadata.catch(() => undefined)
    this.armTextureUpdates()
  }

  get aspect(): number {
    return this.video.videoWidth / this.video.videoHeight
  }

  get ready(): boolean {
    return this.metadataReady
  }

  async prepareExact(state: VideoFrameState, context: ExactFramePreparationContext): Promise<void> {
    this.assertActive(context.signal)
    await waitWithSignal(this.metadata, context.signal)
    this.assertActive(context.signal)

    const time = this.normalizeTime(state.timeSeconds, state.loop)
    this.stopNativePlayback()
    await this.seekExactFrame(time, context.signal)
    this.assertActive(context.signal)
    this.markTextureDirty(time, true)
  }

  updateRealtime(state: VideoFrameState, context: RealtimeFrameContext): undefined {
    if (this.disposed) throw new Error('Video source has been disposed')
    if (!this.metadataReady) return undefined

    const time = this.normalizeTime(state.timeSeconds, state.loop)
    const shouldAdvance =
      (state.advancing || context.continuesAfterFrame) &&
      (state.loop || time < this.video.duration - TIME_TOLERANCE_SECONDS)
    this.desiredRealtimeTime = time
    this.desiredPlaybackRate = state.playbackRate
    this.desiredLoop = state.loop

    if (!shouldAdvance || this.nativePlaybackUnavailable) {
      this.stopNativePlayback()
      this.seekRealtime(time, state.loop)
      this.updateTextureWithoutFrameCallback()
      return undefined
    }

    this.video.loop = state.loop
    if (context.discontinuity) {
      this.lastHardSyncAt = performance.now()
      this.setCurrentTime(time)
    }
    if (this.realtime && this.video.paused) this.realtime = false
    if (!this.realtime && !this.playPending) {
      this.seekRealtime(time, state.loop, START_DRIFT_SECONDS)
      this.startNativePlayback()
      return undefined
    }

    if (context.discontinuity) {
      if (Math.abs(this.video.playbackRate - state.playbackRate) > 0.001) {
        this.video.playbackRate = state.playbackRate
      }
      this.updateTextureWithoutFrameCallback()
      return undefined
    }

    if (this.realtime && !this.video.seeking) {
      const drift = signedTimelineDrift(
        this.video.currentTime,
        time,
        this.video.duration,
        state.loop
      )
      const now = performance.now()
      if (
        Math.abs(drift) >= HARD_DRIFT_SECONDS &&
        now - this.lastHardSyncAt >= HARD_SYNC_INTERVAL_MS
      ) {
        this.lastHardSyncAt = now
        this.setCurrentTime(time)
      } else {
        const correction = clamp(drift * 0.2, -MAX_RATE_CORRECTION, MAX_RATE_CORRECTION)
        const correctedRate =
          Math.abs(drift) < SOFT_DRIFT_SECONDS
            ? state.playbackRate
            : state.playbackRate * (1 + correction)
        if (Math.abs(this.video.playbackRate - correctedRate) > 0.001) {
          this.video.playbackRate = correctedRate
        }
      }
    }

    this.updateTextureWithoutFrameCallback()
    return undefined
  }

  normalizeTime(time: number, loop: boolean): number {
    const duration = this.video.duration
    if (!Number.isFinite(duration) || duration <= 0) return Math.max(0, time)
    if (!loop) return Math.max(0, Math.min(time, duration))
    return ((time % duration) + duration) % duration
  }

  suspend(): void {
    this.stopNativePlayback()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.lifetime.abort()
    this.stopNativePlayback()
    if (this.videoFrameCallbackId !== undefined) {
      this.video.cancelVideoFrameCallback(this.videoFrameCallbackId)
      this.videoFrameCallbackId = undefined
    }
    this.video.removeAttribute('src')
    this.video.load()
    this.texture.dispose()
  }

  private startNativePlayback(): void {
    const request = ++this.playRequest
    this.playPending = true
    this.video.loop = this.desiredLoop
    this.video.playbackRate = this.desiredPlaybackRate
    let started: Promise<void>
    try {
      started = this.video.play()
    } catch (error) {
      this.handlePlaybackFailure(request, error)
      return
    }

    void started.then(
      () => {
        if (this.disposed || request !== this.playRequest) return
        this.playPending = false
        this.realtime = true
        this.preparedTime = Number.NaN
        this.seekRealtime(this.desiredRealtimeTime, this.desiredLoop, START_DRIFT_SECONDS)
      },
      (error) => this.handlePlaybackFailure(request, error)
    )
  }

  private handlePlaybackFailure(request: number, error: unknown): void {
    if (this.disposed || request !== this.playRequest) return
    this.playPending = false
    this.realtime = false
    if (isAbortError(error)) return
    this.nativePlaybackUnavailable = true
    if (!this.warnedAboutFallback) {
      this.warnedAboutFallback = true
      console.warn('Native video playback is unavailable; using best-effort seeking.', error)
    }
  }

  private stopNativePlayback(): void {
    if (this.realtime || this.playPending || !this.video.paused) {
      this.playRequest++
      this.playPending = false
      if (!this.video.paused) this.video.pause()
    }
    this.realtime = false
  }

  private seekRealtime(time: number, loop: boolean, tolerance = TIME_TOLERANCE_SECONDS): void {
    if (this.video.seeking) return
    const drift = signedTimelineDrift(this.video.currentTime, time, this.video.duration, loop)
    if (Math.abs(drift) > tolerance) this.setCurrentTime(time)
  }

  private setCurrentTime(time: number): void {
    this.preparedTime = Number.NaN
    this.video.currentTime = Math.max(0, Math.min(time, this.video.duration))
  }

  private async seekExactFrame(time: number, signal: AbortSignal): Promise<void> {
    this.assertActive(signal)
    if (Math.abs(this.preparedTime - time) <= TIME_TOLERANCE_SECONDS) return
    await seekVideo(this.video, time, signal)
    this.assertActive(signal)
    this.preparedTime = time
  }

  private armTextureUpdates(): void {
    if (
      this.disposed ||
      this.videoFrameCallbackId !== undefined ||
      typeof this.video.requestVideoFrameCallback !== 'function'
    ) {
      return
    }

    this.videoFrameCallbackId = this.video.requestVideoFrameCallback((_now, metadata) => {
      this.videoFrameCallbackId = undefined
      if (this.disposed) return
      this.markTextureDirty(metadata.mediaTime)
      this.armTextureUpdates()
    })
  }

  private updateTextureWithoutFrameCallback(): void {
    if (
      typeof this.video.requestVideoFrameCallback !== 'function' &&
      this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
      this.markTextureDirty(this.video.currentTime)
    }
  }

  private markTextureDirty(mediaTime: number, force = false): void {
    if (!force && Math.abs(mediaTime - this.lastMarkedMediaTime) <= TIME_TOLERANCE_SECONDS) {
      return
    }
    this.lastMarkedMediaTime = mediaTime
    this.texture.needsUpdate = true
  }

  private assertActive(signal: AbortSignal): void {
    if (this.disposed) throw new Error('Video source has been disposed')
    assertNotAborted(signal)
    assertNotAborted(this.lifetime.signal)
  }
}

/** Video texture updated only by VideoSource's owned, cancellable frame callback. */
class ControlledVideoTexture extends THREE.Texture {
  readonly isVideoTexture = true

  constructor(video: HTMLVideoElement) {
    super(video)
  }

  update(): void {
    // VideoSource marks decoded frames explicitly.
  }
}

const videoAnimation = (
  source: VideoSource,
  state: VideoFrameState,
  durationMs: number,
  options: VideoPlayOptions
): UserAnimation => {
  positive(durationMs, 'durationMs')
  const sourceStart = nonNegative(options.sourceStartMs ?? 0, 'sourceStartMs') / 1000
  const playbackRate = positive(options.playbackRate ?? 1, 'playbackRate')
  const loop = options.loop ?? false
  const sourceDuration = (durationMs / 1000) * playbackRate
  let previousElapsed: number | undefined
  let previousTick: number | undefined

  return createAnim(easeLinear(0, sourceDuration, durationMs), (elapsed, tick, isLast) => {
    const tickDelta = previousTick === undefined ? 0 : tick - previousTick
    const evaluatedRate =
      previousElapsed === undefined || tickDelta <= 0
        ? playbackRate
        : ((elapsed - previousElapsed) * timelineFPS) / tickDelta
    const time = source.normalizeTime(sourceStart + elapsed, loop)
    state.timeSeconds = time
    state.playbackRate = evaluatedRate > 0 ? evaluatedRate : playbackRate
    state.loop = loop
    const movingForward =
      previousElapsed === undefined ? elapsed <= TIME_TOLERANCE_SECONDS : evaluatedRate > 0
    state.advancing = !isLast && movingForward
    previousElapsed = elapsed
    previousTick = tick
  })
}

const waitForMetadata = (video: HTMLVideoElement, signal: AbortSignal): Promise<void> => {
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) return Promise.resolve()
  return waitForMediaEvent(video, 'loadedmetadata', MEDIA_TIMEOUT_MS, signal, () => video.load())
}

const seekVideo = async (
  video: HTMLVideoElement,
  requestedTime: number,
  signal: AbortSignal
): Promise<void> => {
  assertNotAborted(signal)
  const target = Math.max(0, Math.min(requestedTime, video.duration))
  if (Math.abs(video.currentTime - target) <= TIME_TOLERANCE_SECONDS) {
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      await waitForMediaEvent(video, 'loadeddata', MEDIA_TIMEOUT_MS, signal)
    }
    return
  }

  const presentedFrame = waitForPresentedFrame(video, signal)
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      await waitForMediaEvent(video, 'seeked', MEDIA_TIMEOUT_MS, signal, () => {
        video.currentTime = target
      })
      if (Math.abs(video.currentTime - target) <= TIME_TOLERANCE_SECONDS) break
    }
    if (Math.abs(video.currentTime - target) > TIME_TOLERANCE_SECONDS) {
      throw new Error(`Video seek stopped at ${video.currentTime} instead of ${target}`)
    }
    await presentedFrame.promise
  } catch (error) {
    presentedFrame.cancel()
    await presentedFrame.promise.catch(() => undefined)
    throw error
  }
}

const waitForMediaEvent = (
  video: HTMLVideoElement,
  event: 'loadedmetadata' | 'loadeddata' | 'seeked',
  timeoutMs: number,
  signal: AbortSignal,
  action?: () => void
): Promise<void> =>
  new Promise((resolve, reject) => {
    const finish = (complete: () => void): void => {
      window.clearTimeout(timeout)
      video.removeEventListener(event, succeeded)
      video.removeEventListener('error', failed)
      signal.removeEventListener('abort', aborted)
      complete()
    }
    const succeeded = (): void => finish(resolve)
    const failed = (): void =>
      finish(() =>
        reject(new Error(`Video failed: ${video.error?.message ?? 'unknown media error'}`))
      )
    const aborted = (): void => finish(() => reject(abortReason(signal)))
    const timeout = window.setTimeout(
      () => finish(() => reject(new Error(`Timed out waiting for video ${event}`))),
      timeoutMs
    )

    if (signal.aborted) {
      aborted()
      return
    }
    video.addEventListener(event, succeeded, { once: true })
    video.addEventListener('error', failed, { once: true })
    signal.addEventListener('abort', aborted, { once: true })
    try {
      action?.()
    } catch (error) {
      finish(() => reject(error))
    }
  })

const waitForPresentedFrame = (
  video: HTMLVideoElement,
  signal: AbortSignal
): { promise: Promise<void>; cancel: () => void } => {
  if (typeof video.requestVideoFrameCallback !== 'function') {
    return { promise: Promise.resolve(), cancel: () => {} }
  }

  let cancel = (): void => {}
  const promise = new Promise<void>((resolve, reject) => {
    let callbackId = 0
    let settled = false
    const finish = (complete: () => void): void => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      signal.removeEventListener('abort', aborted)
      complete()
    }
    const aborted = (): void => {
      video.cancelVideoFrameCallback(callbackId)
      finish(() => reject(abortReason(signal)))
    }
    const timeout = window.setTimeout(() => {
      video.cancelVideoFrameCallback(callbackId)
      finish(() => reject(new Error('Timed out waiting for a decoded video frame')))
    }, FRAME_TIMEOUT_MS)
    callbackId = video.requestVideoFrameCallback(() => finish(resolve))
    signal.addEventListener('abort', aborted, { once: true })
    cancel = () => {
      video.cancelVideoFrameCallback(callbackId)
      finish(resolve)
    }
  })
  return { promise, cancel: () => cancel() }
}

const waitWithSignal = <T>(promise: Promise<T>, signal: AbortSignal): Promise<T> =>
  new Promise((resolve, reject) => {
    const aborted = (): void => finish(() => reject(abortReason(signal)))
    const finish = (complete: () => void): void => {
      signal.removeEventListener('abort', aborted)
      complete()
    }
    if (signal.aborted) {
      aborted()
      return
    }
    signal.addEventListener('abort', aborted, { once: true })
    promise.then(
      (value) => finish(() => resolve(value)),
      (error) => finish(() => reject(error))
    )
  })

const fitTexture = (
  texture: THREE.Texture,
  sourceAspect: number,
  targetAspect: number,
  fit: NonNullable<VideoPlaneOptions['fit']>
): void => {
  texture.offset.set(0, 0)
  texture.repeat.set(1, 1)
  if (fit !== 'cover') return
  if (sourceAspect > targetAspect) {
    texture.repeat.x = targetAspect / sourceAspect
    texture.offset.x = (1 - texture.repeat.x) / 2
  } else {
    texture.repeat.y = sourceAspect / targetAspect
    texture.offset.y = (1 - texture.repeat.y) / 2
  }
}

const fitContainedGeometry = (
  geometry: THREE.PlaneGeometry,
  sourceAspect: number,
  targetAspect: number
): void => {
  if (sourceAspect > targetAspect) geometry.scale(1, targetAspect / sourceAspect, 1)
  else geometry.scale(sourceAspect / targetAspect, 1, 1)
}

const signedTimelineDrift = (
  currentTime: number,
  desiredTime: number,
  duration: number,
  loop: boolean
): number => {
  let drift = desiredTime - currentTime
  if (loop && duration > 0) {
    if (drift > duration / 2) drift -= duration
    else if (drift < -duration / 2) drift += duration
  }
  return drift
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.max(minimum, Math.min(maximum, value))

const validId = (value: string): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('Video id must be a non-empty string')
  }
  if (value !== value.trim()) throw new Error('Video id cannot have surrounding whitespace')
  return value
}

const positive = (value: number, name: string): number => {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be positive`)
  return value
}

const nonNegative = (value: number, name: string): number => {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} cannot be negative`)
  return value
}

const assertNotAborted = (signal: AbortSignal): void => {
  if (signal.aborted) throw abortReason(signal)
}

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError'

const abortReason = (signal: AbortSignal): Error =>
  signal.reason instanceof Error
    ? signal.reason
    : new DOMException('Operation aborted', 'AbortError')
