import { parse, RootNode, Node, ElementNode } from 'svg-parser'
import { Command, parseSVG as parseSVGPath } from 'svg-path-parser'

import {
  fromObject,
  applyToPoint,
  compose,
  Matrix,
  translate,
  scale,
  rotate,
  skew,
  transform,
  identity
} from 'transformation-matrix'

export const parseSVGString = (svg: string) => {
  return parse(svg)
}

export interface VectorizedElementNode {
  type: 'element'
  tagName?: string | undefined
  properties?: Record<string, string | number> | undefined
  children: Array<VectorizedElementNode | string>
  value?: string | undefined
  metadata?: string | undefined
  points: [number, number][]
  subpathIndices: number[]
  isClosed: boolean
}

export function isApproximatelyEqual2D(
  a: [number, number],
  b: [number, number],
  tolerance = 1e-6
): boolean {
  return Math.abs(a[0] - b[0]) < tolerance && Math.abs(a[1] - b[1]) < tolerance
}

export function isApproximatelyEqual2d3d(
  a: [number, number, number],
  b: [number, number, number],
  tolerance = 1e-6
): boolean {
  return Math.abs(a[0] - b[0]) < tolerance && Math.abs(a[1] - b[1]) < tolerance
}

// Placeholder function for points conversion
function generatePoints(
  node: ElementNode,
  idMap: Map<string, ElementNode>
): {
  points: [number, number][]
  subpathIndices: number[]
} {
  const tag = node.tagName.toLowerCase()
  const props = node.properties as any

  switch (tag) {
    case 'line': {
      const x1 = props.x1
      const y1 = props.y1
      const x2 = props.x2
      const y2 = props.y2
      return {
        points: [
          [x1, y1],
          [x2, y2]
        ],
        subpathIndices: []
      }
    }

    case 'polyline':
    case 'polygon': {
      const raw = props.points // e.g. "10,20 30,40 50,60"
      const coords = raw
        .trim()
        .split(/[\s,]+/)
        .map(Number) // [10, 20, 30, 40, 50, 60]
      const points: [number, number][] = []
      for (let i = 0; i < coords.length - 1; i += 2) {
        points.push([coords[i], coords[i + 1]])
      }
      if (tag === 'polygon' && points.length > 0) {
        points.push([...points[0]]) // Close the polygon
      }
      return { points, subpathIndices: [] }
    }

    case 'rect': {
      const x = props.x
      const y = props.y
      const width = props.width
      const height = props.height
      const rx = props.rx || 0
      const ry = props.ry || 0

      if (rx === 0 && ry === 0) {
        // Plain rectangle
        return {
          points: [
            [x, y],
            [x + width, y],
            [x + width, y + height],
            [x, y + height],
            [x, y]
          ],
          subpathIndices: []
        }
      } else {
        // Optional: approximate rounded rectangle
        // You could add arc samples at each corner here
        console.warn('Rounded rect approximation not implemented')
        return { points: [], subpathIndices: [] }
      }
    }

    case 'circle': {
      const cx = props.cx
      const cy = props.cy
      const r = props.r
      const samples = 32
      return {
        points: Array.from({ length: samples + 1 }, (_, i) => {
          const theta = (2 * Math.PI * i) / samples
          return [cx + r * Math.cos(theta), cy + r * Math.sin(theta)]
        }),
        subpathIndices: []
      }
    }

    case 'ellipse': {
      const cx = props.cx
      const cy = props.cy
      const rx = props.rx
      const ry = props.ry
      const samples = 32
      return {
        points: Array.from({ length: samples + 1 }, (_, i) => {
          const theta = (2 * Math.PI * i) / samples
          return [cx + rx * Math.cos(theta), cy + ry * Math.sin(theta)]
        }),
        subpathIndices: []
      }
    }

    case 'path': {
      const d = props.d
      const pointsObject = pathToPoints(parseSVGPath(d)) // Your earlier logic

      return pointsObject
    }

    default:
      //console.warn(`Unsupported SVG tag: <${tag}>`)
      return { points: [], subpathIndices: [] }
  }
}

