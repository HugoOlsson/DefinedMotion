import { AnimatedScene, SpaceSetting, defineScene, type ScreenBounds } from 'definedmotion'
import {
  camera,
  createAnimation,
  fadeIn,
  fadeOut,
  scaleTo,
  wait
} from 'definedmotion/animation'
import { createLatex, latex, type LatexVisual } from 'definedmotion/latex'
import { createText, type TextVisual } from 'definedmotion/rendering'
import * as THREE from 'three'

export default defineScene({
  id: 'test-spherical-triangle-explainer',
  name: 'Spherical Triangle Explainer Integration Contract',
  isTest: true,
  create: testSphericalTriangleExplainer
})

const COLORS = {
  background: '#06090a',
  surface: '#0d1819',
  grid: '#31504e',
  ivory: '#f0ece2',
  muted: '#9ca5a6',
  mint: '#8bc6af',
  gold: '#d4ae59',
  coral: '#d17b67',
  blue: '#72afbd',
  wire: '#52689a'
} as const

const FLAT_POSITION = new THREE.Vector3(-5.2, -0.2, 0)
const SPHERE_POSITION = new THREE.Vector3(4.7, 0, 0)
const SPHERE_RADIUS = 3.9
const ARC_LIFT = 0.07

const FLAT_CAMERA_POSITION = new THREE.Vector3(-5.2, 0.8, 17.5)
const OVERVIEW_CAMERA_POSITION = new THREE.Vector3(0, 3.2, 20)
const SPHERE_CAMERA_POSITION = new THREE.Vector3(13.5, 7.5, 19)
const FINAL_CAMERA_POSITION = new THREE.Vector3(0, 4.1, 20.8)
const SPHERE_CAMERA_TARGET = SPHERE_POSITION.clone()

interface BeatFrames {
  flat: number
  flatSum: number
  curve: number
  greatCircles: number
  sphereAngles: number
  compare: number
  end: number
}

interface ExplainerState {
  beat: string
  beatProgress: number
  timelineProgress: number
}

interface FlatTriangle {
  root: THREE.Group
  triangle: THREE.Group
  angleItems: THREE.Group[]
  vertices: readonly THREE.Vector3[]
  angleSum: number
}

interface SphereTriangle {
  root: THREE.Group
  surface: THREE.Mesh
  grid: THREE.Group
  triangle: THREE.Group
  patch: THREE.Mesh
  edges: readonly THREE.Mesh[]
  edgeSamples: readonly (readonly THREE.Vector3[])[]
  angleItems: THREE.Group[]
  angleLabels: TextVisual[]
  vertices: readonly THREE.Vector3[]
  angleSum: number
}

interface CameraTypography {
  flatTitle: TextVisual
  sphereTitle: TextVisual
  finalTitle: TextVisual
  formula: LatexVisual
}

interface ExplainerVisuals {
  flat: FlatTriangle
  sphere: SphereTriangle
  typography: CameraTypography
  stateProbe: THREE.Group & { text: string }
}

