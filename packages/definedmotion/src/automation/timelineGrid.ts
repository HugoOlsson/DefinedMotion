import type { TimelineGridAutomationRequest, TimelineGridCell } from './types'
import type { AnimatedScene } from '../runtime/scene/sceneClass'
import { AutomationCommandError } from './errors'
import { renderImageGrid, validateImageGridLayout, type ImageGridRender } from './imageGrid'

export interface TimelineGridRender extends ImageGridRender {
  frames: number[]
  cells: TimelineGridCell[]
}

export const validateTimelineGridRequest = (request: TimelineGridAutomationRequest): void => {
  if (request.frames !== undefined && request.count !== undefined) {
    throw new AutomationCommandError(
      'INVALID_FRAME_SELECTION',
      'Timeline grid frames and count cannot be combined'
    )
  }
  if (request.frames !== undefined) {
    if (
      !Array.isArray(request.frames) ||
      request.frames.length === 0 ||
      request.frames.length > 100 ||
      request.frames.some((frame) => !Number.isInteger(frame) || frame < 0)
    ) {
      throw new AutomationCommandError(
        'INVALID_FRAMES',
        'Timeline grid frames must contain 1-100 non-negative integers'
      )
    }
    if (new Set(request.frames).size !== request.frames.length) {
      throw new AutomationCommandError('DUPLICATE_FRAMES', 'Timeline grid frames must be unique')
    }
  }
  if (
    request.count !== undefined &&
    (!Number.isInteger(request.count) || request.count < 1 || request.count > 100)
  ) {
    throw new AutomationCommandError(
      'INVALID_FRAME_COUNT',
      'Timeline grid count must be between 1 and 100'
    )
  }
  validateImageGridLayout(request.columns, request.cellWidth, 100, 'Timeline grid')
}

export const renderTimelineGrid = async (
  request: TimelineGridAutomationRequest,
  scene: AnimatedScene
): Promise<TimelineGridRender> => {
  let frames = request.frames
  let frameZeroIsReady = false
  if (!frames) {
    await scene.seekExact(0)
    frames = sampleTimelineFrames(scene.totalSceneTicks, request.count ?? 9)
    frameZeroIsReady = true
  }
  const times = new Map<number, number>()
  const labels = new Map<number, string>()
  const grid = await renderImageGrid({
    kind: 'timeline',
    scene,
    items: frames,
    cellWidth: request.cellWidth,
    columns: request.columns,
    renderItem: async (frame, index) => {
      if (!(frameZeroIsReady && index === 0 && frame === 0)) await scene.seekExact(frame)
      const timeMs = scene.getCurrentTimeMs()
      times.set(frame, timeMs)
      labels.set(frame, `Frame ${frame} · ${formatTimelineTime(timeMs)}`)
    },
    labelItem: (frame) => ({ title: labels.get(frame)! })
  })
  const cells: TimelineGridCell[] = grid.cells.map((bounds, index) => ({
    frame: frames[index],
    timeMs: times.get(frames[index])!,
    ...bounds,
    label: labels.get(frames[index])!
  }))

  return { ...grid, frames, cells }
}

const sampleTimelineFrames = (durationInFrames: number, requestedCount: number): number[] => {
  const count = Math.min(durationInFrames, requestedCount)
  if (count === 1) return [0]
  const lastFrame = durationInFrames - 1
  return Array.from({ length: count }, (_, index) => Math.round((index * lastFrame) / (count - 1)))
}

const formatTimelineTime = (timeMs: number): string => {
  if (timeMs < 1000) return `${Math.round(timeMs)} ms`
  const seconds = timeMs / 1000
  return `${seconds.toFixed(seconds >= 10 || Number.isInteger(seconds) ? 0 : 1)} s`
}