export function vectorizeSVGStructure(root: RootNode) {
  const idMap = new Map<string, ElementNode>()

  function buildIdMap(node: Node) {
    if (typeof node === 'string' || node.type === 'text') return
    if (node.properties?.id) {
      idMap.set(node.properties.id as string, node)
    }
    for (const child of node.children) {
      buildIdMap(child as Node)
    }
  }
  buildIdMap(root as any)

  function transformNode(
    node: Node | string,
    parentMatrix: Matrix,
    parentStyles: Record<string, string | number> = {}
  ): VectorizedElementNode | undefined {
    if (typeof node === 'string' || node.type === 'text') return undefined

    // Skip elements inside <defs> (they'll only be used via references)
    if ((node as ElementNode).tagName?.toLowerCase() === 'defs') return undefined

    const copyParentStyles = { ...parentStyles }
    removeTransforms(copyParentStyles)

    const props = node.properties ?? {}
    const tag = (node as ElementNode).tagName?.toLowerCase()

    //Link content to "use" elements
    if (tag === 'use') {
      const href: string = (props['xlink:href'] as string) || (props.href as string)
      if (!href) return undefined

      const id = href.startsWith('#') ? href.slice(1) : href
      const referenced = idMap.get(id)
      if (!referenced) return undefined

      // Clone the defined element since the same definition can be used in multiple places and we don't want to affect the source
      const clonedDef: ElementNode = {
        ...referenced,
        properties: {
          ...referenced.properties, // Base styles from symbol
          ...parentStyles, // Inherited from parent
          ...props, // <use> overrides
          // Explicitly remove processed attributes
          transform: undefined,
          x: undefined,
          y: undefined
        }
      }

      // Apply <use> transforms (x/y and transform attribute)
      const x = (props.x as number) || 0
      const y = (props.y as number) || 0
      const useTransforms = parseSVGTransform((props.transform as string) || '')
      if (x || y) useTransforms.push({ type: 'translate', params: { tx: x, ty: y } })

      const useMatrix = compose(parentMatrix, applyTransforms(useTransforms))

      // Process referenced element with combined transforms
      const referencedNode = transformNode(clonedDef, useMatrix)
      if (!referencedNode) return undefined

      return {
        ...clonedDef,
        points: referencedNode.points,
        subpathIndices: referencedNode.subpathIndices,
        isClosed: referencedNode.isClosed,
        children: [referencedNode]
      }
    }
    const effectiveProps = { ...parentStyles, ...node.properties }
    const transformStr = typeof props.transform === 'string' ? props.transform : ''
    const localTransforms = parseSVGTransform(transformStr)
    const localMatrix = applyTransforms(localTransforms)

    // Combine parent and local transform
    const combinedMatrix = compose(parentMatrix, localMatrix)

    // Apply transform to points
    const rawPoints = generatePoints(node as ElementNode, idMap)
    const transformedPoints: [number, number][] = rawPoints.points.map(([x, y]) => {
      const { x: tx, y: ty } = applyToPoint(combinedMatrix, { x, y })
      return [tx, ty]
    })

    const vectorizedNode: VectorizedElementNode = {
      ...node,
      properties: effectiveProps,
      points: transformedPoints,
      subpathIndices: rawPoints.subpathIndices,
      isClosed:
        transformedPoints.length === 0
          ? false
          : isApproximatelyEqual2D(
              transformedPoints[0],
              transformedPoints[transformedPoints.length - 1]
            )
    }

    // Recursively transform children
    const transformedChildren: VectorizedElementNode[] = []
    for (const child of node.children) {
      const transformedChild = transformNode(child, combinedMatrix, effectiveProps)
      if (transformedChild) transformedChildren.push(transformedChild)
    }
    vectorizedNode.children = transformedChildren

    return vectorizedNode
  }
  const result: VectorizedElementNode[] = []

  for (const child of root.children) {
    const topNode = transformNode(child, identity(), {})
    if (topNode) result.push(topNode)
  }

  return result
}

function removeTransforms(properties: any) {
  delete properties.transform
  delete properties.x
  delete properties.y
  return properties
}