export function testSphericalTriangleExplainer(): AnimatedScene {
  return new AnimatedScene(1280, 720, SpaceSetting.ThreeDim, async (scene) => {
    scene.scene.background = new THREE.Color(COLORS.background)
    scene.renderer.shadowMap.enabled = true

    const flat = await createFlatTriangle()
    flat.root.position.copy(FLAT_POSITION)

    const sphere = await createSphereTriangle()
    sphere.root.position.copy(SPHERE_POSITION)
    sphere.root.scale.setScalar(0.84)
    sphere.root.visible = false

    const typography = await createCameraTypography()
    typography.flatTitle.position.set(0, 5.72, -18)
    typography.sphereTitle.position.set(0, 5.72, -18)
    typography.finalTitle.position.set(0, 5.72, -18)
    typography.formula.position.set(0, -5.5, -18)
    typography.sphereTitle.visible = false
    typography.finalTitle.visible = false
    const stateProbe = new THREE.Group() as THREE.Group & { text: string }
    stateProbe.name = 'SphericalTriangleState'
    stateProbe.text = ''

    scene.add(flat.root, sphere.root, ...createLights(), stateProbe)
    scene.addCameraAttachedUI(typography.flatTitle)
    scene.addCameraAttachedUI(typography.sphereTitle)
    scene.addCameraAttachedUI(typography.finalTitle)
    scene.addCameraAttachedUI(typography.formula)

    scene.camera.position.copy(FLAT_CAMERA_POSITION)
    scene.camera.quaternion.copy(cameraRotation(FLAT_CAMERA_POSITION, FLAT_POSITION))
    if (scene.camera instanceof THREE.PerspectiveCamera) {
      scene.camera.fov = 40
      scene.camera.updateProjectionMatrix()
    }

    const frames: BeatFrames = {
      flat: 0,
      flatSum: scene.secondsToFrames(6),
      curve: scene.secondsToFrames(12),
      greatCircles: scene.secondsToFrames(18),
      sphereAngles: scene.secondsToFrames(25),
      compare: scene.secondsToFrames(32),
      end: scene.secondsToFrames(38)
    }

    scene.timeline.defineBeats({
      flat: { start: frames.flat, end: frames.flatSum },
      'flat-sum': { start: frames.flatSum, end: frames.curve },
      curvature: { start: frames.curve, end: frames.greatCircles },
      'great-circles': { start: frames.greatCircles, end: frames.sphereAngles },
      'sphere-angles': { start: frames.sphereAngles, end: frames.compare },
      compare: { start: frames.compare, end: frames.end }
    })

    const flatFormula = String.raw`\dmClass{sum}{\alpha+\beta+\gamma}=180^\circ`
    const sphereFormula = String.raw`\dmClass{sum}{90^\circ+90^\circ+90^\circ}=270^\circ`
    const comparisonFormula = String.raw`\dmClass{flat}{180^\circ}\;\text{flat}\qquad\dmClass{sphere}{270^\circ}\;\text{sphere}`
    const sphereFormulaMorph = await latex.morphTo(typography.formula, {
      latex: sphereFormula,
      duration: 1.5,
      particleCount: 2500,
      easing: 'ease-in-out'
    })
    const comparisonFormulaMorph = await latex.morphTo(typography.formula, {
      latex: comparisonFormula,
      duration: 1.4,
      particleCount: 2500,
      easing: 'ease-in-out'
    })

    const state: ExplainerState = {
      beat: 'flat',
      beatProgress: 0,
      timelineProgress: 0
    }
    const backgroundPointer = scene.getTimelinePointer()
    scene.addAnims(
      createAnimation({
        duration: 38,
        easing: 'linear',
        bind() {
          return {
            update({ linearProgress }) {
              state.timelineProgress = linearProgress
            }
          }
        }
      })
    )
    scene.setTimelinePointer(backgroundPointer)

    scene.timeline.beat('flat', (beat) => {
      scene.addAnims(
        fadeIn(flat.root, { duration: 1.05, easing: 'ease-out' }),
        fadeIn(typography.flatTitle, { duration: 0.65, easing: 'ease-out' }),
        latex.write(typography.formula, { duration: 1.35, easing: 'linear' })
      )
      scene.addAnims(wait(4.5))
      beat.onEachTick(({ beatProgress }) => setBeatState(state, 'flat', beatProgress))
    })

    scene.timeline.beat('flat-sum', (beat) => {
      for (const item of flat.angleItems) {
        scene.addAnims(fadeIn(item, { duration: 0.45, easing: 'ease-out' }))
      }
      scene.addAnims(wait(0.35))
      scene.addAnims(
        latex.mark(typography.formula.part('sum'), {
          color: COLORS.coral
        })
      )
      scene.addAnims(wait(1.55))
      beat.onEachTick(({ beatProgress }) => setBeatState(state, 'flat-sum', beatProgress))
    })

    scene.timeline.beat('curvature', (beat) => {
      scene.addAnims(
        camera.moveToPose(
          scene.camera,
          {
            position: OVERVIEW_CAMERA_POSITION,
            rotation: cameraRotation(OVERVIEW_CAMERA_POSITION, new THREE.Vector3(0, 0, 0))
          },
          { duration: 2, easing: 'ease-in-out', space: 'world' }
        ),
        scaleTo(flat.root, 0.78, { duration: 2, easing: 'ease-in-out' })
      )
      scene.addAnims(fadeIn(sphere.root, { duration: 1, easing: 'ease-out' }))
      scene.addAnims(fadeOut(typography.flatTitle, { duration: 0.4, easing: 'ease-in-out' }))
      scene.addAnims(fadeIn(typography.sphereTitle, { duration: 0.55, easing: 'ease-out' }))
      scene.addAnims(wait(1.85))
      beat.onEachTick(({ beatProgress }) => setBeatState(state, 'curvature', beatProgress))
    })

    scene.timeline.beat('great-circles', (beat) => {
      scene.addAnims(
        camera.moveToPose(
          scene.camera,
          {
            position: SPHERE_CAMERA_POSITION,
            rotation: cameraRotation(SPHERE_CAMERA_POSITION, SPHERE_CAMERA_TARGET)
          },
          { duration: 2.2, easing: 'ease-in-out', space: 'world' }
        ),
        fadeOut(flat.root, { duration: 0.9, easing: 'ease-in-out' })
      )
      scene.addAnims(fadeIn(sphere.triangle, { duration: 1.1, easing: 'ease-out' }))
      scene.addAnims(wait(3.55))
      beat.onEachTick(({ beatProgress }) => setBeatState(state, 'great-circles', beatProgress))
    })

    scene.timeline.beat('sphere-angles', (beat) => {
      for (const item of sphere.angleItems) {
        scene.addAnims(fadeIn(item, { duration: 0.45, easing: 'ease-out' }))
      }
      scene.addAnims(wait(0.35))
      scene.addAnims(sphereFormulaMorph)
      scene.addAnims(
        latex.mark(typography.formula.part('sum'), {
          color: COLORS.mint
        })
      )
      scene.addAnims(wait(1.15))
      beat.onEachTick(({ beatProgress }) => setBeatState(state, 'sphere-angles', beatProgress))
    })

    scene.timeline.beat('compare', (beat) => {
      scene.addAnims(
        camera.moveToPose(
          scene.camera,
          {
            position: FINAL_CAMERA_POSITION,
            rotation: cameraRotation(FINAL_CAMERA_POSITION, new THREE.Vector3(0, 0, 0))
          },
          { duration: 2.3, easing: 'ease-in-out', space: 'world' }
        ),
        fadeIn(flat.root, { duration: 0.9, easing: 'ease-out' })
      )
      scene.addAnims(fadeOut(typography.sphereTitle, { duration: 0.4, easing: 'ease-in-out' }))
      scene.addAnims(fadeIn(typography.finalTitle, { duration: 0.55, easing: 'ease-out' }))
      scene.addAnims(comparisonFormulaMorph)
      scene.addAnims(wait(1.25))
      beat.onEachTick(({ beatProgress }) => setBeatState(state, 'compare', beatProgress))
    })

    scene.onEachTick(() => {
      for (const label of sphere.angleLabels) setBillboard(label, scene.camera)
      stateProbe.text = JSON.stringify({
        beat: state.beat,
        beatProgress: Number(state.beatProgress.toFixed(3)),
        timelineProgress: Number(state.timelineProgress.toFixed(3)),
        formula: typography.formula.latex
      })
    })

    exposeScene(scene, { flat, sphere, typography, stateProbe })
    addInspectionCameras(scene)
    registerVerifications(
      scene,
      frames,
      { flat, sphere, typography, stateProbe },
      { flatFormula, sphereFormula, comparisonFormula }
    )
  })
}

