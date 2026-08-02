import { AnimatedScene, SpaceSetting, defineScene, type ScreenBounds } from 'definedmotion'
import { camera, fadeIn, fadeOut, wait } from 'definedmotion/animation'
import { createLatex, latex, type LatexVisual } from 'definedmotion/latex'
import {
  createCurve,
  createLine,
  createText,
  layout,
  type CurvePath,
  type CurveVisual,
  type TextVisual
} from 'definedmotion/rendering'
import * as THREE from 'three'

export default defineScene({
  id: 'azimuthal-wavefunction-explainer',
  name: 'Azimuthal Wavefunction Explainer',
  create: azimuthalWavefunctionExplainer
})

const COLORS = {
  background: '#040708',
  ivory: '#f0ece2',
  muted: '#879293',
  grid: '#26393a',
  mint: '#55dec9',
  paleMint: '#a2eee2',
  coral: '#e1876d',
  gold: '#e0bd57',
  blue: '#788ddd'
} as const

const CAMERA_DEPTH = -18
const WIDTH = 1280
const HEIGHT = 720
const DIAGRAM_DATA_DEPTH = 0.04

interface BeatFrames {
  cloud: number
  orbitals: number
  separation: number
  azimuth: number
  modes: number
  end: number
}

interface ExplainerState {
  beat: string
  beatProgress: number
  mode: number
}

interface ModeDiagram {
  root: THREE.Group
  positivePolar: CurveVisual
  negativePolar: CurveVisual
  positiveWave: CurveVisual
  negativeWave: CurveVisual
  modeLabels: LatexVisual[]
}

interface OrbitalVisual {
  root: THREE.Group
  points: THREE.Points
  caption: ReturnType<typeof layout.flex>
  label: TextVisual
  quantumLabel: LatexVisual
}

interface TypographyVisuals {
  roots: ReturnType<typeof layout.flex>[]
  titles: TextVisual[]
  formulas: LatexVisual[]
}

interface SceneVisuals {
  cloud: THREE.Group
  cloudPoints: THREE.Points
  cloudBillboards: TextVisual[]
  orbitals: THREE.Group
  orbitalItems: OrbitalVisual[]
  waveSphere: THREE.Group
  equatorSamples: readonly THREE.Vector3[]
  azimuth: ModeDiagram
  modes: THREE.Group
  modePlots: THREE.Group[]
  typographyRoots: ReturnType<typeof layout.flex>[]
  titles: TextVisual[]
  formulas: LatexVisual[]
  stateProbe: THREE.Group & { text: string }
}