function parseSVGTransform(string: string) {
  const transforms: Array<{
    type: 'translate' | 'matrix' | 'rotate' | 'skewX' | 'skewY' | 'scale'
    params: Record<string, number>
  }> = []

  const matches = string.match(/(translate|matrix|rotate|skewX|skewY|scale)\([^)]*\)/g)

  if (matches) {
    for (const match of matches) {
      const [type, values] = match.split('(')
      const params = values
        .replace(')', '')
        .split(/[, \t\n]+/)
        .map(parseFloat)

      switch (type as any) {
        case 'translate':
          transforms.push({
            type: 'translate',
            params: {
              tx: params[0] || 0,
              ty: params[1] || 0
            }
          })
          break

        case 'scale':
          transforms.push({
            type: 'scale',
            params: {
              sx: params[0] || 1,
              sy: params[1] || params[0] || 1
            }
          })
          break

        case 'rotate':
          transforms.push({
            type: 'rotate',
            params: {
              angle: params[0] || 0,
              cx: params[1] || 0,
              cy: params[2] || 0
            }
          })
          break

        case 'skewX':
          transforms.push({
            type: 'skewX',
            params: { angle: params[0] || 0 }
          })
          break

        case 'skewY':
          transforms.push({
            type: 'skewY',
            params: { angle: params[0] || 0 }
          })
          break

        case 'matrix':
          transforms.push({
            type: 'matrix',
            params: {
              a: params[0] || 0,
              b: params[1] || 0,
              c: params[2] || 0,
              d: params[3] || 0,
              e: params[4] || 0,
              f: params[5] || 0
            }
          })
          break
      }
    }
  }

  return transforms
}

function applyTransforms(transforms) {
  if (transforms.length === 0) return identity()
  return compose(
    ...transforms.map((t) => {
      switch (t.type) {
        case 'translate':
          return translate(t.params.tx, t.params.ty)
        case 'rotate':
          return rotate((t.params.angle * Math.PI) / 180, t.params.cx, t.params.cy)
        case 'scale':
          return scale(t.params.sx, t.params.sy)
        case 'skewX':
          return skew((t.params.angle * Math.PI) / 180, 0)
        case 'skewY':
          return skew(0, (t.params.angle * Math.PI) / 180)
        case 'matrix':
          // Explicit matrix parameter passing
          return transform(t.params.a, t.params.b, t.params.c, t.params.d, t.params.e, t.params.f)
        default:
          return translate(0, 0)
      }
    })
  )
}

/*
Example of commands from:

[ { code:'M', command:'moveto', x:3, y:7 },
  { code:'L', command:'lineto', x:5, y:-6 },
  { code:'L', command:'lineto', x:1, y:7 },
  { code:'L', command:'lineto', x:100, y:-0.4 },
  { code:'m', command:'moveto', relative:true, x:-10, y:10 },
  { code:'l', command:'lineto', relative:true, x:10, y:0 },
  { code:'V', command:'vertical lineto', y:27 },
  { code:'V', command:'vertical lineto', y:89 },
  { code:'H', command:'horizontal lineto', x:23 },
  { code:'v', command:'vertical lineto', relative:true, y:10 },
  { code:'h', command:'horizontal lineto', relative:true, x:10 },
  { code:'C', command:'curveto', x1:33, y1:43, x2:38, y2:47, x:43, y:47 },
  { code:'c', command:'curveto', relative:true, x1:0, y1:5, x2:5, y2:10, x:10, y:10 },
  { code:'S', command:'smooth curveto', x2:63, y2:67, x:63, y:67 },
  { code:'s', command:'smooth curveto', relative:true, x2:-10, y2:10, x:10, y:10 },
  { code:'Q', command:'quadratic curveto', x1:50, y1:50, x:73, y:57 },
  { code:'q', command:'quadratic curveto', relative:true, x1:20, y1:-5, x:0, y:-10 },
  { code:'T', command:'smooth quadratic curveto', x:70, y:40 },
  { code:'t', command:'smooth quadratic curveto', relative:true, x:0, y:-15 },
  { code:'A', command:'elliptical arc', rx:5, ry:5, xAxisRotation:45, largeArc:true, sweep:false, x:40, y:20 },
  { code:'a', command:'elliptical arc', relative:true, rx:5, ry:5, xAxisRotation:20, largeArc:false, sweep:true, x:-10, y:-10 },
  { code:'Z', command:'closepath' } ]

*/

