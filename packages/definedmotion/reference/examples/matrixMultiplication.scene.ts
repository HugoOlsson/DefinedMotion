import * as THREE from 'three'
import { defineScene } from 'definedmotion'
import { setOpacity } from 'definedmotion/animation'
import { createFastText, createLine } from 'definedmotion/rendering'
import { createSVGShape } from 'definedmotion/latex'
import { latexToSVG } from 'definedmotion/latex'
import { AnimatedScene, HotReloadSetting, SpaceSetting } from 'definedmotion'

export default defineScene({
  id: 'matrix-multiplication',
  name: 'Matrix Multiplication as Transformation',
  create: matrixMultiplicationScene
})

const DURATION_MS = 13_000
const ORIGIN = new THREE.Vector3(9, -4, 0)
const GRID_X = 13
const GRID_Y = 10
const GRID_STEP = 2
const ROTATION = THREE.MathUtils.degToRad(-32)

interface Matrix2 {
  a: number
  b: number
  c: number
  d: number
}

interface TransformState {
  matrix: Matrix2
  stage: number
  shearProgress: number
  rotationProgress: number
}

interface VectorArrow {
  group: THREE.Group & { text: string }
  shaftMaterial: THREE.LineBasicMaterial
  update(start: THREE.Vector3, end: THREE.Vector3): void
}

interface PolygonVisual {
  group: THREE.Group
  fill: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
  outline: THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial>
  vertices: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>[]
}

interface NarrativeCard {
  group: THREE.Group
  stage: number
}

const IDENTITY: Matrix2 = { a: 1, b: 0, c: 0, d: 1 }
const MATRIX_A: Matrix2 = { a: 1, b: 0.75, c: 0, d: 1 }
const MATRIX_B = rotationMatrix(ROTATION)
const MATRIX_BA = multiply(MATRIX_B, MATRIX_A)

const SHAPE_POINTS = [
  new THREE.Vector3(-8, -3, 0),
  new THREE.Vector3(-3, -7, 0),
  new THREE.Vector3(5, -6, 0),
  new THREE.Vector3(9, 0, 0),
  new THREE.Vector3(4, 7, 0),
  new THREE.Vector3(-4, 6, 0),
  new THREE.Vector3(-9, 1, 0)
]

const UNIT_CELL = [
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(6, 0, 0),
  new THREE.Vector3(6, 6, 0),
  new THREE.Vector3(0, 6, 0)
]