const createFlatTriangle = async (): Promise<FlatTriangle> => {
  const root = new THREE.Group()
  root.name = 'FlatTriangleConstruction'

  const vertices = [
    new THREE.Vector3(-3.1, -2.15, 0.08),
    new THREE.Vector3(3.1, -2.15, 0.08),
    new THREE.Vector3(0.65, 2.35, 0.08)
  ] as const
  const edgeMaterial = new THREE.MeshBasicMaterial({ color: COLORS.ivory })
  const triangle = new THREE.Group()
  triangle.name = 'FlatTriangleEdges'
  triangle.add(
    tubeFromPoints([vertices[0], vertices[1]], 0.055, edgeMaterial),
    tubeFromPoints([vertices[1], vertices[2]], 0.055, edgeMaterial),
    tubeFromPoints([vertices[2], vertices[0]], 0.055, edgeMaterial)
  )

  const symbols = [String.raw`\alpha`, String.raw`\beta`, String.raw`\gamma`]
  const colors = [COLORS.coral, COLORS.gold, COLORS.mint]
  const neighborPairs = [
    [2, 1],
    [0, 2],
    [1, 0]
  ] as const
  const angleItems: THREE.Group[] = []
  let angleSum = 0
  for (let index = 0; index < vertices.length; index++) {
    const vertex = vertices[index]
    const [firstIndex, secondIndex] = neighborPairs[index]
    const arc = planarAngleArc(vertex, vertices[firstIndex], vertices[secondIndex], 0.62)
    angleSum += arc.angle
    const item = new THREE.Group()
    item.name = `FlatAngle${index + 1}`
    item.add(
      tubeFromPoints(
        arc.points,
        0.045,
        new THREE.MeshBasicMaterial({ color: colors[index] })
      )
    )
    const label = await createLatex({
      latex: symbols[index],
      fontSize: 0.62,
      color: colors[index]
    })
    label.position.copy(vertex).addScaledVector(arc.midDirection, 1.02)
    label.position.z = 0.16
    item.add(label)
    item.visible = false
    angleItems.push(item)
  }

  for (const [index, vertex] of vertices.entries()) {
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.095, 20, 14),
      new THREE.MeshBasicMaterial({ color: colors[index] })
    )
    dot.position.copy(vertex)
    triangle.add(dot)
  }

  root.add(triangle, ...angleItems)
  root.visible = false
  return { root, triangle, angleItems, vertices, angleSum }
}

