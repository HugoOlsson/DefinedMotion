import type * as THREE from 'three'
import type { LatexVisual } from './types'

export interface PreparedLatex {
  readonly latex: string
  readonly content: THREE.Group
  readonly bounds: THREE.Box2
}

export interface LatexVisualController {
  prepare(latex: string): PreparedLatex
  currentContent(): THREE.Group
  stage(prepared: PreparedLatex): void
  complete(prepared: PreparedLatex): void
  discard(prepared: PreparedLatex): void
}

export const LATEX_VISUAL_CONTROLLER = Symbol('DefinedMotionLatexVisualController')

export type ControlledLatexVisual = LatexVisual & {
  [LATEX_VISUAL_CONTROLLER]: LatexVisualController
}

export const latexVisualController = (visual: LatexVisual): LatexVisualController => {
  const controller = (visual as Partial<ControlledLatexVisual>)[LATEX_VISUAL_CONTROLLER]
  if (!controller) {
    throw new Error('LaTeX effects require a LatexVisual created by createLatex()')
  }
  return controller
}