export function matrixMultiplicationScene(): AnimatedScene {
  return new AnimatedScene(
    1600,
    900,
    SpaceSetting.TwoDim,
    HotReloadSetting.TraceFromStart,
    async (scene) => {
      scene.scene.background = new THREE.Color('#050814')

      const header = new THREE.Group()
      const title = await createFastText('Transform space, not the drawing', 2.8, 0xf8fafc)
      title.position.set(-19, 26, 1)
      const subtitle = await createFastText(
        'Every point follows one continuously changing rule',
        1.12,
        0x94a3b8
      )
      subtitle.position.set(-19, 22.6, 1)
      const composition = createSVGShape(
        latexToSVG(
          String.raw`\mathbf{x}\xrightarrow{\ A\ }A\mathbf{x}\xrightarrow{\ B\ }BA\mathbf{x}`
        ),
        25
      )
      composition.position.set(30, 24.2, 1)
      header.add(title, subtitle, composition)
      scene.add(header)

      scene.add(
        createLine({
          point1: new THREE.Vector3(-49, 18.6, 0),
          point2: new THREE.Vector3(49, 18.6, 0),
          color: '#1e293b'
        })
      )

      const sidebarPanel = createPanel(23, 33, '#08111f', 0.96)
      sidebarPanel.position.set(-40, -0.2, -3)
      const canvasPanel = createPanel(64, 33, '#07101d', 0.78)
      canvasPanel.position.set(13, -0.2, -3)
      scene.add(sidebarPanel, canvasPanel)

      const rail = createLine({
        point1: new THREE.Vector3(-48, 10.5, 1),
        point2: new THREE.Vector3(-48, -11.5, 1),
        color: '#243149'
      })
      scene.add(rail)

      const railYs = [10.5, 3.2, -4.2, -11.5]
      const railDots = railYs.map((y, index) => {
        const dot = new THREE.Mesh(
          new THREE.CircleGeometry(index === 0 ? 0.28 : 0.22, 24),
          new THREE.MeshBasicMaterial({ color: '#475569', depthTest: false })
        )
        dot.position.set(-48, y, 2)
        scene.add(dot)
        return dot
      })
      const railMarker = new THREE.Mesh(
        new THREE.CircleGeometry(0.46, 32),
        new THREE.MeshBasicMaterial({ color: '#67e8f9', depthTest: false })
      )
      railMarker.position.set(-48, railYs[0], 3)
      scene.add(railMarker)

      const narratives = await Promise.all([
        createNarrativeCard(
          0,
          '01 · THE START',
          'A familiar coordinate system',
          String.raw`I=\begin{bmatrix}1&0\\0&1\end{bmatrix}`,
          '#67e8f9'
        ),
        createNarrativeCard(
          1,
          '02 · SHEAR WITH A',
          'Rows slide smoothly past each other',
          String.raw`A=\begin{bmatrix}1&0.75\\0&1\end{bmatrix}`,
          '#38bdf8'
        ),
        createNarrativeCard(
          2,
          '03 · ROTATE WITH B',
          'The sheared space turns as one',
          String.raw`B=R(-32^\circ)`,
          '#a78bfa'
        ),
        createNarrativeCard(
          3,
          '04 · THE PRODUCT BA',
          'One matrix describes the whole journey',
          String.raw`BA=\begin{bmatrix}0.848&1.166\\-0.530&0.451\end{bmatrix}`,
          '#f0abfc'
        )
      ])
      narratives.forEach(({ group }) => {
        group.position.set(-38.4, 6.6, 2)
        scene.add(group)
      })

      const ruleNote = await createFastText('same rule · every point · all at once', 0.92, 0x64748b)
      ruleNote.position.set(-39.7, -14.2, 2)
      scene.add(ruleNote)

      const referenceGrid = new THREE.Group()
      const transformedGrid = scene.expose('transformed-grid', new THREE.Group(), {
        description: 'Coordinate lattice continuously transformed by the active matrix',
        tags: ['grid', 'linear-transformation', 'dynamic']
      })
      const gridSegments: Array<{
        line: ReturnType<typeof createLine>
        from: THREE.Vector3
        to: THREE.Vector3
        major: boolean
      }> = []
      const gridMaterials: THREE.LineBasicMaterial[] = []

      for (let x = -GRID_X + 1; x <= GRID_X - 1; x += GRID_STEP) {
        const from = new THREE.Vector3(x, -GRID_Y, 0)
        const to = new THREE.Vector3(x, GRID_Y, 0)
        const major = Math.abs(x) < 0.01
        referenceGrid.add(createStaticGridLine(from, to, major))
        const line = createLine({ color: major ? '#7dd3fc' : '#28506d' })
        line.frustumCulled = false
        transformedGrid.add(line)
        gridSegments.push({ line, from, to, major })
        gridMaterials.push(line.material as THREE.LineBasicMaterial)
      }
      for (let y = -GRID_Y; y <= GRID_Y; y += GRID_STEP) {
        const from = new THREE.Vector3(-GRID_X, y, 0)
        const to = new THREE.Vector3(GRID_X, y, 0)
        const major = Math.abs(y) < 0.01
        referenceGrid.add(createStaticGridLine(from, to, major))
        const line = createLine({ color: major ? '#7dd3fc' : '#28506d' })
        line.frustumCulled = false
        transformedGrid.add(line)
        gridSegments.push({ line, from, to, major })
        gridMaterials.push(line.material as THREE.LineBasicMaterial)
      }
      scene.add(referenceGrid, transformedGrid)

      const latticeMaterial = new THREE.MeshBasicMaterial({
        color: '#38bdf8',
        transparent: true,
        opacity: 0.52,
        depthTest: false,
        depthWrite: false
      })
      const latticeGeometry = new THREE.CircleGeometry(0.12, 16)
      const latticePoints: Array<{ mesh: THREE.Mesh; point: THREE.Vector3 }> = []
      for (let x = -12; x <= 12; x += 3) {
        for (let y = -9; y <= 9; y += 3) {
          const point = new THREE.Vector3(x, y, 0)
          const mesh = new THREE.Mesh(latticeGeometry, latticeMaterial)
          mesh.position.copy(localToWorld(point)).setZ(2)
          transformedGrid.add(mesh)
          latticePoints.push({ mesh, point })
        }
      }

      const referenceShape = createPolygonVisual('#1e3a52', 0.055, '#35516b', 0.22, false)
      updatePolygonVisual(referenceShape, IDENTITY, SHAPE_POINTS)
      scene.add(referenceShape.group)

      const shapeVisual = createPolygonVisual('#0ea5e9', 0.2, '#67e8f9', 0.95, true)
      const transformedShape = scene.expose('transformed-shape', shapeVisual.group, {
        description: 'Organic polygon showing how a complete figure follows the matrix',
        tags: ['polygon', 'matrix', 'dynamic']
      })
      scene.add(transformedShape)

      const unitCell = createPolygonVisual('#f8fafc', 0.08, '#e2e8f0', 0.62, false)
      updatePolygonVisual(unitCell, IDENTITY, UNIT_CELL)
      scene.add(unitCell.group)

      const productOverlay = createPolygonVisual('#f0abfc', 0, '#f0abfc', 0, false)
      updatePolygonVisual(productOverlay, MATRIX_BA, SHAPE_POINTS)
      productOverlay.group.visible = false
      scene.add(productOverlay.group)

      const basisE1 = createVectorArrow('e1 maps to (1, 0)', 0x22d3ee)
      const basisE2 = createVectorArrow('e2 maps to (0, 1)', 0xc084fc)
      scene.expose('basis-e1', basisE1.group, {
        description: 'First transformed basis vector, equal to the first matrix column',
        tags: ['basis-vector', 'column-1', 'dynamic']
      })
      scene.expose('basis-e2', basisE2.group, {
        description: 'Second transformed basis vector, equal to the second matrix column',
        tags: ['basis-vector', 'column-2', 'dynamic']
      })
      scene.add(basisE1.group, basisE2.group)

      const originDot = new THREE.Mesh(
        new THREE.CircleGeometry(0.3, 28),
        new THREE.MeshBasicMaterial({ color: '#f8fafc', depthTest: false })
      )
      originDot.position.copy(ORIGIN).setZ(6)
      scene.add(originDot)

      const phaseLabels = await Promise.all(
        ['IDENTITY', 'A · SHEAR', 'B · ROTATE', 'BA · COMPOSED'].map((label) =>
          createFastText(label, 0.82, 0x94a3b8)
        )
      )
      phaseLabels.forEach((label, index) => {
        label.position.set(30.4, 14.9, 2)
        label.visible = index === 0
        scene.add(label)
      })
      const phaseUnderline = createLine({
        point1: new THREE.Vector3(23.5, 13.8, 2),
        point2: new THREE.Vector3(37.3, 13.8, 2),
        color: '#38bdf8'
      })
      scene.add(phaseUnderline)

      const finalEquality = createSVGShape(
        latexToSVG(String.raw`B(A\mathbf{x})=(BA)\mathbf{x}`),
        16.5
      )
      finalEquality.position.set(14.5, -14.3, 5)
      finalEquality.visible = false
      scene.add(finalEquality)

      const matrixState = scene.expose(
        'current-matrix',
        Object.assign(new THREE.Group(), { text: matrixText(IDENTITY) }),
        {
          description: 'Numerical value of the continuously interpolated transformation matrix',
          tags: ['matrix', 'state', 'dynamic']
        }
      )
      scene.add(matrixState)

      const geometryCamera = scene.exposeCamera(
        'geometry',
        new THREE.OrthographicCamera(-25.778, 25.778, 14.5, -14.5, 1, 100),
        {
          description: 'Close view of the flowing lattice, polygon, and transformed basis',
          tags: ['detail', 'geometry', 'transformation']
        }
      )
      geometryCamera.position.set(9, -4, 30)
      geometryCamera.lookAt(9, -4, 0)

      const storyCamera = scene.exposeCamera(
        'story',
        new THREE.OrthographicCamera(-12.889, 12.889, 14.5, -14.5, 1, 100),
        {
          description: 'Close view of the current operation and its matrix',
          tags: ['detail', 'narrative', 'latex']
        }
      )
      storyCamera.position.set(-40, -0.2, 30)
      storyCamera.lookAt(-40, -0.2, 0)

      scene.onEachTick((frame) => {
        const state = transformAtFrame(frame)
        const accent = new THREE.Color('#38bdf8').lerp(
          new THREE.Color('#c084fc'),
          state.rotationProgress
        )
        const fillColor = new THREE.Color('#0ea5e9').lerp(
          new THREE.Color('#8b5cf6'),
          state.rotationProgress
        )

        gridSegments.forEach(({ line, from, to, major }, index) => {
          line.updatePositions(
            localToWorld(applyMatrix(state.matrix, from)).setZ(1),
            localToWorld(applyMatrix(state.matrix, to)).setZ(1)
          )
          gridMaterials[index].color.copy(accent)
          gridMaterials[index].opacity = major ? 0.78 : 0.34
        })
        latticeMaterial.color.copy(accent)
        latticePoints.forEach(({ mesh, point }) => {
          mesh.position.copy(localToWorld(applyMatrix(state.matrix, point))).setZ(2)
        })

        updatePolygonVisual(shapeVisual, state.matrix, SHAPE_POINTS)
        updatePolygonVisual(unitCell, state.matrix, UNIT_CELL)
        shapeVisual.fill.material.color.copy(fillColor)
        shapeVisual.outline.material.color.copy(accent)

        const firstColumn = localToWorld(applyMatrix(state.matrix, new THREE.Vector3(7.2, 0, 0)))
        const secondColumn = localToWorld(applyMatrix(state.matrix, new THREE.Vector3(0, 7.2, 0)))
        basisE1.update(ORIGIN, firstColumn)
        basisE2.update(ORIGIN, secondColumn)
        basisE1.group.text = `e1 maps to (${format(state.matrix.a)}, ${format(state.matrix.c)})`
        basisE2.group.text = `e2 maps to (${format(state.matrix.b)}, ${format(state.matrix.d)})`
        matrixState.text = matrixText(state.matrix)

        const markerProgress = narrativeProgress(frame)
        railMarker.position.y = interpolateRail(railYs, markerProgress)
        railMarker.material.color.copy(accent)
        railDots.forEach((dot, index) => {
          const material = dot.material as THREE.MeshBasicMaterial
          material.color.set(index <= markerProgress + 0.02 ? '#64748b' : '#334155')
        })

        narratives.forEach(({ group, stage }) => {
          const opacity = narrativeOpacity(frame, stage)
          group.visible = opacity > 0.005
          if (group.visible) {
            setOpacity(group, opacity, true, false)
            group.position.y = 6.6 + (1 - opacity) * 0.65
          }
        })

        phaseLabels.forEach((label, index) => {
          const opacity = narrativeOpacity(frame, index)
          label.visible = opacity > 0.005
          if (label.visible) setOpacity(label, opacity, true, false)
        })
        phaseUnderline.material.color.copy(accent)

        const productReveal = smootherStep(normalized(frame, 610, 690))
        productOverlay.group.visible = productReveal > 0.005
        productOverlay.outline.material.opacity = Math.sin(productReveal * Math.PI) * 0.7
        finalEquality.visible = productReveal > 0.005
        if (finalEquality.visible) setOpacity(finalEquality, productReveal, true, false)

        const intro = smootherStep(normalized(frame, 0, 55))
        header.position.y = (1 - intro) * 0.7
        setOpacity(header, intro, true, false)
      })

      scene.addWait(DURATION_MS)
    }
  )
}

