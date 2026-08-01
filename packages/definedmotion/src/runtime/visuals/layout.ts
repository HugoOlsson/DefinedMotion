import * as THREE from 'three'
import { SceneRuntimeError } from '../scene/sceneErrors'
import { resolveAnchorX, resolveAnchorY } from './measurement'
import type { AnchorX, AnchorY, MeasurableVisual } from './types'

export type LayoutAlignment = 'flex-start' | 'center' | 'flex-end'
export type LayoutJustification =
  | LayoutAlignment
  | 'space-between'
  | 'space-around'
  | 'space-evenly'

export interface LayoutBorderOptions {
  color: THREE.ColorRepresentation
  width: number
}

interface LayoutBoxOptions {
  padding?: number
  width?: number
  height?: number
  anchorX?: AnchorX
  anchorY?: AnchorY
  background?: THREE.ColorRepresentation
  border?: LayoutBorderOptions
}

export interface FlexOptions extends LayoutBoxOptions {
  flexDirection: 'row' | 'column'
  gap?: number
  alignItems?: LayoutAlignment
  justifyContent?: LayoutJustification
}

export interface GridOptions extends LayoutBoxOptions {
  columns: number
  columnGap?: number
  rowGap?: number
  alignItems?: LayoutAlignment
  justifyItems?: LayoutAlignment
}

export type LayoutVisual = MeasurableVisual<THREE.Group> & {
  readonly items: readonly MeasurableVisual[]
  append(item: MeasurableVisual): void
}

interface ItemRecord {
  readonly visual: MeasurableVisual
  readonly slot: THREE.Group
  observedBoundsVersion: number
}

interface MeasuredItem extends ItemRecord {
  readonly bounds: THREE.Box2
  readonly width: number
  readonly height: number
}

interface LayoutController {
  resolve(force?: boolean): void
  reset(): void
}

interface LayoutSurfaceController {
  update(bounds: THREE.Box2): void
}

const LAYOUT_CONTROLLER = Symbol('DefinedMotionLayoutController')

type InternalLayoutVisual = LayoutVisual & {
  [LAYOUT_CONTROLLER]: LayoutController
}

const nonNegative = (value: number | undefined, fallback: number, name: string): number => {
  const resolved = value ?? fallback
  if (!Number.isFinite(resolved) || resolved < 0) {
    throw new Error(`${name} must be a finite non-negative number, received ${resolved}`)
  }
  return resolved
}

const optionalSize = (value: number | undefined, name: string): number | undefined => {
  if (value === undefined) return undefined
  return nonNegative(value, 0, name)
}

