import type { GridCellBounds } from '../../automation/types'
import { AutomationCommandError } from './automationError'
import type { AnimatedScene } from './lib/scene/sceneClass'

export interface ImageGridRender {
  png: Blob
  cells: GridCellBounds[]
  width: number
  height: number
  columns: number
  rows: number
  cellHeight: number
}

interface ImageGridOptions<Item> {
  kind: 'timeline' | 'camera'
  scene: AnimatedScene
  items: readonly Item[]
  cellWidth: number
  columns?: number
  renderItem: (item: Item, index: number) => Promise<void> | void
  labelItem: (item: Item, index: number) => { title: string; description?: string }
}

/** Composes already-renderable views into the shared DefinedMotion grid presentation. */
export const renderImageGrid = async <Item>(
  options: ImageGridOptions<Item>
): Promise<ImageGridRender> => {
  const cameraGrid = options.kind === 'camera'
  const name = cameraGrid ? 'Camera grid' : 'Timeline grid'
  const columns = options.columns ?? Math.ceil(Math.sqrt(options.items.length))
  if (columns > options.items.length) {
    throw new AutomationCommandError(
      'INVALID_COLUMNS',
      `${name} columns cannot exceed the ${options.items.length} selected items`
    )
  }

  const gap = 8
  const padding = 8
  const imageHeight = Math.round((options.cellWidth * options.scene.height) / options.scene.width)
  const labelHeight = cameraGrid
    ? Math.max(52, Math.round(options.cellWidth * 0.16))
    : Math.max(32, Math.round(options.cellWidth * 0.1))
  const cellHeight = imageHeight + labelHeight
  const rows = Math.ceil(options.items.length / columns)
  const width = padding * 2 + columns * options.cellWidth + (columns - 1) * gap
  const height = padding * 2 + rows * cellHeight + (rows - 1) * gap
  if (width > 16_384 || height > 16_384 || width * height > 64_000_000) {
    throw new AutomationCommandError(
      cameraGrid ? 'CAMERA_GRID_TOO_LARGE' : 'TIMELINE_GRID_TOO_LARGE',
      `${name} would be ${width}x${height}; reduce ${cameraGrid ? 'cameras' : 'frames'}, columns, or cell width`
    )
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) {
    throw new AutomationCommandError(
      'CANVAS_UNAVAILABLE',
      `Could not create the ${name.toLowerCase()} canvas`
    )
  }
  context.fillStyle = '#111827'
  context.fillRect(0, 0, width, height)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'

  const cells: GridCellBounds[] = []
  for (let index = 0; index < options.items.length; index++) {
    const item = options.items[index]
    await options.renderItem(item, index)

    const column = index % columns
    const row = Math.floor(index / columns)
    const x = padding + column * (options.cellWidth + gap)
    const y = padding + row * (cellHeight + gap)
    context.drawImage(options.scene.renderer.domElement, x, y, options.cellWidth, imageHeight)
    drawLabel(
      context,
      options.labelItem(item, index),
      x,
      y + imageHeight,
      options.cellWidth,
      labelHeight
    )
    cells.push({ row, column, x, y, width: options.cellWidth, height: imageHeight })
  }

  const png = await new Promise<Blob | null>((resolvePromise) =>
    canvas.toBlob(resolvePromise, 'image/png')
  )
  if (!png) {
    throw new AutomationCommandError('PNG_ENCODING_FAILED', `Could not encode ${name} as PNG`)
  }

  return { png, cells, width, height, columns, rows, cellHeight }
}

export const validateImageGridLayout = (
  columns: number | undefined,
  cellWidth: number,
  maximumItems: number,
  name: string
): void => {
  if (
    columns !== undefined &&
    (!Number.isInteger(columns) || columns < 1 || columns > maximumItems)
  ) {
    throw new AutomationCommandError(
      'INVALID_COLUMNS',
      `${name} columns must be between 1 and ${maximumItems}`
    )
  }
  if (!Number.isInteger(cellWidth) || cellWidth < 120 || cellWidth > 1920) {
    throw new AutomationCommandError(
      'INVALID_CELL_WIDTH',
      `${name} cell width must be between 120 and 1920 pixels`
    )
  }
}

const drawLabel = (
  context: CanvasRenderingContext2D,
  label: { title: string; description?: string },
  x: number,
  y: number,
  width: number,
  height: number
): void => {
  context.fillStyle = '#0f172a'
  context.fillRect(x, y, width, height)
  context.textBaseline = 'middle'

  if (label.description === undefined) {
    const fontSize = Math.max(12, Math.min(20, Math.round(height * 0.44)))
    context.fillStyle = '#f8fafc'
    context.font = `600 ${fontSize}px sans-serif`
    context.fillText(fitText(context, label.title, width - 20), x + 10, y + height / 2)
    return
  }

  const titleSize = Math.max(13, Math.min(21, Math.round(height * 0.34)))
  const descriptionSize = Math.max(11, Math.min(16, Math.round(height * 0.24)))
  context.fillStyle = '#f8fafc'
  context.font = `600 ${titleSize}px sans-serif`
  context.fillText(fitText(context, label.title, width - 20), x + 10, y + height * 0.34)
  context.fillStyle = '#94a3b8'
  context.font = `400 ${descriptionSize}px sans-serif`
  context.fillText(fitText(context, label.description, width - 20), x + 10, y + height * 0.72)
}

const fitText = (context: CanvasRenderingContext2D, text: string, maximumWidth: number): string => {
  if (context.measureText(text).width <= maximumWidth) return text
  let truncated = text
  while (truncated.length > 1 && context.measureText(`${truncated}…`).width > maximumWidth) {
    truncated = truncated.slice(0, -1)
  }
  return `${truncated}…`
}