export function azimuthalWavefunctionExplainer(): AnimatedScene {
  return new AnimatedScene(WIDTH, HEIGHT, SpaceSetting.ThreeDim, async (scene) => {
    scene.scene.background = new THREE.Color(COLORS.background)

    const background = createBackgroundDots()
    const cloudVisual = await createCloudVisual()
    const orbitalVisuals = await createOrbitalComparison()
    const sphereVisual = await createWavefunctionSphere()
    const azimuth = await createModeDiagram()
    const finalModes = await createFinalModes()
    const typography = await createTypography()

    cloudVisual.root.visible = false
    orbitalVisuals.root.visible = false
    sphereVisual.root.visible = false
    azimuth.root.visible = false
    finalModes.root.visible = false
    for (const item of [...typography.titles, ...typography.formulas]) item.visible = false

    const stateProbe = new THREE.Group() as THREE.Group & { text: string }
    stateProbe.name = 'AzimuthalWavefunctionState'
    stateProbe.text = ''

    scene.add(
      background,
      cloudVisual.root,
      orbitalVisuals.root,
      sphereVisual.root,
      azimuth.root,
      finalModes.root,
      stateProbe
    )
    for (const root of typography.roots) scene.addCameraAttachedUI(root)

    scene.camera.position.set(7, 3.5, 19)
    scene.camera.quaternion.copy(cameraRotation(scene.camera.position, new THREE.Vector3()))
    if (scene.camera instanceof THREE.PerspectiveCamera) {
      scene.camera.fov = 39
      scene.camera.updateProjectionMatrix()
    }

    const frames: BeatFrames = {
      cloud: 0,
      orbitals: scene.secondsToFrames(7),
      separation: scene.secondsToFrames(14),
      azimuth: scene.secondsToFrames(21),
      modes: scene.secondsToFrames(30),
      end: scene.secondsToFrames(37)
    }
    scene.timeline.defineBeats({
      cloud: { start: frames.cloud, end: frames.orbitals },
      orbitals: { start: frames.orbitals, end: frames.separation },
      separation: { start: frames.separation, end: frames.azimuth },
      azimuth: { start: frames.azimuth, end: frames.modes },
      modes: { start: frames.modes, end: frames.end }
    })

    const state: ExplainerState = { beat: 'cloud', beatProgress: 0, mode: 0 }

    scene.timeline.beat('cloud', (beat) => {
      scene.addAnims(
        fadeIn(cloudVisual.root, { duration: 1.1, easing: 'ease-out' }),
        fadeIn(typography.titles[0], { duration: 0.7, easing: 'ease-out' }),
        latex.write(typography.formulas[0], { duration: 1.2, easing: 'linear' }),
        camera.moveToPose(
          scene.camera,
          {
            position: new THREE.Vector3(-5.5, 2.8, 20),
            rotation: cameraRotation(new THREE.Vector3(-5.5, 2.8, 20), new THREE.Vector3())
          },
          { duration: 6, easing: 'ease-in-out', space: 'world' }
        )
      )
      scene.addAnims(wait(0.7))
      beat.onEachTick(({ beatProgress }) => setBeatState(state, 'cloud', beatProgress))
    })

    scene.timeline.beat('orbitals', (beat) => {
      const transitionStart = scene.getTimelinePointer()
      scene.addAnims(
        fadeOut(cloudVisual.root, { duration: 0.55, easing: 'ease-in-out' }),
        fadeIn(orbitalVisuals.root, { duration: 1, easing: 'ease-out' }),
        camera.moveToPose(
          scene.camera,
          {
            position: new THREE.Vector3(0, 0.6, 22),
            rotation: cameraRotation(new THREE.Vector3(0, 0.6, 22), new THREE.Vector3())
          },
          { duration: 1.2, easing: 'ease-in-out', space: 'world' }
        )
      )
      addTypographySwap(scene, transitionStart, typography, 0, 1)
      scene.addAnims(wait(5.75))
      beat.onEachTick(({ beatProgress }) => setBeatState(state, 'orbitals', beatProgress))
    })

    scene.timeline.beat('separation', (beat) => {
      scene.addAnims(
        camera.moveToPose(
          scene.camera,
          {
            position: new THREE.Vector3(6.2, 3.2, 20),
            rotation: cameraRotation(new THREE.Vector3(6.2, 3.2, 20), new THREE.Vector3())
          },
          { duration: 0.9, easing: 'ease-in-out', space: 'world' }
        )
      )
      const transitionStart = scene.getTimelinePointer()
      scene.addAnims(
        fadeOut(orbitalVisuals.root, { duration: 0.75, easing: 'ease-in-out' }),
        fadeIn(sphereVisual.root, { duration: 0.75, easing: 'ease-out' })
      )
      addTypographySwap(scene, transitionStart, typography, 1, 2)
      scene.addAnims(wait(0.45))
      scene.addAnims(latex.mark(typography.formulas[2].part('azimuth'), { color: COLORS.gold }))
      scene.addAnims(wait(2.4))
      beat.onEachTick(({ beatProgress }) => setBeatState(state, 'separation', beatProgress))
    })

    scene.timeline.beat('azimuth', (beat) => {
      const transitionStart = scene.getTimelinePointer()
      scene.addAnims(
        fadeOut(sphereVisual.root, { duration: 0.55, easing: 'ease-in-out' }),
        fadeIn(azimuth.root, { duration: 0.9, easing: 'ease-out' }),
        camera.moveToPose(
          scene.camera,
          {
            position: new THREE.Vector3(0, 0.3, 22),
            rotation: cameraRotation(new THREE.Vector3(0, 0.3, 22), new THREE.Vector3())
          },
          { duration: 1.1, easing: 'ease-in-out', space: 'world' }
        )
      )
      addTypographySwap(scene, transitionStart, typography, 2, 3)
      scene.addAnims(wait(1.15))
      scene.addAnims(latex.mark(typography.formulas[3].part('real'), { color: COLORS.gold }))
      scene.addAnims(wait(4.3))
      beat.onEachTick(({ beatProgress }) => setBeatState(state, 'azimuth', beatProgress))
    })

    scene.timeline.beat('modes', (beat) => {
      const transitionStart = scene.getTimelinePointer()
      scene.addAnims(
        fadeOut(azimuth.root, { duration: 0.55, easing: 'ease-in-out' }),
        fadeIn(finalModes.root, { duration: 0.95, easing: 'ease-out' })
      )
      addTypographySwap(scene, transitionStart, typography, 3, 4)
      scene.addAnims(wait(6))
      beat.onEachTick(({ beatProgress }) => setBeatState(state, 'modes', beatProgress))
    })

    scene.onEachTick((globalFrame) => {
      cloudVisual.points.rotation.y = globalFrame * 0.006
      cloudVisual.points.rotation.x = 0.12 * Math.sin(globalFrame / 95)
      for (const [index, orbital] of orbitalVisuals.items.entries()) {
        orbital.points.rotation.y = globalFrame * (0.0035 + index * 0.0007)
        orbital.points.rotation.x = 0.2 + 0.08 * Math.sin(globalFrame / 110 + index)
      }
      sphereVisual.root.rotation.y = 0.24 + globalFrame * 0.0022

      const azimuthProgress = THREE.MathUtils.clamp(
        (globalFrame - frames.azimuth) / (frames.modes - frames.azimuth - 1),
        0,
        1
      )
      state.mode = modeFromProgress(azimuthProgress)
      updateModeDiagram(azimuth, state.mode)
      showNearestModeLabel(azimuth.modeLabels, state.mode)

      for (const label of cloudVisual.billboards) setBillboard(label, scene.camera)
      stateProbe.text = JSON.stringify({
        beat: state.beat,
        beatProgress: Number(state.beatProgress.toFixed(3)),
        mode: Number(state.mode.toFixed(3))
      })
    })

    const visuals: SceneVisuals = {
      cloud: cloudVisual.root,
      cloudPoints: cloudVisual.points,
      cloudBillboards: cloudVisual.billboards,
      orbitals: orbitalVisuals.root,
      orbitalItems: orbitalVisuals.items,
      waveSphere: sphereVisual.root,
      equatorSamples: sphereVisual.equatorSamples,
      azimuth,
      modes: finalModes.root,
      modePlots: finalModes.plots,
      typographyRoots: typography.roots,
      titles: typography.titles,
      formulas: typography.formulas,
      stateProbe
    }
    exposeScene(scene, visuals)
    addInspectionCameras(scene)
    registerVerifications(scene, frames, visuals)
  })
}