const createPanel = (width: number, height: number, color: string, opacity: number): THREE.Mesh =>
  new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthTest: false,
      depthWrite: false
    })
  )

const createNarrativeCard = async (
  stage: number,
  eyebrow: string,
  description: string,
  formula: string,
  color: string
): Promise<NarrativeCard> => {
  const group = new THREE.Group()
  const eyebrowText = await createFastText(eyebrow, 0.88, new THREE.Color(color).getHex())
  eyebrowText.position.set(0, 4.1, 0)
  const descriptionText = await createFastText(description, 0.95, 0xcbd5e1)
  descriptionText.position.set(0, 1.5, 0)
  const formulaShape = createSVGShape(latexToSVG(formula), 16.5)
  formulaShape.position.set(0, -3.4, 0)
  group.add(eyebrowText, descriptionText, formulaShape)
  group.visible = stage === 0
  return { group, stage }
}

const createStaticGridLine = (
  from: THREE.Vector3,
  to: THREE.Vector3,
  major: boolean
): ReturnType<typeof createLine> => {
  const line = createLine({
    point1: localToWorld(from).setZ(0),
    point2: localToWorld(to).setZ(0),
    color: major ? '#24364c' : '#121d2c'
  })
  ;(line.material as THREE.LineBasicMaterial).opacity = major ? 0.42 : 0.34
  return line
}

