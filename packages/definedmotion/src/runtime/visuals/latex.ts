import * as THREE from 'three'
import { latexToSVG } from '../svg/latexToSVG'
import { createSVGShape } from '../svg/svgRendering'
import {
  LATEX_VISUAL_CONTROLLER,
  type ControlledLatexVisual,
  type PreparedLatex
} from './latexInternal'
import { anchorOffset, getObjectLocalBounds, resolveAnchorX, resolveAnchorY } from './measurement'
import type { LatexOptions, LatexPart, LatexVisual } from './types'

interface MaterialAppearance {
  readonly opacity: number
  readonly transparent: boolean
}

const positive = (value: number, name: string): number => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a finite positive number, received ${value}`)
  }
  return value
}

const svgTargetWidth = (svg: string, fontSize: number): number => {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml')
  if (document.querySelector('parsererror')) throw new Error('LaTeX produced invalid SVG')
  const viewBox = document.documentElement
    .getAttribute('viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number)
  if (
    !viewBox ||
    viewBox.length !== 4 ||
    !viewBox.every(Number.isFinite) ||
    viewBox[2] <= 0 ||
    viewBox[3] <= 0
  ) {
    throw new Error('LaTeX SVG did not provide finite positive bounds')
  }
  // MathJax SVG viewBox coordinates use 1000 font units per em.
  return (viewBox[2] / 1000) * fontSize
}

const materialsIn = (object: THREE.Object3D): THREE.Material[] => {
  const materials: THREE.Material[] = []
  const seen = new Set<THREE.Material>()
  object.traverse((child) => {
    const material = (
      child as THREE.Object3D & {
        material?: THREE.Material | THREE.Material[]
      }
    ).material
    for (const current of Array.isArray(material) ? material : material ? [material] : []) {
      if (!seen.has(current)) {
        seen.add(current)
        materials.push(current)
      }
    }
  })
  return materials
}

const disposeObject = (object: THREE.Object3D): void => {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  object.traverse((child) => {
    const renderable = child as THREE.Object3D & {
      geometry?: THREE.BufferGeometry
      material?: THREE.Material | THREE.Material[]
    }
    if (renderable.geometry) geometries.add(renderable.geometry)
    const childMaterials = Array.isArray(renderable.material)
      ? renderable.material
      : renderable.material
        ? [renderable.material]
        : []
    for (const material of childMaterials) materials.add(material)
  })
  for (const geometry of geometries) geometry.dispose()
  for (const material of materials) material.dispose()
}

export const createLatex = async (options: LatexOptions): Promise<LatexVisual> => {
  if (typeof options !== 'object' || options === null) {
    throw new Error('createLatex() requires an options object')
  }
  if (typeof options.latex !== 'string' || options.latex.trim() === '') {
    throw new Error('LaTeX content must be a non-empty string')
  }
  const fontSize = positive(options.fontSize, 'fontSize')
  const anchorX = resolveAnchorX(options.anchorX)
  const anchorY = resolveAnchorY(options.anchorY)
  const color = new THREE.Color(options.color ?? 0xffffff)

  const root = new THREE.Group() as ControlledLatexVisual
  root.name = 'DefinedMotionLatex'
  root.userData.definedMotionVisual = 'latex'
  root.userData.definedMotionLatexFontSize = fontSize
  let currentLatex = ''
  let localBounds = new THREE.Box2()
  let updateQueue = Promise.resolve()

  let activeContent: THREE.Group | undefined

  const render = (latex: string): PreparedLatex => {
    if (typeof latex !== 'string' || latex.trim() === '') {
      throw new Error('LaTeX content must be a non-empty string')
    }
    const svg = latexToSVG(latex)
    if (svg.includes('data-mml-node="merror"')) {
      throw new Error(`Unsupported LaTeX expression: ${latex}`)
    }
    const content = createSVGShape(svg, svgTargetWidth(svg, fontSize))
    for (const material of materialsIn(content)) {
      const colorMaterial = material as THREE.Material & { color?: THREE.Color }
      colorMaterial.color?.copy(color)
    }
    const bounds = getObjectLocalBounds(content)
    if (!bounds || !bounds.min.toArray().concat(bounds.max.toArray()).every(Number.isFinite)) {
      disposeObject(content)
      throw new Error('LaTeX rendering completed without finite local bounds')
    }
    const offset = anchorOffset(bounds, anchorX, anchorY)
    content.position.x += offset.x
    content.position.y += offset.y
    bounds.translate(offset)
    return { latex, content, bounds }
  }

  const stage = (prepared: PreparedLatex): void => {
    if (prepared.content.parent && prepared.content.parent !== root) {
      throw new Error('Prepared LaTeX content has already been attached to another object')
    }
    if (!prepared.content.parent) root.add(prepared.content)
  }

  const complete = (prepared: PreparedLatex): void => {
    stage(prepared)
    for (const child of [...root.children]) {
      if (child === prepared.content) continue
      root.remove(child)
      disposeObject(child)
    }
    activeContent = prepared.content
    localBounds = prepared.bounds.clone()
    currentLatex = prepared.latex
    root.userData.boundsVersion = (root.userData.boundsVersion ?? 0) + 1
  }

  const applyLatex = async (latex: string): Promise<void> => {
    const previousMaterials = materialsIn(root)
    const appearance: MaterialAppearance | undefined = previousMaterials[0]
      ? {
          opacity: previousMaterials[0].opacity,
          transparent: previousMaterials[0].transparent
        }
      : undefined
    const rendered = render(latex)
    if (appearance) {
      for (const material of materialsIn(rendered.content)) {
        material.opacity = appearance.opacity
        material.transparent = appearance.transparent
      }
    }
    complete(rendered)
  }

  Object.defineProperty(root, 'latex', {
    enumerable: true,
    get: () => currentLatex
  })
  root.getLocalBounds = () => localBounds.clone()
  root.setLatex = (latex: string) => {
    const update = updateQueue.then(() => applyLatex(latex))
    updateQueue = update.catch(() => {})
    return update
  }
  root.part = (id: string): LatexPart => {
    if (typeof id !== 'string' || id.trim() === '' || id !== id.trim()) {
      throw new Error('LaTeX part IDs must be non-empty strings without surrounding whitespace')
    }
    return Object.freeze({ visual: root, id })
  }
  root[LATEX_VISUAL_CONTROLLER] = {
    prepare: render,
    currentContent() {
      if (!activeContent) throw new Error('LaTeX visual content is not ready')
      return activeContent
    },
    stage,
    setTransitionBounds(bounds) {
      localBounds.copy(bounds)
      root.userData.boundsVersion = (root.userData.boundsVersion ?? 0) + 1
    },
    complete,
    discard(prepared) {
      if (prepared.content === activeContent) {
        throw new Error('Cannot discard the active LaTeX content')
      }
      prepared.content.removeFromParent()
      disposeObject(prepared.content)
    }
  }

  await root.setLatex(options.latex)
  return root
}

export type {
  AnchorX,
  AnchorY,
  LatexOptions,
  LatexPart,
  LatexVisual,
  MeasurableVisual
} from './types'
