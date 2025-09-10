import { COLORS } from '../helpers'
import { isApproximatelyEqual2D, isApproximatelyEqual2d3d, VectorizedElementNode } from './parsing'
import * as THREE from 'three'

export const drawVectorizedNodes = (
  vectorizedNodes: VectorizedElementNode[],
  width: number,
  options?: {
    defaultFillColor?: number
    defaultStrokeColor?: number
  }
): THREE.Group => {
  const { defaultFillColor = 0xff9900, defaultStrokeColor = 0x0099ff } = options ?? {}

  const rootGroup = new THREE.Group()

  const drawNode = (node: VectorizedElementNode): THREE.Object3D => {
    const nodeGroup = new THREE.Group()

    const props = node.properties ?? {}
    const hasFill = 'fill' in props && props.fill !== 'none'
    const hasStroke = 'stroke' in props && props.stroke !== 'none'

    if (node.points.length >= 2 && node.tagName !== 'path' && (hasFill || hasStroke)) {
      // ✅ Fill if applicable
      if (node.isClosed && node.points.length >= 3 && hasFill) {
        const shape = new THREE.Shape(node.points.map(([x, y]) => new THREE.Vector2(x, y)))
        const fillColor = new THREE.Color()

        const mesh = new THREE.Mesh(
          new THREE.ShapeGeometry(shape),
          new THREE.MeshBasicMaterial({ color: fillColor, side: THREE.DoubleSide })
        )
        nodeGroup.add(mesh)
      }

      // ✅ Stroke if applicable
      if (hasStroke) {
        const vertices: [number, number, number][] = node.points.map(([x, y]) => [x, y, 0])
        const geometry = pointsToStroke(vertices, props['stroke-width'] || 1)

        const strokeColor = new THREE.Color(
          typeof props.stroke === 'string' ? props.stroke : defaultStrokeColor
        )

        const material = new THREE.MeshBasicMaterial({
          color: strokeColor,
          side: THREE.DoubleSide,
          depthWrite: false,
          depthTest: false
        })
        const strokeMesh = new THREE.Mesh(geometry, material)
        nodeGroup.add(strokeMesh)
      }
    }

    if (node.tagName === 'path') {
      const vertices: [number, number, number][] = node.points.map(([x, y]) => [x, y, 0])
      let previousStart = 0
      node.subpathIndices.forEach((index) => {
        if (previousStart !== index) {
          const subpathIsClosed = isApproximatelyEqual2d3d(
            vertices[previousStart],
            vertices[index - 1]
          )

          if (subpathIsClosed && hasFill) {
            const shape = new THREE.Shape(
              node.points.slice(previousStart, index).map(([x, y]) => new THREE.Vector2(x, y))
            )
            const fillColor = COLORS.black

            const mesh = new THREE.Mesh(
              new THREE.ShapeGeometry(shape),
              new THREE.MeshBasicMaterial({ color: fillColor, side: THREE.DoubleSide })
            )

            nodeGroup.add(mesh)
          } else {
            const geometry = pointsToStroke(
              vertices.slice(previousStart, index),
              (props['stroke-width'] as number) || 1
            )

            const strokeColor = COLORS.black

            const material = new THREE.MeshBasicMaterial({
              color: strokeColor,
              side: THREE.DoubleSide,
              depthWrite: false,
              depthTest: false
            })
            const strokeMesh = new THREE.Mesh(geometry, material)
            nodeGroup.add(strokeMesh)
          }

          previousStart = index
        }
      })
    }

    for (const child of node.children) {
      if (typeof child === 'string') continue
      const childGroup = drawNode(child)
      nodeGroup.add(childGroup)
    }

    return nodeGroup
  }

  for (const node of vectorizedNodes) {
    const group = drawNode(node)
    rootGroup.add(group)
  }

  const originalBox = new THREE.Box3().setFromObject(rootGroup)
  const originalWidth = originalBox.max.x - originalBox.min.x
  if (originalWidth <= 0) return rootGroup

  const scaleFactor = width / originalWidth
  rootGroup.scale.set(scaleFactor, -scaleFactor, 1) // Single Y flip here

  // Center the scaled group
  const scaledBox = new THREE.Box3().setFromObject(rootGroup)
  const center = scaledBox.getCenter(new THREE.Vector3())
  rootGroup.position.sub(center)

  return rootGroup
}