const createTypography = async (): Promise<TypographyVisuals> => {
  const titleTexts = [
    'Probability is a shape, not an orbit.',
    'Real orbitals reveal nodes and sign.',
    'Azimuth is motion around an axis.',
    'One number controls both views.',
    'Integer modes close after one full turn.'
  ]
  const formulaTexts = [
    String.raw`\left|\psi(r,\theta,\phi)\right|^2`,
    String.raw`s\;(m=0)\qquad p_z\;(m=1)\qquad d_{xz}\;(m=2)`,
    String.raw`\psi(r,\theta,\phi)=R(r)\,\Theta(\theta)\,\dmClass{azimuth}{\Phi(\phi)}`,
    String.raw`\Phi(\phi)=e^{im\phi}=\dmClass{real}{\cos(m\phi)}+i\sin(m\phi)`,
    String.raw`\Phi(\phi+2\pi)=\Phi(\phi)\quad\Longrightarrow\quad m\in\mathbb{Z}`
  ]
  const roots: ReturnType<typeof layout.flex>[] = []
  const titles: TextVisual[] = []
  const formulas: LatexVisual[] = []
  for (const [index, text] of titleTexts.entries()) {
    const title = await createText({
      text,
      fontSize: 0.62,
      color: COLORS.ivory,
      anchorX: 'center',
      anchorY: 'top',
      textAlign: 'center'
    })
    const formula = await createLatex({
      latex: formulaTexts[index],
      fontSize: 0.68,
      color: COLORS.ivory
    })
    const root = layout.flex(
      {
        flexDirection: 'column',
        height: 11.6,
        alignItems: 'center',
        justifyContent: 'space-between',
        anchorX: 'center',
        anchorY: 'middle'
      },
      [title, formula]
    )
    root.name = `AzimuthalTypography${index}`
    root.position.set(0, 0, CAMERA_DEPTH)
    roots.push(root)
    titles.push(title)
    formulas.push(formula)
  }
  return { roots, titles, formulas }
}

const createBackgroundDots = (): THREE.Points => {
  const random = mulberry32(9517)
  const count = 260
  const positions = new Float32Array(count * 3)
  for (let index = 0; index < count; index++) {
    positions[index * 3] = (random() - 0.5) * 31
    positions[index * 3 + 1] = (random() - 0.5) * 18
    positions[index * 3 + 2] = -5 - random() * 2
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: COLORS.muted,
      size: 0.045,
      transparent: true,
      opacity: 0.17,
      depthWrite: false,
      sizeAttenuation: true
    })
  )
  points.name = 'QuietReferenceDots'
  return points
}

const createCloudVisual = async (): Promise<{
  root: THREE.Group
  points: THREE.Points
  billboards: TextVisual[]
}> => {
  const root = new THREE.Group()
  root.name = 'RotatingProbabilityCloud'
  root.position.y = -0.05
  const points = createOrbitalPoints('s', 12000, 1201)
  points.scale.setScalar(1.55)
  const axes = await createAxes3D(4.35, true)
  root.add(points, axes.root)
  return { root, points, billboards: axes.labels }
}

const createOrbitalComparison = async (): Promise<{
  root: THREE.Group
  items: OrbitalVisual[]
}> => {
  const root = new THREE.Group()
  root.name = 'RealOrbitalComparison'
  root.position.y = 0.15
  const specs = [
    { kind: 's' as const, x: -6.4, label: 's-orbital', quantum: String.raw`m=0` },
    { kind: 'p' as const, x: 0, label: 'p-orbital', quantum: String.raw`m=1` },
    { kind: 'd' as const, x: 6.4, label: 'd-orbital', quantum: String.raw`m=2` }
  ]
  const items: OrbitalVisual[] = []
  for (const [index, spec] of specs.entries()) {
    const itemRoot = new THREE.Group()
    itemRoot.name = `${spec.kind.toUpperCase()}OrbitalConstruction`
    itemRoot.position.set(spec.x, 0.35, 0)
    itemRoot.scale.setScalar(1.2)
    const points = createOrbitalPoints(spec.kind, 6200, 4100 + index * 911)
    points.scale.setScalar(spec.kind === 's' ? 0.95 : 1.02)
    const axes = await createAxes3D(2.75, false)
    axes.root.scale.setScalar(0.78)
    const label = await createText({
      text: spec.label,
      fontSize: 0.46,
      color: COLORS.ivory,
      anchorX: 'center',
      anchorY: 'top',
      textAlign: 'center'
    })
    const quantumLabel = await createLatex({
      latex: spec.quantum,
      fontSize: 0.48,
      color: spec.kind === 's' ? COLORS.mint : spec.kind === 'p' ? COLORS.coral : COLORS.gold
    })
    const caption = layout.flex(
      {
        name: `${spec.kind.toUpperCase()}OrbitalCaption`,
        flexDirection: 'column',
        gap: 0.28,
        alignItems: 'center',
        anchorX: 'center',
        anchorY: 'top'
      },
      [label, quantumLabel]
    )
    caption.position.set(0, -2.85, 0.2)
    itemRoot.add(points, axes.root, caption)
    root.add(itemRoot)
    items.push({ root: itemRoot, points, caption, label, quantumLabel })
  }
  return { root, items }
}