const createSphereTriangle = async (): Promise<SphereTriangle> => {
  const root = new THREE.Group()
  root.name = 'SphericalTriangleConstruction'

  const surface = new THREE.Mesh(
    new THREE.SphereGeometry(SPHERE_RADIUS, 44, 28),
    new THREE.MeshBasicMaterial({
      color: COLORS.wire,
      wireframe: true,
      transparent: true,
      opacity: 0.34,
      depthWrite: false
    })
  )
  surface.name = 'CurvedSphericalSurface'

  const grid = createSphereGrid(SPHERE_RADIUS + 0.015)
  const vertices = [
    new THREE.Vector3(0, SPHERE_RADIUS, 0),
    new THREE.Vector3(SPHERE_RADIUS, 0, 0),
    new THREE.Vector3(0, 0, SPHERE_RADIUS)
  ] as const

  const patch = createSphericalPatch(vertices[0], vertices[1], vertices[2], SPHERE_RADIUS + 0.025)
  patch.name = 'SphericalTrianglePatch'

  const edgePairs = [
    [0, 1],
    [1, 2],
    [2, 0]
  ] as const
  const edgeColors = [COLORS.coral, COLORS.gold, COLORS.mint]
  const edgeSamples = edgePairs.map(([from, to]) =>
    greatCircleSamples(vertices[from], vertices[to], SPHERE_RADIUS + ARC_LIFT, 48)
  )
  const edges = edgeSamples.map((points, index) => {
    const edge = tubeFromPoints(
      points,
      0.06,
      new THREE.MeshBasicMaterial({ color: edgeColors[index] })
    )
    edge.name = `GreatCircleEdge${index + 1}`
    return edge
  })

  const triangle = new THREE.Group()
  triangle.name = 'SphericalGreatCircleTriangle'
  triangle.add(patch, ...edges)
  for (const vertex of vertices) {
    const node = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 24, 16),
      new THREE.MeshBasicMaterial({ color: COLORS.ivory })
    )
    node.position.copy(vertex).setLength(SPHERE_RADIUS + ARC_LIFT)
    triangle.add(node)
  }
  triangle.visible = false

  const neighborPairs = [
    [1, 2],
    [0, 2],
    [0, 1]
  ] as const
  const angleItems: THREE.Group[] = []
  const angleLabels: TextVisual[] = []
  let angleSum = 0
  for (let index = 0; index < vertices.length; index++) {
    const vertex = vertices[index]
    const [firstIndex, secondIndex] = neighborPairs[index]
    const firstDirection = tangentDirection(vertex, vertices[firstIndex])
    const secondDirection = tangentDirection(vertex, vertices[secondIndex])
    angleSum += Math.acos(THREE.MathUtils.clamp(firstDirection.dot(secondDirection), -1, 1))

    const item = new THREE.Group()
    item.name = `SphericalRightAngle${index + 1}`
    item.add(rightAngleMarker(vertex, firstDirection, secondDirection, COLORS.ivory))
    const label = await createText({
      text: '90°',
      fontSize: 0.5,
      color: edgeColors[index],
      anchorX: 'center',
      anchorY: 'middle',
      textAlign: 'center',
      outlineColor: COLORS.background,
      outlineWidth: 0.055
    })
    const outward = vertex.clone().normalize()
    const tangentOffset = firstDirection.clone().add(secondDirection).normalize()
    label.position
      .copy(outward)
      .multiplyScalar(SPHERE_RADIUS + 1.05)
      .addScaledVector(tangentOffset, 0.38)
    item.add(label)
    item.visible = false
    angleItems.push(item)
    angleLabels.push(label)
  }

  root.add(surface, grid, triangle, ...angleItems)
  return {
    root,
    surface,
    grid,
    triangle,
    patch,
    edges,
    edgeSamples,
    angleItems,
    angleLabels,
    vertices,
    angleSum
  }
}

const createCameraTypography = async (): Promise<CameraTypography> => {
  const flatTitle = await createText({
    text: 'On a flat plane, the angles add to 180°.',
    fontSize: 0.62,
    color: COLORS.ivory,
    textAlign: 'center',
    anchorX: 'center',
    anchorY: 'top'
  })
  const sphereTitle = await createText({
    text: 'On a sphere, straight paths are great circles.',
    fontSize: 0.62,
    color: COLORS.ivory,
    textAlign: 'center',
    anchorX: 'center',
    anchorY: 'top'
  })
  const finalTitle = await createText({
    text: 'Curvature changes the angle sum.',
    fontSize: 0.62,
    color: COLORS.ivory,
    textAlign: 'center',
    anchorX: 'center',
    anchorY: 'top'
  })
  const formula = await createLatex({
    latex: String.raw`\dmClass{sum}{\alpha+\beta+\gamma}=180^\circ`,
    fontSize: 0.88,
    color: COLORS.ivory
  })
  return { flatTitle, sphereTitle, finalTitle, formula }
}

const createLights = (): THREE.Light[] => {
  const ambient = new THREE.HemisphereLight('#b9cbc5', '#050708', 1.35)
  const key = new THREE.DirectionalLight('#f1eadb', 3.4)
  key.position.set(8, 11, 12)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  const rim = new THREE.PointLight('#5f9c97', 14, 28, 2)
  rim.position.set(-2, 4, -8)
  return [ambient, key, rim]
}