const createPolygonVisual = (
  fillColor: THREE.ColorRepresentation,
  fillOpacity: number,
  outlineColor: THREE.ColorRepresentation,
  outlineOpacity: number,
  showVertices: boolean
): PolygonVisual => {
  const group = new THREE.Group()
  const fill = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshBasicMaterial({
      color: fillColor,
      transparent: true,
      opacity: fillOpacity,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  )
  const outline = new THREE.LineLoop(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({
      color: outlineColor,
      transparent: true,
      opacity: outlineOpacity,
      depthTest: false,
      depthWrite: false
    })
  )
  outline.frustumCulled = false
  const vertexGeometry = new THREE.CircleGeometry(0.26, 20)
  const vertexColors = [0x22d3ee, 0x38bdf8, 0x818cf8, 0xa78bfa, 0xc084fc, 0xe879f9, 0x67e8f9]
  const vertices = vertexColors.map(
    (color) =>
      new THREE.Mesh(
        vertexGeometry,
        new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false })
      )
  )
  vertices.forEach((vertex) => (vertex.visible = showVertices))
  group.add(fill, outline, ...vertices)
  return { group, fill, outline, vertices }
}

const updatePolygonVisual = (
  visual: PolygonVisual,
  matrix: Matrix2,
  sourcePoints: THREE.Vector3[]
): void => {
  const points = sourcePoints.map((point) => localToWorld(applyMatrix(matrix, point)))
  const center = points
    .reduce((sum, point) => sum.add(point), new THREE.Vector3())
    .multiplyScalar(1 / points.length)
  const triangles: THREE.Vector3[] = []
  points.forEach((point, index) => {
    triangles.push(center, point, points[(index + 1) % points.length])
  })
  visual.fill.geometry.setFromPoints(triangles.map((point) => point.clone().setZ(3)))
  visual.fill.geometry.computeBoundingBox()
  visual.fill.geometry.computeBoundingSphere()
  visual.outline.geometry.setFromPoints(points.map((point) => point.clone().setZ(4)))
  visual.vertices.forEach((vertex, index) => {
    if (index >= points.length) {
      vertex.visible = false
      return
    }
    vertex.position.copy(points[index]).setZ(5)
  })
}