const createOrbitalPoints = (kind: 's' | 'p' | 'd', count: number, seed: number): THREE.Points => {
  const random = mulberry32(seed)
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const mint = new THREE.Color(COLORS.paleMint)
  const coral = new THREE.Color(COLORS.coral)
  for (let index = 0; index < count; index++) {
    let point: THREE.Vector3
    let color = mint
    if (kind === 's') {
      const direction = randomUnitVector(random)
      const radius = 2.65 * Math.pow(random(), 1.75)
      point = direction.multiplyScalar(radius)
    } else if (kind === 'p') {
      const sign = random() < 0.5 ? -1 : 1
      point = new THREE.Vector3(
        normalRandom(random) * 0.42,
        normalRandom(random) * 0.42,
        sign * (0.58 + Math.abs(normalRandom(random)) * 0.75)
      )
      color = sign > 0 ? coral : mint
    } else {
      const signX = random() < 0.5 ? -1 : 1
      const signZ = random() < 0.5 ? -1 : 1
      point = new THREE.Vector3(
        signX * (0.65 + Math.abs(normalRandom(random)) * 0.58),
        normalRandom(random) * 0.32,
        signZ * (0.65 + Math.abs(normalRandom(random)) * 0.58)
      )
      color = signX * signZ > 0 ? coral : mint
    }
    positions.set(point.toArray(), index * 3)
    colors.set(color.toArray(), index * 3)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.computeBoundingSphere()
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: kind === 's' ? 0.055 : 0.06,
      vertexColors: true,
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    })
  )
  points.name = `${kind.toUpperCase()}OrbitalProbabilityPoints`
  return points
}

const createAxes3D = async (
  length: number,
  includeLabels: boolean
): Promise<{ root: THREE.Group; labels: TextVisual[] }> => {
  const root = new THREE.Group()
  root.name = 'CoordinateAxes'
  const axes = [
    { direction: new THREE.Vector3(1, 0, 0), label: 'x' },
    { direction: new THREE.Vector3(0, 1, 0), label: 'y' },
    { direction: new THREE.Vector3(0, 0, 1), label: 'z' }
  ]
  const labels: TextVisual[] = []
  for (const axis of axes) {
    const end = axis.direction.clone().multiplyScalar(length)
    root.add(
      primitiveLine(axis.direction.clone().multiplyScalar(-length * 0.55), end, COLORS.muted, 0.68)
    )
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.11, 0.34, 12),
      new THREE.MeshBasicMaterial({ color: COLORS.muted })
    )
    cone.position.copy(end)
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.direction)
    root.add(cone)
    if (includeLabels) {
      const label = await createText({
        text: axis.label,
        fontSize: 0.38,
        color: COLORS.ivory,
        anchorX: 'center',
        anchorY: 'middle',
        textAlign: 'center',
        outlineColor: COLORS.background,
        outlineWidth: 0.035
      })
      label.position.copy(end).addScaledVector(axis.direction, 0.38)
      root.add(label)
      labels.push(label)
    }
  }
  return { root, labels }
}

const createWavefunctionSphere = async (): Promise<{
  root: THREE.Group
  equatorSamples: readonly THREE.Vector3[]
}> => {
  const root = new THREE.Group()
  root.name = 'SeparatedWavefunctionSphere'
  root.position.y = 0.45
  root.scale.setScalar(1)
  root.rotation.x = 0.43
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(3.35, 44, 28),
    new THREE.MeshBasicMaterial({
      color: COLORS.blue,
      wireframe: true,
      transparent: true,
      opacity: 0.3
    })
  )
  const equatorSamples = circlePoints(3.39, 160, 'xz')
  const equator = tubeFromPoints(
    equatorSamples,
    0.065,
    new THREE.MeshBasicMaterial({ color: COLORS.mint })
  )
  root.add(
    sphere,
    equator,
    primitiveLine(new THREE.Vector3(-4.4, 0, 0), new THREE.Vector3(4.4, 0, 0), COLORS.ivory, 0.58),
    primitiveLine(new THREE.Vector3(0, -4.2, 0), new THREE.Vector3(0, 4.2, 0), COLORS.ivory, 0.58)
  )
  const phi = await createLatex({ latex: String.raw`\phi`, fontSize: 0.5, color: COLORS.gold })
  phi.position.set(3.75, 0.4, 0.2)
  root.add(phi)
  return { root, equatorSamples }
}