export function pathToPoints(parsedPath: Command[]) {
  const points: [number, number][] = []
  const subpathIndices: number[] = []
  let current: [number, number] = [0, 0]
  let lastControl: [number, number] | null = null
  let startPoint: [number, number] = [0, 0]

  for (const cmd of parsedPath) {
    switch (cmd.code) {
      case 'M':
        subpathIndices.push(points.length)
        current = [cmd.x, cmd.y]
        startPoint = current
        points.push([current[0], current[1]])
        lastControl = null
        break

      case 'm':
        subpathIndices.push(points.length)
        current = [current[0] + cmd.x, current[1] + cmd.y]
        startPoint = current
        points.push([current[0], current[1]])
        lastControl = null
        break

      case 'L':
        current = [cmd.x, cmd.y]
        points.push([current[0], current[1]])
        lastControl = null
        break

      case 'l':
        current = [current[0] + cmd.x, current[1] + cmd.y]
        points.push([current[0], current[1]])
        lastControl = null
        break

      case 'H':
        current = [cmd.x, current[1]]
        points.push([current[0], current[1]])
        lastControl = null
        break

      case 'h':
        current = [current[0] + cmd.x, current[1]]
        points.push([current[0], current[1]])
        lastControl = null
        break

      case 'V':
        current = [current[0], cmd.y]
        points.push([current[0], current[1]])
        lastControl = null
        break

      case 'v':
        current = [current[0], current[1] + cmd.y]
        points.push([current[0], current[1]])
        lastControl = null
        break

      case 'C':
      case 'c': {
        const x1 = cmd.code === 'c' ? current[0] + cmd.x1 : cmd.x1
        const y1 = cmd.code === 'c' ? current[1] + cmd.y1 : cmd.y1
        const x2 = cmd.code === 'c' ? current[0] + cmd.x2 : cmd.x2
        const y2 = cmd.code === 'c' ? current[1] + cmd.y2 : cmd.y2
        const x = cmd.code === 'c' ? current[0] + cmd.x : cmd.x
        const y = cmd.code === 'c' ? current[1] + cmd.y : cmd.y

        const samples = sampleCubicBezier(current, [x1, y1], [x2, y2], [x, y], 10)
        samples.slice(1).forEach((p) => points.push([p[0], p[1]]))
        current = [x, y]
        lastControl = [x2, y2]
        break
      }

      case 'S':
      case 's': {
        const reflected = lastControl
          ? [2 * current[0] - lastControl[0], 2 * current[1] - lastControl[1]]
          : current
        const x2 = cmd.code === 's' ? current[0] + cmd.x2 : cmd.x2
        const y2 = cmd.code === 's' ? current[1] + cmd.y2 : cmd.y2
        const x = cmd.code === 's' ? current[0] + cmd.x : cmd.x
        const y = cmd.code === 's' ? current[1] + cmd.y : cmd.y

        const samples = sampleCubicBezier(current, reflected, [x2, y2], [x, y], 10)
        samples.slice(1).forEach((p) => points.push([p[0], p[1]]))
        current = [x, y]
        lastControl = [x2, y2]
        break
      }

      case 'Q':
      case 'q': {
        const x1 = cmd.code === 'q' ? current[0] + cmd.x1 : cmd.x1
        const y1 = cmd.code === 'q' ? current[1] + cmd.y1 : cmd.y1
        const x = cmd.code === 'q' ? current[0] + cmd.x : cmd.x
        const y = cmd.code === 'q' ? current[1] + cmd.y : cmd.y

        const samples = sampleQuadraticBezier(current, [x1, y1], [x, y], 10)
        samples.slice(1).forEach((p) => points.push([p[0], p[1]]))
        current = [x, y]
        lastControl = [x1, y1]
        break
      }

      case 'T':
      case 't': {
        const reflected = lastControl
          ? [2 * current[0] - lastControl[0], 2 * current[1] - lastControl[1]]
          : current
        const x = cmd.code === 't' ? current[0] + cmd.x : cmd.x
        const y = cmd.code === 't' ? current[1] + cmd.y : cmd.y

        const samples = sampleQuadraticBezier(current, reflected, [x, y], 10)
        samples.slice(1).forEach((p) => points.push([p[0], p[1]]))
        current = [x, y]
        lastControl = reflected
        break
      }

      case 'A':
      case 'a': {
        const x = cmd.code === 'a' ? current[0] + cmd.x : cmd.x
        const y = cmd.code === 'a' ? current[1] + cmd.y : cmd.y

        const arcPoints = arcToPoints(
          current,
          [x, y],
          cmd.rx,
          cmd.ry,
          cmd.xAxisRotation,
          cmd.largeArc,
          cmd.sweep,
          10
        )

        arcPoints.slice(1).forEach((p) => points.push([p[0], p[1]]))
        current = [x, y]
        lastControl = null
        break
      }

      case 'Z':
      case 'z':
        points.push([startPoint[0], startPoint[1]])
        current = startPoint
        lastControl = null
        break

      default:
        console.warn(`Unhandled command: ${cmd}`)
        break
    }
  }

  subpathIndices.push(points.length)

  return {
    points,
    subpathIndices
  }
}

