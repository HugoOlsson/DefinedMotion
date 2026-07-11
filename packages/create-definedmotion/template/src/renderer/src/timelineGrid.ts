import type { TimelineGridAutomationRequest, TimelineGridCell } from '../../automation/types'
import type { AnimatedScene } from './lib/scene/sceneClass'
import { AutomationCommandError } from './automationError'

export interface TimelineGridRender {
  png: Blob
  frames: number[]
  cells: TimelineGridCell[]
  width: number
  height: number
  columns: number
  rows: number
  cellHeight: number
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
  if (
    request.columns !== undefined &&
    (!Number.isInteger(request.columns) || request.columns < 1 || request.columns > 100)
  ) {
    throw new AutomationCommandError(
      'INVALID_COLUMNS',
      'Timeline grid columns must be between 1 and 100'
    )
  }
  if (!Number.isInteger(request.cellWidth) || request.cellWidth < 120 || request.cellWidth > 1920) {
    throw new AutomationCommandError(
      'INVALID_CELL_WIDTH',
      'Timeline grid cell width must be between 120 and 1920 pixels'
    )
  }
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
  const columns = request.columns ?? Math.ceil(Math.sqrt(frames.length))
  if (columns > frames.length) {
    throw new AutomationCommandError(
      'INVALID_COLUMNS',
      `Timeline grid columns cannot exceed the ${frames.length} selected frames`
    )
  }

  const gap = 8
  const padding = 8
  const imageHeight = Math.round((request.cellWidth * scene.height) / scene.width)
  const labelHeight = Math.max(32, Math.round(request.cellWidth * 0.1))
  const cellHeight = imageHeight + labelHeight
  const rows = Math.ceil(frames.length / columns)
  const width = padding * 2 + columns * request.cellWidth + (columns - 1) * gap
  const height = padding * 2 + rows * cellHeight + (rows - 1) * gap
  if (width > 16_384 || height > 16_384 || width * height > 64_000_000) {
    throw new AutomationCommandError(
      'TIMELINE_GRID_TOO_LARGE',
      `Timeline grid would be ${width}x${height}; reduce frames, columns, or cell width`
    )
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) {
    throw new AutomationCommandError(
      'CANVAS_UNAVAILABLE',
      'Could not create the timeline grid canvas'
    )
  }
  context.fillStyle = '#111827'
  context.fillRect(0, 0, width, height)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'

  const cells: TimelineGridCell[] = []
  const fontSize = Math.max(12, Math.min(20, Math.round(labelHeight * 0.44)))
  context.font = `600 ${fontSize}px sans-serif`
  context.textBaseline = 'middle'

  for (let index = 0; index < frames.length; index++) {
    const frame = frames[index]
    if (!(frameZeroIsReady && index === 0 && frame === 0)) {
      await scene.seekExact(frame)
    }

    const column = index % columns
    const row = Math.floor(index / columns)
    const x = padding + column * (request.cellWidth + gap)
    const y = padding + row * (cellHeight + gap)
    context.drawImage(scene.renderer.domElement, x, y, request.cellWidth, imageHeight)
    context.fillStyle = '#0f172a'
    context.fillRect(x, y + imageHeight, request.cellWidth, labelHeight)
    context.fillStyle = '#f8fafc'
    const timeMs = scene.getCurrentTimeMs()
    const label = `Frame ${frame} · ${formatTimelineTime(timeMs)}`
    context.fillText(label, x + 10, y + imageHeight + labelHeight / 2)
    cells.push({
      frame,
      timeMs,
      row,
      column,
      x,
      y,
      width: request.cellWidth,
      height: imageHeight,
      label
    })
  }

  const png = await new Promise<Blob | null>((resolvePromise) =>
    canvas.toBlob(resolvePromise, 'image/png')
  )
  if (!png) {
    throw new AutomationCommandError(
      'PNG_ENCODING_FAILED',
      'Could not encode the timeline grid as PNG'
    )
  }

  return { png, frames, cells, width, height, columns, rows, cellHeight }
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
