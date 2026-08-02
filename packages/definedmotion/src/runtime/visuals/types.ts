import type * as THREE from 'three'
import type { AssetSource } from '../assets'

export type AnchorX = 'left' | 'center' | 'right'
export type AnchorY = 'top' | 'middle' | 'bottom'
export type TextAlign = 'left' | 'center' | 'right'

export interface TextOptions {
  text: string
  fontSize: number
  color?: THREE.ColorRepresentation
  opacity?: number
  font?: AssetSource
  textAlign?: TextAlign
  anchorX?: AnchorX
  anchorY?: AnchorY
  maxWidth?: number
  lineHeight?: number
  outlineColor?: THREE.ColorRepresentation
  outlineWidth?: number
}

export interface LatexOptions {
  latex: string
  fontSize: number
  color?: THREE.ColorRepresentation
  opacity?: number
  anchorX?: AnchorX
  anchorY?: AnchorY
}

export type MeasurableVisual<Visual extends THREE.Object3D = THREE.Object3D> = Visual & {
  getLocalBounds(): THREE.Box2
}

export type TextVisual = MeasurableVisual<THREE.Group> & {
  readonly text: string
  setText(text: string): Promise<void>
}

export interface LatexPart {
  readonly visual: LatexVisual
  readonly id: string
}

export type LatexVisual = MeasurableVisual<THREE.Group> & {
  readonly latex: string
  setLatex(latex: string): Promise<void>
  part(id: string): LatexPart
}