const createVectorArrow = (text: string, color: number): VectorArrow => {
  const group = Object.assign(new THREE.Group(), { text })
  const shaft = createLine({ color })
  const shaftMaterial = shaft.material as THREE.LineBasicMaterial
  const headShape = new THREE.Shape()
  headShape.moveTo(0, 0)
  headShape.lineTo(-1.1, 0.56)
  headShape.lineTo(-1.1, -0.56)
  headShape.closePath()
  const head = new THREE.Mesh(
    new THREE.ShapeGeometry(headShape),
    new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false })
  )
  group.add(shaft, head)
  return {
    group,
    shaftMaterial,
    update: (start, end): void => {
      shaft.updatePositions(start.clone().setZ(6), end.clone().setZ(6))
      head.position.copy(end).setZ(6)
      head.rotation.z = Math.atan2(end.y - start.y, end.x - start.x)
    }
  }
}

const transformAtFrame = (frame: number): TransformState => {
  const shearProgress = smootherStep(normalized(frame, 90, 270))
  const rotationProgress = smootherStep(normalized(frame, 330, 540))
  const sheared = lerpMatrix(IDENTITY, MATRIX_A, shearProgress)
  const matrix = multiply(rotationMatrix(ROTATION * rotationProgress), sheared)
  const stage = frame < 90 ? 0 : frame < 330 ? 1 : frame < 600 ? 2 : 3
  return { matrix, stage, shearProgress, rotationProgress }
}