const createModeDiagram = async (): Promise<ModeDiagram> => {
  const root = new THREE.Group()
  root.name = 'LiveAzimuthalModeDiagram'
  root.scale.setScalar(1.22)

  const polarRoot = new THREE.Group()
  polarRoot.name = 'PolarModeView'
  polarRoot.position.set(-3.75, -0.15, 0)
  const waveRoot = new THREE.Group()
  waveRoot.name = 'CosineTraceView'
  waveRoot.position.set(3.45, 0.1, 0)

  polarRoot.add(
    primitiveLine(new THREE.Vector3(-2.75, 0, 0), new THREE.Vector3(2.75, 0, 0), COLORS.grid, 0.8),
    primitiveLine(new THREE.Vector3(0, -2.75, 0), new THREE.Vector3(0, 2.75, 0), COLORS.grid, 0.8),
    tubeFromPoints(
      circlePoints(2.35, 128, 'xy'),
      0.018,
      new THREE.MeshBasicMaterial({ color: COLORS.grid })
    )
  )
  waveRoot.add(
    primitiveLine(new THREE.Vector3(-3, 0, 0), new THREE.Vector3(3, 0, 0), COLORS.grid, 0.8),
    primitiveLine(new THREE.Vector3(-3, -1.55, 0), new THREE.Vector3(-3, 1.55, 0), COLORS.grid, 0.8)
  )

  const positivePolar = createCurve({
    ...polarCurvePath(0, 2.32, 'positive'),
    sampleCount: 289,
    stroke: { color: COLORS.mint, width: 0.045 }
  })
  const negativePolar = createCurve({
    ...polarCurvePath(0, 2.32, 'negative'),
    sampleCount: 289,
    stroke: {
      color: COLORS.mint,
      width: 0.04,
      opacity: 0.5,
      dash: { length: 0.15, gap: 0.12 }
    }
  })
  const positiveWave = createCurve({
    ...waveCurvePath(0, 'positive'),
    sampleCount: 289,
    stroke: { color: COLORS.mint, width: 0.035 }
  })
  const negativeWave = createCurve({
    ...waveCurvePath(0, 'negative'),
    sampleCount: 289,
    stroke: {
      color: COLORS.mint,
      width: 0.032,
      opacity: 0.5,
      dash: { length: 0.15, gap: 0.12 }
    }
  })
  positivePolar.position.z = DIAGRAM_DATA_DEPTH
  negativePolar.position.z = DIAGRAM_DATA_DEPTH
  positiveWave.position.z = DIAGRAM_DATA_DEPTH
  negativeWave.position.z = DIAGRAM_DATA_DEPTH
  polarRoot.add(positivePolar, negativePolar)
  waveRoot.add(positiveWave, negativeWave)

  const polarLabel = await createText({
    text: 'polar amplitude',
    fontSize: 0.4,
    color: COLORS.muted,
    anchorX: 'center',
    anchorY: 'top'
  })
  polarLabel.position.set(0, 3.05, 0)
  const waveLabel = await createText({
    text: 'real part across one turn',
    fontSize: 0.4,
    color: COLORS.muted,
    anchorX: 'center',
    anchorY: 'top'
  })
  waveLabel.position.set(0, 2.15, 0)
  polarRoot.add(polarLabel)
  waveRoot.add(waveLabel)

  const modeLabels: LatexVisual[] = []
  for (const value of [0, 1, 2, 2.5, 3]) {
    const label = await createLatex({
      latex: String.raw`m=${value}`,
      fontSize: 0.58,
      color: value === 2.5 ? COLORS.gold : COLORS.ivory
    })
    label.position.set(3.45, -2.55, 0.2)
    label.visible = false
    root.add(label)
    modeLabels.push(label)
  }
  root.add(polarRoot, waveRoot)
  const diagram = {
    root,
    positivePolar,
    negativePolar,
    positiveWave,
    negativeWave,
    modeLabels
  }
  updateModeDiagram(diagram, 0)
  showNearestModeLabel(modeLabels, 0)
  return diagram
}

const createFinalModes = async (): Promise<{
  root: THREE.Group
  plots: THREE.Group[]
}> => {
  const root = new THREE.Group()
  root.name = 'ClosedIntegerModeComparison'
  root.position.y = 0.05
  root.scale.setScalar(1.32)
  const plots: THREE.Group[] = []
  const values = [0, 1, 2, 3]
  for (const [index, value] of values.entries()) {
    const plot = new THREE.Group()
    plot.name = `ClosedMode${value}`
    plot.position.set(-5.05 + index * 3.37, 0.25, 0)
    const quiet = new THREE.MeshBasicMaterial({ color: COLORS.grid })
    plot.add(tubeFromPoints(circlePoints(1.22, 96, 'xy'), 0.012, quiet))
    const positive = createCurve({
      ...polarCurvePath(value, 1.2, 'positive'),
      sampleCount: 221,
      stroke: { color: COLORS.mint, width: 0.035 }
    })
    const negative = createCurve({
      ...polarCurvePath(value, 1.2, 'negative'),
      sampleCount: 221,
      stroke: {
        color: COLORS.mint,
        width: 0.03,
        opacity: 0.45,
        dash: { length: 0.12, gap: 0.1 }
      }
    })
    positive.position.z = DIAGRAM_DATA_DEPTH
    negative.position.z = DIAGRAM_DATA_DEPTH
    plot.add(positive, negative)
    const label = await createLatex({
      latex: String.raw`m=${value}`,
      fontSize: 0.48,
      color: value === 0 ? COLORS.ivory : [COLORS.coral, COLORS.gold, COLORS.mint][index - 1]
    })
    label.position.set(0, -1.72, 0.2)
    plot.add(label)
    root.add(plot)
    plots.push(plot)
  }
  return { root, plots }
}

