import * as THREE from 'three'
import { Text, configureTextBuilder } from 'troika-three-text'
import { assetUrl, createAssetReference } from '../assets'
import { resolveAnchorX, resolveAnchorY } from './measurement'
import type { TextAlign, TextOptions, TextVisual } from './types'

const defaultFont = createAssetReference('fonts/Montserrat-Medium.woff', 'package').url
let textBuilderConfigured = false

const configureBuilder = (): void => {
  if (textBuilderConfigured) return
  configureTextBuilder({ useWorker: false })
  textBuilderConfigured = true
}

const positive = (value: number, name: string): number => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a finite positive number, received ${value}`)
  }
  return value
}

const nonNegative = (value: number, name: string): number => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a finite non-negative number, received ${value}`)
  }
  return value
}

const unitInterval = (value: number, name: string): number => {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be a finite number from 0 to 1, received ${value}`)
  }
  return value
}

const resolveTextAlign = (alignment: TextAlign | undefined): TextAlign => {
  const resolved = alignment ?? 'center'
  if (resolved !== 'left' && resolved !== 'center' && resolved !== 'right') {
    throw new Error(`textAlign must be "left", "center", or "right", received ${String(resolved)}`)
  }
  return resolved
}

const syncText = (text: Text): Promise<void> =>
  new Promise((resolve, reject) => {
    try {
      text.sync(resolve)
    } catch (error) {
      reject(error)
    }
  })

export const createText = async (options: TextOptions): Promise<TextVisual> => {
  if (typeof options !== 'object' || options === null) {
    throw new Error('createText() requires an options object')
  }
  if (typeof options.text !== 'string') throw new Error('Text content must be a string')
  const fontSize = positive(options.fontSize, 'fontSize')
  const opacity = unitInterval(options.opacity ?? 1, 'opacity')
  const maxWidth =
    options.maxWidth === undefined
      ? Number.POSITIVE_INFINITY
      : positive(options.maxWidth, 'maxWidth')
  const lineHeight =
    options.lineHeight === undefined ? 'normal' : positive(options.lineHeight, 'lineHeight')
  const outlineWidth = nonNegative(options.outlineWidth ?? 0, 'outlineWidth')
  const anchorX = resolveAnchorX(options.anchorX)
  const anchorY = resolveAnchorY(options.anchorY)
  const textAlign = resolveTextAlign(options.textAlign)

  configureBuilder()
  const root = new THREE.Group() as TextVisual
  root.name = 'DefinedMotionText'
  root.userData.definedMotionVisual = 'text'
  const textMesh = new Text()
  const font = options.font ? assetUrl(options.font) : defaultFont
  if (options.font) {
    const response = await fetch(font)
    if (!response.ok) {
      throw new Error(`Could not load text font: ${response.status} ${response.statusText}`)
    }
  }
  textMesh.font = font
  textMesh.fontSize = fontSize
  textMesh.color = options.color ?? 0xffffff
  textMesh.textAlign = textAlign
  textMesh.anchorX = anchorX
  textMesh.anchorY = anchorY
  textMesh.maxWidth = maxWidth
  textMesh.lineHeight = lineHeight
  textMesh.outlineColor = options.outlineColor ?? 0x000000
  textMesh.outlineWidth = outlineWidth
  root.add(textMesh)

  let currentText = ''
  let localBounds = new THREE.Box2()
  let updateQueue = Promise.resolve()

  const applyText = async (value: string): Promise<void> => {
    if (typeof value !== 'string') throw new Error('Text content must be a string')
    textMesh.text = value
    await syncText(textMesh)
    const blockBounds = (
      textMesh as Text & {
        textRenderInfo?: { blockBounds?: number[] }
      }
    ).textRenderInfo?.blockBounds
    if (!blockBounds || blockBounds.length !== 4 || !blockBounds.every(Number.isFinite)) {
      throw new Error('Text shaping completed without finite local bounds')
    }
    const material = textMesh.material
    for (const current of Array.isArray(material) ? material : [material]) {
      current.opacity = opacity
      if (opacity < 1) current.transparent = true
    }
    localBounds = new THREE.Box2(
      new THREE.Vector2(blockBounds[0], blockBounds[1]),
      new THREE.Vector2(blockBounds[2], blockBounds[3])
    ).expandByScalar(outlineWidth)
    currentText = value
    root.userData.boundsVersion = (root.userData.boundsVersion ?? 0) + 1
  }

  Object.defineProperty(root, 'text', {
    enumerable: true,
    get: () => currentText
  })
  root.getLocalBounds = () => localBounds.clone()
  root.setText = (value: string) => {
    const update = updateQueue.then(() => applyText(value))
    updateQueue = update.catch(() => {})
    return update
  }

  await root.setText(options.text)
  return root
}

export type {
  AnchorX,
  AnchorY,
  MeasurableVisual,
  TextAlign,
  TextOptions,
  TextVisual
} from './types'