const narrativeProgress = (frame: number): number => {
  if (frame < 90) return 0
  if (frame < 330) return smootherStep(normalized(frame, 90, 190))
  if (frame < 600) return 1 + smootherStep(normalized(frame, 330, 450))
  return 2 + smootherStep(normalized(frame, 600, 675))
}

const interpolateRail = (values: number[], progress: number): number => {
  const from = Math.min(Math.floor(progress), values.length - 1)
  const to = Math.min(from + 1, values.length - 1)
  return THREE.MathUtils.lerp(values[from], values[to], progress - from)
}

const narrativeOpacity = (frame: number, stage: number): number => {
  if (stage === 0) return 1 - smootherStep(normalized(frame, 65, 115))
  if (stage === 1)
    return (
      smootherStep(normalized(frame, 65, 120)) * (1 - smootherStep(normalized(frame, 300, 360)))
    )
  if (stage === 2)
    return (
      smootherStep(normalized(frame, 300, 360)) * (1 - smootherStep(normalized(frame, 565, 625)))
    )
  return smootherStep(normalized(frame, 565, 625))
}

function multiply(left: Matrix2, right: Matrix2): Matrix2 {
  return {
    a: left.a * right.a + left.b * right.c,
    b: left.a * right.b + left.b * right.d,
    c: left.c * right.a + left.d * right.c,
    d: left.c * right.b + left.d * right.d
  }
}

function rotationMatrix(angle: number): Matrix2 {
  return {
    a: Math.cos(angle),
    b: -Math.sin(angle),
    c: Math.sin(angle),
    d: Math.cos(angle)
  }
}

const applyMatrix = (matrix: Matrix2, point: THREE.Vector3): THREE.Vector3 =>
  new THREE.Vector3(
    matrix.a * point.x + matrix.b * point.y,
    matrix.c * point.x + matrix.d * point.y,
    point.z
  )

const lerpMatrix = (from: Matrix2, to: Matrix2, progress: number): Matrix2 => ({
  a: THREE.MathUtils.lerp(from.a, to.a, progress),
  b: THREE.MathUtils.lerp(from.b, to.b, progress),
  c: THREE.MathUtils.lerp(from.c, to.c, progress),
  d: THREE.MathUtils.lerp(from.d, to.d, progress)
})

const localToWorld = (point: THREE.Vector3): THREE.Vector3 => point.clone().add(ORIGIN)

const normalized = (frame: number, start: number, end: number): number =>
  THREE.MathUtils.clamp((frame - start) / (end - start), 0, 1)

const smootherStep = (value: number): number =>
  value * value * value * (value * (value * 6 - 15) + 10)

const matrixText = (matrix: Matrix2): string =>
  `[[${format(matrix.a)}, ${format(matrix.b)}], [${format(matrix.c)}, ${format(matrix.d)}]]`

const format = (value: number): string => {
  const rounded = Math.abs(value) < 0.0005 ? 0 : value
  return rounded.toFixed(3).replace(/\.?0+$/, '')
}