function sampleCubicBezier(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  samples = 20
): [number, number][] {
  const result: [number, number][] = []
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const mt = 1 - t

    const x = mt ** 3 * p0[0] + 3 * mt ** 2 * t * p1[0] + 3 * mt * t ** 2 * p2[0] + t ** 3 * p3[0]

    const y = mt ** 3 * p0[1] + 3 * mt ** 2 * t * p1[1] + 3 * mt * t ** 2 * p2[1] + t ** 3 * p3[1]

    result.push([x, y])
  }
  return result
}

function sampleQuadraticBezier(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  samples = 20
) {
  const result: [number, number][] = []
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const mt = 1 - t
    const x = mt ** 2 * p0[0] + 2 * mt * t * p1[0] + t ** 2 * p2[0]
    const y = mt ** 2 * p0[1] + 2 * mt * t * p1[1] + t ** 2 * p2[1]
    result.push([x, y])
  }
  return result
}

function arcToPoints(
  from: [number, number],
  to: [number, number],
  rx: number,
  ry: number,
  phi: number,
  largeArc: boolean,
  sweep: boolean,
  samples: number = 20
): [number, number][] {
  const [x1, y1] = from
  const [x2, y2] = to
  const rad = (phi * Math.PI) / 180

  // Step 1: Compute (x1', y1') in transformed space
  const dx = (x1 - x2) / 2
  const dy = (y1 - y2) / 2
  const x1p = Math.cos(rad) * dx + Math.sin(rad) * dy
  const y1p = -Math.sin(rad) * dx + Math.cos(rad) * dy

  // Step 2: Correct radii if needed
  const rx_sq = rx * rx
  const ry_sq = ry * ry
  const x1p_sq = x1p * x1p
  const y1p_sq = y1p * y1p

  let lambda = x1p_sq / rx_sq + y1p_sq / ry_sq
  if (lambda > 1) {
    const scale = Math.sqrt(lambda)
    rx *= scale
    ry *= scale
  }

  // Step 3: Compute center cx', cy' in transformed space
  const sign = largeArc === sweep ? -1 : 1
  const num = rx_sq * ry_sq - rx_sq * y1p_sq - ry_sq * x1p_sq
  const denom = rx_sq * y1p_sq + ry_sq * x1p_sq
  const factor = sign * Math.sqrt(Math.max(0, num / denom))
  const cxp = (factor * (rx * y1p)) / ry
  const cyp = (factor * (-ry * x1p)) / rx

  // Step 4: Transform back to original space
  const cx = Math.cos(rad) * cxp - Math.sin(rad) * cyp + (x1 + x2) / 2
  const cy = Math.sin(rad) * cxp + Math.cos(rad) * cyp + (y1 + y2) / 2

  // Step 5: Calculate angles
  function angle(u: [number, number], v: [number, number]) {
    const dot = u[0] * v[0] + u[1] * v[1]
    const len = Math.sqrt(u[0] ** 2 + u[1] ** 2) * Math.sqrt(v[0] ** 2 + v[1] ** 2)
    const sign = u[0] * v[1] - u[1] * v[0] < 0 ? -1 : 1
    return sign * Math.acos(Math.min(Math.max(dot / len, -1), 1))
  }

  const v1: [number, number] = [(x1p - cxp) / rx, (y1p - cyp) / ry]
  const v2: [number, number] = [(-x1p - cxp) / rx, (-y1p - cyp) / ry]

  let theta1 = angle([1, 0], v1)
  let deltaTheta = angle(v1, v2)

  if (!sweep && deltaTheta > 0) {
    deltaTheta -= 2 * Math.PI
  } else if (sweep && deltaTheta < 0) {
    deltaTheta += 2 * Math.PI
  }

  // Step 6: Sample points along arc
  const points: [number, number][] = []
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const theta = theta1 + deltaTheta * t
    const cosTheta = Math.cos(theta)
    const sinTheta = Math.sin(theta)

    const xp = rx * cosTheta
    const yp = ry * sinTheta

    const x = Math.cos(rad) * xp - Math.sin(rad) * yp + cx
    const y = Math.sin(rad) * xp + Math.cos(rad) * yp + cy
    points.push([x, y])
  }

  return points
}