const positive = (value: number, name: string): number => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a finite positive number, received ${value}`)
  }
  return value
}

const alignment = (value: LayoutAlignment | undefined, name: string): LayoutAlignment => {
  const resolved = value ?? 'flex-start'
  if (resolved !== 'flex-start' && resolved !== 'center' && resolved !== 'flex-end') {
    throw new Error(`${name} must be "flex-start", "center", or "flex-end"`)
  }
  return resolved
}

const justification = (value: LayoutJustification | undefined): LayoutJustification => {
  const resolved = value ?? 'flex-start'
  if (
    resolved !== 'flex-start' &&
    resolved !== 'center' &&
    resolved !== 'flex-end' &&
    resolved !== 'space-between' &&
    resolved !== 'space-around' &&
    resolved !== 'space-evenly'
  ) {
    throw new Error(`Unknown justifyContent value ${String(resolved)}`)
  }
  return resolved
}

const boundsVersion = (visual: MeasurableVisual): number => {
  const value = visual.userData.boundsVersion
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

const measure = (record: ItemRecord): MeasuredItem => {
  const bounds = record.visual.getLocalBounds()
  const values = [...bounds.min.toArray(), ...bounds.max.toArray()]
  if (bounds.isEmpty() || !values.every(Number.isFinite)) {
    throw new Error('Layout items must report finite, non-empty local bounds')
  }
  const size = bounds.getSize(new THREE.Vector2())
  return { ...record, bounds, width: size.x, height: size.y }
}

const visualName = (visual: THREE.Object3D): string =>
  visual.name.trim() || String(visual.userData.definedMotionVisual ?? 'unnamed visual')

const assertFits = (
  root: THREE.Object3D,
  axis: 'width' | 'height',
  required: number,
  available: number | undefined,
  child?: MeasuredItem
): void => {
  if (available === undefined || required <= available + 1e-9) return
  const childDescription = child ? ` Child "${visualName(child.visual)}" determines this size.` : ''
  throw new SceneRuntimeError(
    'LAYOUT_OVERFLOW',
    `Layout "${visualName(root)}" overflows ${axis}: required ${required}, available ${available}.${childDescription}`
  )
}

const largestItem = (
  items: readonly MeasuredItem[],
  axis: 'width' | 'height'
): MeasuredItem | undefined =>
  items.reduce<MeasuredItem | undefined>(
    (largest, item) => (!largest || item[axis] > largest[axis] ? item : largest),
    undefined
  )

const individuallyOverflowingItem = (
  items: readonly MeasuredItem[],
  axis: 'width' | 'height',
  padding: number,
  available: number | undefined
): MeasuredItem | undefined => {
  if (available === undefined) return undefined
  return items.find((item) => item[axis] + padding * 2 > available + 1e-9)
}

const createUnitPlane = (
  name: string,
  color: THREE.ColorRepresentation
): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> => {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
  )
  mesh.name = name
  return mesh
}

const placePlane = (
  mesh: THREE.Mesh,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  z = 0
): void => {
  mesh.visible = width > 0 && height > 0
  mesh.position.set(centerX, centerY, z)
  mesh.scale.set(width, height, 1)
}

const createLayoutSurface = (
  root: THREE.Group,
  options: Pick<LayoutBoxOptions, 'background' | 'border'>
): LayoutSurfaceController | undefined => {
  if (options.background === undefined && options.border === undefined) return undefined

  const surface = new THREE.Group()
  surface.name = 'DefinedMotionLayoutSurface'
  surface.userData.definedMotionLayoutSurface = true
  surface.position.z = -0.002
  const background =
    options.background === undefined
      ? undefined
      : createUnitPlane('DefinedMotionLayoutBackground', options.background)
  if (background) surface.add(background)

  const borderWidth = options.border ? positive(options.border.width, 'border.width') : undefined
  const border = options.border
    ? Array.from({ length: 4 }, (_, index) =>
        createUnitPlane(`DefinedMotionLayoutBorder${index + 1}`, options.border!.color)
      )
    : []
  if (border.length > 0) surface.add(...border)
  root.add(surface)

  return {
    update(bounds) {
      const center = bounds.getCenter(new THREE.Vector2())
      const size = bounds.getSize(new THREE.Vector2())
      if (background) placePlane(background, center.x, center.y, size.x, size.y)
      if (borderWidth === undefined) return
      const thickness = Math.min(borderWidth, size.x / 2, size.y / 2)
      placePlane(border[0], center.x, bounds.max.y - thickness / 2, size.x, thickness, 0.001)
      placePlane(border[1], center.x, bounds.min.y + thickness / 2, size.x, thickness, 0.001)
      placePlane(border[2], bounds.min.x + thickness / 2, center.y, thickness, size.y, 0.001)
      placePlane(border[3], bounds.max.x - thickness / 2, center.y, thickness, size.y, 0.001)
    }
  }
}

const boxBounds = (
  width: number,
  height: number,
  anchorX: AnchorX,
  anchorY: AnchorY
): THREE.Box2 => {
  const minX = anchorX === 'left' ? 0 : anchorX === 'right' ? -width : -width / 2
  const maxY = anchorY === 'top' ? 0 : anchorY === 'bottom' ? height : height / 2
  return new THREE.Box2(
    new THREE.Vector2(minX, maxY - height),
    new THREE.Vector2(minX + width, maxY)
  )
}

const alignedStart = (
  available: number,
  itemSize: number,
  alignmentValue: LayoutAlignment
): number => {
  const extra = Math.max(0, available - itemSize)
  return alignmentValue === 'center' ? extra / 2 : alignmentValue === 'flex-end' ? extra : 0
}

const justifyDistribution = (
  freeSpace: number,
  itemCount: number,
  value: LayoutJustification
): { leading: number; between: number } => {
  const free = Math.max(0, freeSpace)
  if (value === 'center') return { leading: free / 2, between: 0 }
  if (value === 'flex-end') return { leading: free, between: 0 }
  if (value === 'space-between' && itemCount > 1) {
    return { leading: 0, between: free / (itemCount - 1) }
  }
  if (value === 'space-around' && itemCount > 0) {
    return { leading: free / itemCount / 2, between: free / itemCount }
  }
  if (value === 'space-evenly' && itemCount > 0) {
    const spacing = free / (itemCount + 1)
    return { leading: spacing, between: spacing }
  }
  return { leading: 0, between: 0 }
}

const assertUnparented = (visual: MeasurableVisual): void => {
  if (visual.parent) {
    throw new Error('A visual must be unparented before it is added to a layout')
  }
  if (typeof visual.getLocalBounds !== 'function') {
    throw new Error('Layout items must implement getLocalBounds()')
  }
}

const createLayout = (
  initialItems: readonly MeasurableVisual[],
  reflow: (items: readonly MeasuredItem[], root: THREE.Object3D) => THREE.Box2,
  surfaceOptions: Pick<LayoutBoxOptions, 'background' | 'border'>
): InternalLayoutVisual => {
  const root = new THREE.Group() as InternalLayoutVisual
  root.name = 'DefinedMotionLayout'
  root.userData.definedMotionVisual = 'layout'
  const surface = createLayoutSurface(root, surfaceOptions)
  const records: ItemRecord[] = []
  let initialRecordCount = 0
  let localBounds = new THREE.Box2(new THREE.Vector2(), new THREE.Vector2())
  let dirty = true

  const addRecord = (visual: MeasurableVisual): void => {
    if (records.some((record) => record.visual === visual)) {
      throw new Error('A visual cannot be added to the same layout more than once')
    }
    assertUnparented(visual)
    const initialBounds = visual.getLocalBounds()
    if (
      initialBounds.isEmpty() ||
      ![...initialBounds.min.toArray(), ...initialBounds.max.toArray()].every(Number.isFinite)
    ) {
      throw new Error('Layout items must report finite, non-empty local bounds')
    }
    const slot = new THREE.Group()
    slot.name = 'DefinedMotionLayoutSlot'
    slot.add(visual)
    root.add(slot)
    records.push({ visual, slot, observedBoundsVersion: boundsVersion(visual) })
    dirty = true
  }

  const resolve = (force = false): void => {
    for (const record of records) record.visual.getLocalBounds()
    if (records.some((record) => record.observedBoundsVersion !== boundsVersion(record.visual))) {
      dirty = true
    }
    if (!dirty && !force) return
    localBounds = reflow(records.map(measure), root)
    surface?.update(localBounds)
    for (const record of records) {
      record.observedBoundsVersion = boundsVersion(record.visual)
    }
    dirty = false
    root.userData.boundsVersion = (root.userData.boundsVersion ?? 0) + 1
  }

  const reset = (): void => {
    const appended = records.splice(initialRecordCount)
    for (const record of appended) {
      record.slot.remove(record.visual)
      root.remove(record.slot)
    }
    dirty = true
    resolve(true)
  }

  Object.defineProperty(root, 'items', {
    enumerable: true,
    get: () => Object.freeze(records.map(({ visual }) => visual))
  })
  root.getLocalBounds = () => {
    resolve()
    return localBounds.clone()
  }
  root.append = (visual) => {
    addRecord(visual)
    resolve(true)
  }
  root[LAYOUT_CONTROLLER] = { resolve, reset }

  for (const item of initialItems) addRecord(item)
  initialRecordCount = records.length
  resolve(true)
  return root
}

const flex = (options: FlexOptions, items: readonly MeasurableVisual[] = []): LayoutVisual => {
  if (typeof options !== 'object' || options === null) {
    throw new Error('layout.flex() requires an options object')
  }
  if (options.flexDirection !== 'row' && options.flexDirection !== 'column') {
    throw new Error('flexDirection must be "row" or "column"')
  }
  const direction = options.flexDirection
  const gap = nonNegative(options.gap, 0, 'gap')
  const padding = nonNegative(options.padding, 0, 'padding')
  const explicitWidth = optionalSize(options.width, 'width')
  const explicitHeight = optionalSize(options.height, 'height')
  const align = alignment(options.alignItems, 'alignItems')
  const justify = justification(options.justifyContent)
  const anchorX = resolveAnchorX(options.anchorX)
  const anchorY = resolveAnchorY(options.anchorY)

  return createLayout(
    items,
    (measured, root) => {
      const row = direction === 'row'
      const naturalMain =
        measured.reduce((sum, item) => sum + (row ? item.width : item.height), 0) +
        Math.max(0, measured.length - 1) * gap
      const naturalCross = measured.reduce(
        (largest, item) => Math.max(largest, row ? item.height : item.width),
        0
      )
      const width = explicitWidth ?? (row ? naturalMain : naturalCross) + padding * 2
      const height = explicitHeight ?? (row ? naturalCross : naturalMain) + padding * 2
      const requiredWidth = (row ? naturalMain : naturalCross) + padding * 2
      const requiredHeight = (row ? naturalCross : naturalMain) + padding * 2
      assertFits(
        root,
        'width',
        requiredWidth,
        explicitWidth,
        row
          ? individuallyOverflowingItem(measured, 'width', padding, explicitWidth)
          : largestItem(measured, 'width')
      )
      assertFits(
        root,
        'height',
        requiredHeight,
        explicitHeight,
        row
          ? largestItem(measured, 'height')
          : individuallyOverflowingItem(measured, 'height', padding, explicitHeight)
      )
      const bounds = boxBounds(width, height, anchorX, anchorY)
      const contentWidth = Math.max(0, width - padding * 2)
      const contentHeight = Math.max(0, height - padding * 2)
      const availableMain = row ? contentWidth : contentHeight
      const distribution = justifyDistribution(
        availableMain - naturalMain,
        measured.length,
        justify
      )
      let cursor = distribution.leading

      for (const item of measured) {
        if (row) {
          const itemLeft = bounds.min.x + padding + cursor
          const itemTop = bounds.max.y - padding - alignedStart(contentHeight, item.height, align)
          item.slot.position.set(itemLeft - item.bounds.min.x, itemTop - item.bounds.max.y, 0)
          cursor += item.width + gap + distribution.between
        } else {
          const itemLeft = bounds.min.x + padding + alignedStart(contentWidth, item.width, align)
          const itemTop = bounds.max.y - padding - cursor
          item.slot.position.set(itemLeft - item.bounds.min.x, itemTop - item.bounds.max.y, 0)
          cursor += item.height + gap + distribution.between
        }
      }
      return bounds
    },
    options
  )
}

const grid = (options: GridOptions, items: readonly MeasurableVisual[] = []): LayoutVisual => {
  if (typeof options !== 'object' || options === null) {
    throw new Error('layout.grid() requires an options object')
  }
  if (!Number.isInteger(options.columns) || options.columns <= 0) {
    throw new Error(`columns must be a positive integer, received ${options.columns}`)
  }
  const columns = options.columns
  const columnGap = nonNegative(options.columnGap, 0, 'columnGap')
  const rowGap = nonNegative(options.rowGap, 0, 'rowGap')
  const padding = nonNegative(options.padding, 0, 'padding')
  const explicitWidth = optionalSize(options.width, 'width')
  const explicitHeight = optionalSize(options.height, 'height')
  const align = alignment(options.alignItems, 'alignItems')
  const justify = alignment(options.justifyItems, 'justifyItems')
  const anchorX = resolveAnchorX(options.anchorX)
  const anchorY = resolveAnchorY(options.anchorY)

  return createLayout(
    items,
    (measured, root) => {
      const rows = Math.ceil(measured.length / columns)
      const columnWidths = Array.from({ length: columns }, () => 0)
      const rowHeights = Array.from({ length: rows }, () => 0)
      measured.forEach((item, index) => {
        const column = index % columns
        const row = Math.floor(index / columns)
        columnWidths[column] = Math.max(columnWidths[column], item.width)
        rowHeights[row] = Math.max(rowHeights[row], item.height)
      })
      const naturalWidth =
        columnWidths.reduce((sum, value) => sum + value, 0) + Math.max(0, columns - 1) * columnGap
      const naturalHeight =
        rowHeights.reduce((sum, value) => sum + value, 0) + Math.max(0, rows - 1) * rowGap
      const width = explicitWidth ?? naturalWidth + padding * 2
      const height = explicitHeight ?? naturalHeight + padding * 2
      const requiredWidth = naturalWidth + padding * 2
      const requiredHeight = naturalHeight + padding * 2
      assertFits(
        root,
        'width',
        requiredWidth,
        explicitWidth,
        columns === 1
          ? largestItem(measured, 'width')
          : individuallyOverflowingItem(measured, 'width', padding, explicitWidth)
      )
      assertFits(
        root,
        'height',
        requiredHeight,
        explicitHeight,
        rows <= 1
          ? largestItem(measured, 'height')
          : individuallyOverflowingItem(measured, 'height', padding, explicitHeight)
      )
      const bounds = boxBounds(width, height, anchorX, anchorY)
      const columnStarts: number[] = []
      const rowStarts: number[] = []
      let cursor = bounds.min.x + padding
      for (const columnWidth of columnWidths) {
        columnStarts.push(cursor)
        cursor += columnWidth + columnGap
      }
      cursor = bounds.max.y - padding
      for (const rowHeight of rowHeights) {
        rowStarts.push(cursor)
        cursor -= rowHeight + rowGap
      }
      measured.forEach((item, index) => {
        const column = index % columns
        const row = Math.floor(index / columns)
        const itemLeft =
          columnStarts[column] + alignedStart(columnWidths[column], item.width, justify)
        const itemTop = rowStarts[row] - alignedStart(rowHeights[row], item.height, align)
        item.slot.position.set(itemLeft - item.bounds.min.x, itemTop - item.bounds.max.y, 0)
      })
      return bounds
    },
    options
  )
}

export const resolveSceneLayouts = (scene: THREE.Object3D): void => {
  const visit = (object: THREE.Object3D): void => {
    for (const child of object.children) visit(child)
    const controller = (object as Partial<InternalLayoutVisual>)[LAYOUT_CONTROLLER]
    controller?.resolve()
  }
  visit(scene)
}

export const resetSceneLayouts = (scene: THREE.Object3D): void => {
  const visit = (object: THREE.Object3D): void => {
    for (const child of [...object.children]) visit(child)
    const controller = (object as Partial<InternalLayoutVisual>)[LAYOUT_CONTROLLER]
    controller?.reset()
  }
  visit(scene)
}

export const layout = Object.freeze({ flex, grid })