const createSphereGrid = (radius: number): THREE.Group => {
  const root = new THREE.Group()
  root.name = 'SphericalCoordinateGrid'
  const material = new THREE.LineBasicMaterial({
    color: COLORS.wire,
    transparent: true,
    opacity: 0.14,
    depthWrite: false
  })
  for (let longitude = 0; longitude < Math.PI; longitude += Math.PI / 6) {
    const points: THREE.Vector3[] = []
    for (let step = 0; step <= 96; step++) {
      const angle = (step / 96) * Math.PI * 2
      points.push(
        new THREE.Vector3(
          Math.cos(longitude) * Math.cos(angle) * radius,
          Math.sin(angle) * radius,
          Math.sin(longitude) * Math.cos(angle) * radius
        )
      )
    }
    root.add(lineFromPoints(points, material))
  }
  for (const latitude of [-60, -30, 0, 30, 60]) {
    const radians = THREE.MathUtils.degToRad(latitude)
    const y = Math.sin(radians) * radius
    const ringRadius = Math.cos(radians) * radius
    const points: THREE.Vector3[] = []
    for (let step = 0; step <= 96; step++) {
      const angle = (step / 96) * Math.PI * 2
      points.push(new THREE.Vector3(Math.cos(angle) * ringRadius, y, Math.sin(angle) * ringRadius))
    }
    root.add(lineFromPoints(points, material))
  }
  return root
}

const createSphericalPatch = (
  north: THREE.Vector3,
  xAxis: THREE.Vector3,
  zAxis: THREE.Vector3,
  radius: number
): THREE.Mesh => {
  const divisions = 28
  const positions: number[] = []
  const indices: number[] = []
  const indexByCoordinate = new Map<string, number>()
  for (let i = 0; i <= divisions; i++) {
    for (let j = 0; j <= divisions - i; j++) {
      const point = north
        .clone()
        .multiplyScalar((divisions - i - j) / divisions)
        .addScaledVector(xAxis, i / divisions)
        .addScaledVector(zAxis, j / divisions)
        .normalize()
        .multiplyScalar(radius)
      indexByCoordinate.set(`${i}:${j}`, positions.length / 3)
      positions.push(point.x, point.y, point.z)
    }
  }
  const at = (i: number, j: number): number => indexByCoordinate.get(`${i}:${j}`)!
  for (let i = 0; i < divisions; i++) {
    for (let j = 0; j < divisions - i; j++) {
      indices.push(at(i, j), at(i + 1, j), at(i, j + 1))
      if (i + j < divisions - 1) {
        indices.push(at(i + 1, j), at(i + 1, j + 1), at(i, j + 1))
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: COLORS.blue,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  )
}

const planarAngleArc = (
  vertex: THREE.Vector3,
  firstNeighbor: THREE.Vector3,
  secondNeighbor: THREE.Vector3,
  radius: number
): { points: THREE.Vector3[]; midDirection: THREE.Vector3; angle: number } => {
  const first = firstNeighbor.clone().sub(vertex).normalize()
  const second = secondNeighbor.clone().sub(vertex).normalize()
  const firstAngle = Math.atan2(first.y, first.x)
  const secondAngle = Math.atan2(second.y, second.x)
  let delta = secondAngle - firstAngle
  while (delta > Math.PI) delta -= Math.PI * 2
  while (delta < -Math.PI) delta += Math.PI * 2
  const points: THREE.Vector3[] = []
  for (let step = 0; step <= 28; step++) {
    const angle = firstAngle + delta * (step / 28)
    points.push(
      vertex
        .clone()
        .add(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.08))
    )
  }
  const middle = firstAngle + delta * 0.5
  return {
    points,
    midDirection: new THREE.Vector3(Math.cos(middle), Math.sin(middle), 0),
    angle: Math.abs(delta)
  }
}

const greatCircleSamples = (
  from: THREE.Vector3,
  to: THREE.Vector3,
  radius: number,
  segments: number
): THREE.Vector3[] => {
  const first = from.clone().normalize()
  const second = to.clone().normalize()
  const angle = Math.acos(THREE.MathUtils.clamp(first.dot(second), -1, 1))
  const denominator = Math.sin(angle)
  const points: THREE.Vector3[] = []
  for (let step = 0; step <= segments; step++) {
    const progress = step / segments
    points.push(
      first
        .clone()
        .multiplyScalar(Math.sin((1 - progress) * angle) / denominator)
        .addScaledVector(second, Math.sin(progress * angle) / denominator)
        .normalize()
        .multiplyScalar(radius)
    )
  }
  return points
}

const tangentDirection = (vertex: THREE.Vector3, neighbor: THREE.Vector3): THREE.Vector3 => {
  const normal = vertex.clone().normalize()
  return neighbor
    .clone()
    .sub(normal.multiplyScalar(neighbor.dot(normal)))
    .normalize()
}

const rightAngleMarker = (
  vertex: THREE.Vector3,
  firstDirection: THREE.Vector3,
  secondDirection: THREE.Vector3,
  color: THREE.ColorRepresentation
): THREE.Group => {
  const base = vertex
    .clone()
    .normalize()
    .multiplyScalar(SPHERE_RADIUS + ARC_LIFT + 0.01)
  const size = 0.38
  const thickness = 0.034
  const firstPoint = base.clone().addScaledVector(firstDirection, size)
  const corner = firstPoint.clone().addScaledVector(secondDirection, size)
  const secondPoint = base.clone().addScaledVector(secondDirection, size)
  const material = new THREE.MeshBasicMaterial({ color })
  const marker = new THREE.Group()
  marker.name = 'TangentPlaneRightAngleMarker'
  marker.add(
    rectangularBar(firstPoint, corner, thickness, material),
    rectangularBar(corner, secondPoint, thickness, material)
  )
  return marker
}

const rectangularBar = (
  start: THREE.Vector3,
  end: THREE.Vector3,
  thickness: number,
  material: THREE.Material
): THREE.Mesh => {
  const direction = end.clone().sub(start)
  const length = direction.length()
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(length + thickness, thickness, thickness),
    material
  )
  bar.position.copy(start).add(end).multiplyScalar(0.5)
  bar.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction.normalize())
  return bar
}