const updateModeDiagram = (diagram: ModeDiagram, mode: number): void => {
  diagram.positivePolar.setPath(polarCurvePath(mode, 2.32, 'positive'))
  diagram.negativePolar.setPath(polarCurvePath(mode, 2.32, 'negative'))
  diagram.positiveWave.setPath(waveCurvePath(mode, 'positive'))
  diagram.negativeWave.setPath(waveCurvePath(mode, 'negative'))
}

type AmplitudeSign = 'positive' | 'negative'

const polarCurvePath = (mode: number, radius: number, sign: AmplitudeSign): CurvePath => ({
  domain: [0, Math.PI * 2],
  pointAt(phi) {
    const radial = Math.cos(mode * phi)
    return new THREE.Vector3(Math.cos(phi) * radial * radius, Math.sin(phi) * radial * radius, 0)
  },
  visibleAt(phi) {
    const amplitude = Math.cos(mode * phi)
    return sign === 'positive' ? amplitude >= 0 : amplitude < 0
  }
})

const waveCurvePath = (mode: number, sign: AmplitudeSign): CurvePath => ({
  domain: [0, Math.PI * 2],
  pointAt(phi) {
    return new THREE.Vector3(-3 + (phi / (Math.PI * 2)) * 6, Math.cos(mode * phi) * 1.35, 0)
  },
  visibleAt(phi) {
    const amplitude = Math.cos(mode * phi)
    return sign === 'positive' ? amplitude >= 0 : amplitude < 0
  }
})

const modeFromProgress = (progress: number): number => {
  const stops = [0, 1, 2, 2.5, 3]
  const scaled = progress * (stops.length - 1)
  const index = Math.min(stops.length - 2, Math.floor(scaled))
  const local = scaled - index
  const eased = local < 0.25 ? 0 : local > 0.75 ? 1 : THREE.MathUtils.smoothstep(local, 0.25, 0.75)
  return THREE.MathUtils.lerp(stops[index], stops[index + 1], eased)
}

const showNearestModeLabel = (labels: readonly LatexVisual[], mode: number): void => {
  const values = [0, 1, 2, 2.5, 3]
  let nearest = 0
  let distance = Number.POSITIVE_INFINITY
  for (let index = 0; index < values.length; index++) {
    const candidate = Math.abs(mode - values[index])
    if (candidate < distance) {
      nearest = index
      distance = candidate
    }
  }
  for (const [index, label] of labels.entries()) label.visible = index === nearest
}

const circlePoints = (radius: number, segments: number, plane: 'xy' | 'xz'): THREE.Vector3[] => {
  const points: THREE.Vector3[] = []
  for (let index = 0; index <= segments; index++) {
    const angle = (index / segments) * Math.PI * 2
    points.push(
      plane === 'xy'
        ? new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0)
        : new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
    )
  }
  return points
}

const tubeFromPoints = (
  points: readonly THREE.Vector3[],
  radius: number,
  material: THREE.Material
): THREE.Mesh => {
  const path = new THREE.CatmullRomCurve3(
    points.map((point) => point.clone()),
    false,
    'centripetal'
  )
  return new THREE.Mesh(
    new THREE.TubeGeometry(path, Math.max(24, points.length * 2), radius, 8, false),
    material
  )
}

const primitiveLine = (
  point1: THREE.Vector3,
  point2: THREE.Vector3,
  color: THREE.ColorRepresentation,
  opacity = 1
): ReturnType<typeof createLine> => {
  const line = createLine({ point1, point2, color })
  const material = line.material as THREE.LineBasicMaterial
  material.transparent = opacity < 1
  material.opacity = opacity
  return line
}

const randomUnitVector = (random: () => number): THREE.Vector3 => {
  const z = random() * 2 - 1
  const angle = random() * Math.PI * 2
  const radius = Math.sqrt(1 - z * z)
  return new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, z)
}

const normalRandom = (random: () => number): number => {
  const u = Math.max(random(), 1e-9)
  const v = random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v)
}

const mulberry32 = (seed: number): (() => number) => {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let result = value
    result = Math.imul(result ^ (result >>> 15), result | 1)
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61)
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296
  }
}