function pointsToStroke(points: [number, number, number][], width: number): THREE.BufferGeometry {
  const halfWidth = width / 2
  const leftOffsets: [number, number][] = []
  const rightOffsets: [number, number][] = []

  // Helper: compute a unit normal (perpendicular) from point A to B.
  function computeNormal(
    A: [number, number, number],
    B: [number, number, number]
  ): [number, number, number] {
    const dx = B[0] - A[0]
    const dy = B[1] - A[1]
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len === 0) return [0, 0, 0]
    // Rotate by 90° counterclockwise: (-dy, dx)
    return [-dy / len, dx / len, 0]
  }

  // Use the normal of the first segment for the first point.
  const nStart = computeNormal(points[0], points[1])
  leftOffsets.push([points[0][0] + nStart[0] * halfWidth, points[0][1] + nStart[1] * halfWidth])
  rightOffsets.push([points[0][0] - nStart[0] * halfWidth, points[0][1] - nStart[1] * halfWidth])

  // For internal points, average the normals of adjacent segments.
  for (let i = 1; i < points.length - 1; i++) {
    const n1 = computeNormal(points[i - 1], points[i])
    const n2 = computeNormal(points[i], points[i + 1])
    // Average the two normals.
    const avg: [number, number, number] = [n1[0] + n2[0], n1[1] + n2[1], 0]
    const len = Math.sqrt(avg[0] * avg[0] + avg[1] * avg[1])
    const normal: [number, number, number] = len === 0 ? n2 : [avg[0] / len, avg[1] / len, 0]
    leftOffsets.push([points[i][0] + normal[0] * halfWidth, points[i][1] + normal[1] * halfWidth])
    rightOffsets.push([points[i][0] - normal[0] * halfWidth, points[i][1] - normal[1] * halfWidth])
  }

  // Use the normal of the last segment for the last point.
  const nEnd = computeNormal(points[points.length - 2], points[points.length - 1])
  leftOffsets.push([
    points[points.length - 1][0] + nEnd[0] * halfWidth,
    points[points.length - 1][1] + nEnd[1] * halfWidth
  ])
  rightOffsets.push([
    points[points.length - 1][0] - nEnd[0] * halfWidth,
    points[points.length - 1][1] - nEnd[1] * halfWidth
  ])

  // Build triangles for each segment between consecutive points.
  const positions: number[] = []
  const normals: number[] = []
  // All normals face +Z for a flat XY-plane.
  const nz = [0, 0, 1]

  for (let i = 0; i < points.length - 1; i++) {
    // Create vertices for the quad:
    // leftOffsets[i], rightOffsets[i], rightOffsets[i+1], leftOffsets[i+1]
    const v0 = leftOffsets[i]
    const v1 = rightOffsets[i]
    const v2 = rightOffsets[i + 1]
    const v3 = leftOffsets[i + 1]

    // Triangle 1: v0, v1, v2
    positions.push(v0[0], v0[1], 0)
    positions.push(v1[0], v1[1], 0)
    positions.push(v2[0], v2[1], 0)

    // Triangle 2: v0, v2, v3
    positions.push(v0[0], v0[1], 0)
    positions.push(v2[0], v2[1], 0)
    positions.push(v3[0], v3[1], 0)

    // Each triangle has 3 vertices, add normals for each (pointing up)
    for (let j = 0; j < 6; j++) {
      normals.push(...nz)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.computeBoundingSphere()

  return geometry
}