const tubeFromPoints = (
  points: readonly THREE.Vector3[],
  radius: number,
  material: THREE.Material
): THREE.Mesh => {
  const path =
    points.length === 2
      ? new THREE.LineCurve3(points[0].clone(), points[1].clone())
      : new THREE.CatmullRomCurve3(
          points.map((point) => point.clone()),
          false,
          'centripetal'
        )
  return new THREE.Mesh(
    new THREE.TubeGeometry(path, Math.max(8, points.length * 2), radius, 10, false),
    material
  )
}

const lineFromPoints = (
  points: readonly THREE.Vector3[],
  material: THREE.LineBasicMaterial
): THREE.Line =>
  new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points.map((point) => point.clone())),
    material
  )

const setBillboard = (object: THREE.Object3D, cameraObject: THREE.Camera): void => {
  const cameraWorld = cameraObject.getWorldQuaternion(new THREE.Quaternion())
  const parentWorld = object.parent?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion()
  object.quaternion.copy(parentWorld.invert().multiply(cameraWorld))
}

const cameraRotation = (position: THREE.Vector3, target: THREE.Vector3): THREE.Quaternion =>
  new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().lookAt(position, target, new THREE.Vector3(0, 1, 0))
  )

const setBeatState = (state: ExplainerState, beat: string, beatProgress: number): void => {
  state.beat = beat
  state.beatProgress = beatProgress
}

const exposeScene = (scene: AnimatedScene, visuals: ExplainerVisuals): void => {
  scene.expose('spherical-explainer-flat-triangle', visuals.flat.triangle)
  scene.expose('spherical-explainer-sphere', visuals.sphere.surface)
  scene.expose('spherical-explainer-sphere-grid', visuals.sphere.grid)
  scene.expose('spherical-explainer-great-circle-triangle', visuals.sphere.triangle)
  scene.expose('spherical-explainer-spherical-patch', visuals.sphere.patch)
  scene.expose('spherical-explainer-camera-title-flat', visuals.typography.flatTitle)
  scene.expose('spherical-explainer-camera-title-sphere', visuals.typography.sphereTitle)
  scene.expose('spherical-explainer-camera-title-final', visuals.typography.finalTitle)
  scene.expose('spherical-explainer-camera-formula', visuals.typography.formula, {
    data: { semanticParts: true }
  })
  scene.expose('spherical-explainer-state', visuals.stateProbe)

  const worldRoots = [visuals.flat.root, visuals.sphere.root]
  scene.watchCollisions('spherical-explainer-camera-titles', visuals.typography.flatTitle, {
    ignore: worldRoots
  })
  scene.watchCollisions('spherical-explainer-camera-formula', visuals.typography.formula, {
    ignore: worldRoots
  })
}

const addInspectionCameras = (scene: AnimatedScene): void => {
  const overview = scene.exposeCamera(
    'comparison-overview',
    new THREE.PerspectiveCamera(40, scene.width / scene.height, 0.1, 200),
    {
      description: 'Front comparison of the Euclidean and spherical constructions',
      tags: ['comparison', 'flat', 'sphere']
    }
  )
  overview.position.copy(FINAL_CAMERA_POSITION)
  overview.quaternion.copy(cameraRotation(FINAL_CAMERA_POSITION, new THREE.Vector3(0, 0, 0)))

  const topology = scene.exposeCamera(
    'sphere-topology',
    new THREE.PerspectiveCamera(36, scene.width / scene.height, 0.1, 200),
    {
      description: 'Oblique inspection of the three quarter-great-circle edges',
      tags: ['sphere', 'great-circles', 'angles']
    }
  )
  topology.position.set(11.8, 8.5, 12.5)
  topology.quaternion.copy(cameraRotation(topology.position, SPHERE_CAMERA_TARGET))

  const polar = scene.exposeCamera(
    'sphere-polar',
    new THREE.PerspectiveCamera(38, scene.width / scene.height, 0.1, 200),
    {
      description: 'High polar view for checking the octant patch and equatorial edge',
      tags: ['sphere', 'polar', 'patch']
    }
  )
  polar.position.set(5, 15, 7)
  polar.quaternion.copy(cameraRotation(polar.position, SPHERE_POSITION))
}