const setBillboard = (object: THREE.Object3D, cameraObject: THREE.Camera): void => {
  const cameraWorld = cameraObject.getWorldQuaternion(new THREE.Quaternion())
  const parentWorld =
    object.parent?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion()
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

const addTypographySwap = (
  scene: AnimatedScene,
  startFrame: number,
  typography: TypographyVisuals,
  outgoingIndex: number,
  incomingIndex: number
): void => {
  const resumeFrame = scene.getTimelinePointer()
  scene.setTimelinePointer(startFrame)
  scene.addAnims(
    fadeOut(typography.titles[outgoingIndex], { duration: 0.28, easing: 'ease-in-out' }),
    fadeOut(typography.formulas[outgoingIndex], { duration: 0.28, easing: 'ease-in-out' })
  )
  scene.addAnims(
    fadeIn(typography.titles[incomingIndex], { duration: 0.42, easing: 'ease-out' }),
    fadeIn(typography.formulas[incomingIndex], { duration: 0.42, easing: 'ease-out' })
  )
  scene.setTimelinePointer(resumeFrame)
}

const exposeScene = (scene: AnimatedScene, visuals: SceneVisuals): void => {
  scene.expose('azimuthal-cloud', visuals.cloudPoints)
  for (const [index, orbital] of visuals.orbitalItems.entries()) {
    scene.expose(`azimuthal-orbital-${index}`, orbital.points)
    scene.expose(`azimuthal-orbital-caption-${index}`, orbital.caption)
  }
  scene.expose('azimuthal-wavefunction-sphere', visuals.waveSphere)
  scene.expose('azimuthal-live-polar', visuals.azimuth.root)
  scene.expose('azimuthal-closed-modes', visuals.modes)
  for (const [index, title] of visuals.titles.entries()) {
    scene.expose(`azimuthal-typography-layout-${index}`, visuals.typographyRoots[index])
    scene.expose(`azimuthal-title-${index}`, title)
  }
  for (const [index, formula] of visuals.formulas.entries()) {
    scene.expose(`azimuthal-formula-${index}`, formula, { data: { semanticParts: true } })
  }
  scene.expose('azimuthal-state', visuals.stateProbe)
}

const addInspectionCameras = (scene: AnimatedScene): void => {
  const cloud = scene.exposeCamera(
    'orbital-cloud-oblique',
    new THREE.PerspectiveCamera(38, scene.width / scene.height, 0.1, 200),
    {
      description: 'Oblique inspection of the deterministic probability cloud and axes',
      tags: ['particles', 'orbital', '3d']
    }
  )
  cloud.position.set(8, 5, 15)
  cloud.quaternion.copy(cameraRotation(cloud.position, new THREE.Vector3()))

  const row = scene.exposeCamera(
    'real-orbitals-row',
    new THREE.PerspectiveCamera(40, scene.width / scene.height, 0.1, 200),
    {
      description: 'Front inspection of the s, p, and d probability clouds',
      tags: ['particles', 'comparison', 'orbitals']
    }
  )
  row.position.set(0, 0.5, 22)
  row.quaternion.copy(cameraRotation(row.position, new THREE.Vector3()))

  const polar = scene.exposeCamera(
    'azimuthal-polar-detail',
    new THREE.PerspectiveCamera(34, scene.width / scene.height, 0.1, 200),
    {
      description: 'Front detail of the live polar and cosine relationship',
      tags: ['azimuthal', 'polar', 'wave']
    }
  )
  polar.position.set(0, 0.2, 18)
  polar.quaternion.copy(cameraRotation(polar.position, new THREE.Vector3()))
}

const registerVerifications = (
  scene: AnimatedScene,
  frames: BeatFrames,
  visuals: SceneVisuals
): void => {
  scene.verify(
    'azimuthal-duration-and-beats',
    { frames: { start: frames.end - 1, end: frames.end } },
    (context) => {
      context.assert(scene.totalSceneTicks === frames.end, 'The explainer must last 37 seconds', {
        durationInFrames: scene.totalSceneTicks,
        expectedFrames: frames.end
      })
      context.assert(context.beat?.name === 'modes', 'The final frame must belong to modes', {
        beat: context.beat
      })
    }
  )

  scene.verify(
    'azimuthal-particle-contract',
    { frames: { start: frames.cloud, end: frames.end } },
    (context) => {
      const clouds = [visuals.cloudPoints, ...visuals.orbitalItems.map((item) => item.points)]
      const counts = clouds.map(
        (points) => (points.geometry.getAttribute('position') as THREE.BufferAttribute).count
      )
      const finite = clouds.every((points) => {
        const array = (points.geometry.getAttribute('position') as THREE.BufferAttribute).array
        return Array.from(array).every(Number.isFinite)
      })
      context.assert(
        counts[0] === 12000 && counts.slice(1).every((count) => count === 6200) && finite,
        'All orbital clouds must retain deterministic finite particle buffers',
        { frame: context.globalFrame, counts, finite }
      )
    }
  )

  scene.verify(
    'azimuthal-layout-contract',
    { frames: { start: frames.orbitals + 1, end: frames.separation } },
    (context) => {
      const captions = visuals.orbitalItems.map((item) => context.screenBounds(item.caption))
      const labelBounds = visuals.orbitalItems.map((item) => context.screenBounds(item.label))
      const quantumBounds = visuals.orbitalItems.map((item) =>
        context.screenBounds(item.quantumLabel)
      )
      const gaps = labelBounds.map((label, index) =>
        label && quantumBounds[index] ? quantumBounds[index]!.top - label.bottom : null
      )
      const contained = captions.every((caption, index) => {
        const label = labelBounds[index]
        const quantum = quantumBounds[index]
        if (!caption || !label || !quantum) return false
        return (
          caption.left <= Math.min(label.left, quantum.left) + 1 &&
          caption.right >= Math.max(label.right, quantum.right) - 1 &&
          caption.top <= Math.min(label.top, quantum.top) + 1 &&
          caption.bottom >= Math.max(label.bottom, quantum.bottom) - 1
        )
      })
      const layoutBacked =
        visuals.orbitalItems.every(
          (item) => item.caption.userData.definedMotionVisual === 'layout'
        ) && visuals.typographyRoots.every((root) => root.userData.definedMotionVisual === 'layout')
      context.assert(
        layoutBacked &&
          captions.every((bounds) => bounds !== null) &&
          gaps.every((gap) => gap !== null && gap >= 6) &&
          contained,
        'Orbital captions and camera typography must use measured layout with readable caption gaps',
        {
          frame: context.globalFrame,
          captions,
          labelBounds,
          quantumBounds,
          gaps,
          contained,
          layoutBacked
        }
      )
    }
  )

  scene.verify(
    'azimuthal-equator-contract',
    { frames: { start: frames.separation, end: frames.end } },
    (context) => {
      const radialError = Math.max(
        ...visuals.equatorSamples.map((point) => Math.abs(point.length() - 3.39))
      )
      const verticalError = Math.max(...visuals.equatorSamples.map((point) => Math.abs(point.y)))
      context.assert(
        radialError < 1e-8 && verticalError < 1e-10,
        'The highlighted azimuthal path must be a closed equatorial circle',
        { frame: context.globalFrame, radialError, verticalError }
      )
    }
  )

  scene.verify(
    'azimuthal-camera-typography',
    { frames: { start: frames.cloud, end: frames.end } },
    (context) => {
      const visible = [...visuals.titles, ...visuals.formulas].filter((item) =>
        context.isVisibleInHierarchy(item)
      )
      const bounds = visible.map((item) => context.screenBounds(item))
      const anchors = visible.map((item) =>
        projectedScreenPoint(item, scene.camera, context.viewport.width, context.viewport.height)
      )
      context.assert(
        bounds.every((item) => insideViewport(item, WIDTH, HEIGHT, 24)) &&
          anchors.every((point) => Math.abs(point.x - WIDTH / 2) < 1e-6),
        'Camera-attached typography must remain centered and inside the viewport',
        { frame: context.globalFrame, bounds, anchors }
      )
    }
  )

  scene.verify(
    'azimuthal-world-clear-of-typography',
    { frames: { start: frames.cloud, end: frames.end } },
    (context) => {
      const title = visuals.titles.find((item) => context.isVisibleInHierarchy(item))
      const formula = visuals.formulas.find((item) => context.isVisibleInHierarchy(item))
      const titleBounds = title ? context.screenBounds(title) : null
      const formulaBounds = formula ? context.screenBounds(formula) : null
      const worldBounds = [
        visuals.cloud,
        visuals.orbitals,
        visuals.waveSphere,
        visuals.azimuth.root,
        visuals.modes
      ]
        .filter((root) => context.isVisibleInHierarchy(root))
        .map((root) => context.screenBounds(root))
        .filter((bounds): bounds is ScreenBounds => bounds !== null)
      context.assert(
        worldBounds.every(
          (bounds) =>
            (titleBounds === null || titleBounds.bottom + 14 <= bounds.top) &&
            (formulaBounds === null || bounds.bottom + 14 <= formulaBounds.top)
        ),
        'World visuals must remain between the title and equation bands',
        { frame: context.globalFrame, titleBounds, formulaBounds, worldBounds }
      )
    }
  )

  const checkpoints = [
    { frame: frames.azimuth, expected: 0 },
    { frame: Math.round((frames.azimuth + frames.modes) / 2), expected: 2 },
    { frame: frames.modes - 1, expected: 3 }
  ]
  for (const [index, checkpoint] of checkpoints.entries()) {
    scene.verify(
      `azimuthal-mode-checkpoint-${index}`,
      { frames: { start: checkpoint.frame, end: checkpoint.frame + 1 } },
      (context) => {
        const parsed = JSON.parse(visuals.stateProbe.text) as { mode: number }
        context.assert(
          Math.abs(parsed.mode - checkpoint.expected) < 0.02,
          'The live polar plot must reach its authored mode checkpoint',
          { frame: context.globalFrame, mode: parsed.mode, expected: checkpoint.expected }
        )
      }
    )
  }

  scene.verify(
    'azimuthal-final-mode-separation',
    { frames: { start: frames.end - 1, end: frames.end } },
    (context) => {
      const bounds = visuals.modePlots.map((plot) => context.screenBounds(plot))
      const separated = bounds.every(
        (current, index) =>
          current !== null &&
          (index === 0 ||
            (bounds[index - 1] !== null && bounds[index - 1]!.right + 12 <= current.left))
      )
      context.assert(separated, 'The final integer modes must read as four separate examples', {
        frame: context.globalFrame,
        bounds
      })
    }
  )
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