const registerVerifications = (
  scene: AnimatedScene,
  frames: BeatFrames,
  visuals: ExplainerVisuals,
  formulas: { flatFormula: string; sphereFormula: string; comparisonFormula: string }
): void => {
  scene.verify(
    'spherical-explainer-duration-and-beats',
    { frames: { start: frames.end - 1, end: frames.end } },
    (context) => {
      context.assert(scene.totalSceneTicks === frames.end, 'The explainer must last 38 seconds', {
        durationInFrames: scene.totalSceneTicks,
        expectedFrames: frames.end
      })
      context.assert(context.beat?.name === 'compare', 'The final frame must belong to compare', {
        beat: context.beat
      })
    }
  )

  scene.verify(
    'spherical-explainer-flat-angle-sum',
    { frames: { start: frames.flatSum, end: frames.end } },
    (context) => {
      context.assert(
        Math.abs(visuals.flat.angleSum - Math.PI) < 1e-10,
        'The Euclidean triangle interior angles must sum exactly to pi',
        { frame: context.globalFrame, angleSum: visuals.flat.angleSum, expected: Math.PI }
      )
    }
  )

  scene.verify(
    'spherical-explainer-spherical-angle-sum',
    { frames: { start: frames.sphereAngles, end: frames.end } },
    (context) => {
      context.assert(
        Math.abs(visuals.sphere.angleSum - 1.5 * Math.PI) < 1e-10,
        'The octant triangle must have three right angles and sum to 270 degrees',
        {
          frame: context.globalFrame,
          angleSum: visuals.sphere.angleSum,
          expected: 1.5 * Math.PI
        }
      )
    }
  )

  scene.verify(
    'spherical-explainer-great-circle-geometry',
    { frames: { start: frames.greatCircles, end: frames.end } },
    (context) => {
      const expectedRadius = SPHERE_RADIUS + ARC_LIFT
      const radialError = Math.max(
        ...visuals.sphere.edgeSamples.flatMap((points) =>
          points.map((point) => Math.abs(point.length() - expectedRadius))
        )
      )
      const endpointError = Math.max(
        ...visuals.sphere.edgeSamples.flatMap((points, index) => {
          const pair = [
            [0, 1],
            [1, 2],
            [2, 0]
          ][index]
          return [
            points[0].distanceTo(
              visuals.sphere.vertices[pair[0]].clone().setLength(expectedRadius)
            ),
            points.at(-1)!.distanceTo(
              visuals.sphere.vertices[pair[1]].clone().setLength(expectedRadius)
            )
          ]
        })
      )
      context.assert(radialError < 1e-8, 'Every spherical edge sample must remain on one radius', {
        frame: context.globalFrame,
        radialError
      })
      context.assert(endpointError < 1e-8, 'Every great-circle edge must meet its authored vertices', {
        frame: context.globalFrame,
        endpointError
      })
    }
  )

  scene.verify(
    'spherical-explainer-camera-typography',
    { frames: { start: frames.flat, end: frames.end } },
    (context) => {
      const titles = [
        visuals.typography.flatTitle,
        visuals.typography.sphereTitle,
        visuals.typography.finalTitle
      ].filter((title) => context.isVisibleInHierarchy(title))
      const titleBounds = titles.map((title) => context.screenBounds(title))
      const formulaBounds = context.screenBounds(visuals.typography.formula)
      const titleAnchors = titles.map((title) =>
        projectedScreenPoint(title, scene.camera, context.viewport.width, context.viewport.height)
      )
      const formulaAnchor = projectedScreenPoint(
        visuals.typography.formula,
        scene.camera,
        context.viewport.width,
        context.viewport.height
      )
      const centered = [...titleAnchors, formulaAnchor].every(
        (point) => Math.abs(point.x - context.viewport.width / 2) <= 1e-6
      )
      context.assert(
        centered &&
          titleBounds.every((bounds) => insideViewport(bounds, 1280, 720, 24)) &&
          insideViewport(formulaBounds, 1280, 720, 24),
        'Camera-attached titles and formula must remain centered and inside the viewport',
        { frame: context.globalFrame, titleBounds, formulaBounds, titleAnchors, formulaAnchor }
      )
    }
  )

  scene.verify(
    'spherical-explainer-camera-ui-clear-of-world',
    { frames: { start: frames.flat, end: frames.end } },
    (context) => {
      const activeTitle = [
        visuals.typography.flatTitle,
        visuals.typography.sphereTitle,
        visuals.typography.finalTitle
      ].find((title) => context.isVisibleInHierarchy(title))
      const titleBounds = activeTitle ? context.screenBounds(activeTitle) : null
      const formulaBounds = context.screenBounds(visuals.typography.formula)
      const worldBounds = [visuals.flat.root, visuals.sphere.root]
        .filter((root) => context.isVisibleInHierarchy(root))
        .map((root) => context.screenBounds(root))
        .filter((bounds): bounds is ScreenBounds => bounds !== null)
      context.assert(
        worldBounds.every(
          (bounds) =>
            (titleBounds === null || titleBounds.bottom + 18 <= bounds.top) &&
            (formulaBounds === null || bounds.bottom + 18 <= formulaBounds.top)
        ),
        'World constructions must remain between the camera-attached title and formula',
        { frame: context.globalFrame, titleBounds, formulaBounds, worldBounds }
      )
    }
  )

  scene.verify(
    'spherical-explainer-formula-checkpoints',
    {
      frames: {
        start: frames.flatSum - 1,
        end: frames.flatSum
      }
    },
    (context) => {
      context.assert(
        visuals.typography.formula.latex === formulas.flatFormula,
        'The flat checkpoint must show the Euclidean angle sum',
        { frame: context.globalFrame, formula: visuals.typography.formula.latex }
      )
    }
  )
  scene.verify(
    'spherical-explainer-sphere-formula-checkpoint',
    { frames: { start: frames.compare - 1, end: frames.compare } },
    (context) => {
      context.assert(
        visuals.typography.formula.latex === formulas.sphereFormula,
        'The spherical checkpoint must show three right angles totaling 270 degrees',
        { frame: context.globalFrame, formula: visuals.typography.formula.latex }
      )
    }
  )
  scene.verify(
    'spherical-explainer-comparison-formula-checkpoint',
    { frames: { start: frames.end - 1, end: frames.end } },
    (context) => {
      context.assert(
        visuals.typography.formula.latex === formulas.comparisonFormula,
        'The final checkpoint must compare flat and spherical angle sums',
        { frame: context.globalFrame, formula: visuals.typography.formula.latex }
      )
    }
  )

  scene.verify(
    'spherical-explainer-final-comparison-separated',
    { frames: { start: frames.end - 1, end: frames.end } },
    (context) => {
      const flatBounds = context.screenBounds(visuals.flat.root)
      const sphereBounds = context.screenBounds(visuals.sphere.root)
      context.assert(
        flatBounds !== null &&
          sphereBounds !== null &&
          flatBounds.right + 24 <= sphereBounds.left,
        'The final flat and spherical constructions must read as two separate cases',
        { frame: context.globalFrame, flatBounds, sphereBounds, minimumGap: 24 }
      )
    }
  )

  verifyCameraPose(
    scene,
    'spherical-explainer-overview-camera',
    frames.greatCircles - 1,
    OVERVIEW_CAMERA_POSITION,
    cameraRotation(OVERVIEW_CAMERA_POSITION, new THREE.Vector3(0, 0, 0))
  )
  verifyCameraPose(
    scene,
    'spherical-explainer-sphere-camera',
    frames.compare - 1,
    SPHERE_CAMERA_POSITION,
    cameraRotation(SPHERE_CAMERA_POSITION, SPHERE_CAMERA_TARGET)
  )
  verifyCameraPose(
    scene,
    'spherical-explainer-final-camera',
    frames.end - 1,
    FINAL_CAMERA_POSITION,
    cameraRotation(FINAL_CAMERA_POSITION, new THREE.Vector3(0, 0, 0))
  )
}

const verifyCameraPose = (
  scene: AnimatedScene,
  id: string,
  frame: number,
  expectedPosition: THREE.Vector3,
  expectedRotation: THREE.Quaternion
): void => {
  scene.verify(id, { frames: { start: frame, end: frame + 1 } }, (context) => {
    const positionError = scene.camera.position.distanceTo(expectedPosition)
    const rotationError = scene.camera.quaternion.angleTo(expectedRotation)
    context.assert(
      positionError < 1e-6 && rotationError < 1e-6,
      'The authored camera pose must reach its exact endpoint',
      { frame: context.globalFrame, positionError, rotationError }
    )
  })
}

const insideViewport = (
  bounds: ScreenBounds | null,
  width: number,
  height: number,
  margin: number
): boolean =>
  bounds !== null &&
  bounds.left >= margin &&
  bounds.right <= width - margin &&
  bounds.top >= margin &&
  bounds.bottom <= height - margin

const projectedScreenPoint = (
  object: THREE.Object3D,
  cameraObject: THREE.Camera,
  width: number,
  height: number
): THREE.Vector2 => {
  const projected = object.getWorldPosition(new THREE.Vector3()).project(cameraObject)
  return new THREE.Vector2(((projected.x + 1) / 2) * width, ((1 - projected.y) / 2) * height)
}
