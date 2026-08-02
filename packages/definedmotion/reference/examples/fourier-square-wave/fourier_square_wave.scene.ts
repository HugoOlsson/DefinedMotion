import { AnimatedScene, SpaceSetting, defineScene, type ScreenBounds } from 'definedmotion'
import { fadeIn, scaleIn, wait } from 'definedmotion/animation'
import { createLatex, latex, queryLaTeXClass, type LatexVisual } from 'definedmotion/latex'
import {
  createCircle,
  createCurve,
  createLine,
  createText,
  layout,
  type CurveVisual,
  type LayoutVisual,
  type TextVisual
} from 'definedmotion/rendering'
import * as THREE from 'three'

export default defineScene({
  id: 'fourier-square-wave',
  name: 'Fourier Square Wave',
  create: fourierSquareWaveScene
})

const WIDTH = 1280
const HEIGHT = 720
const TERM_COUNT = 50
const WAVE_AMPLITUDE = 6
const WAVE_SPAN = Math.PI * 4
const FRAMES_PER_PHASE_UNIT = 42
const LEFT_CENTER = new THREE.Vector2(-28.25, -5)
const RIGHT_CENTER = new THREE.Vector2(22, -5)
const PLOT_START_X = -26
const PLOT_END_X = 26
const HIGHEST_HARMONIC = 2 * TERM_COUNT - 1
const WAVE_CYCLES = (HIGHEST_HARMONIC * WAVE_SPAN) / (Math.PI * 2)
const CURVE_SAMPLES = Math.ceil(WAVE_CYCLES * 12) + 1
const CIRCLE_SAMPLES = 97

const COLORS = {
  background: '#040708',
  ivory: '#f0ece2',
  muted: '#879293',
  quiet: '#263638',
  quieter: '#182527',
  mint: '#55dec9',
  paleMint: '#a2eee2',
  gold: '#e0bd57',
  coral: '#e1876d'
} as const

const DEPTH = {
  guides: 0.05,
  target: 0.16,
  data: 0.32,
  markers: 0.5
} as const

interface BeatFrames {
  intro: number
  assemble: number
  compare: number
  resolve: number
  end: number
}

interface FourierState {
  beat: string
  beatProgress: number
  phase: number
  activeTerms: number
  weights: number[]
}

interface EpicycleVisual {
  odd: number
  circle: CurveVisual
  radius: CurveVisual
}

interface SceneVisuals {
  header: LayoutVisual
  title: TextVisual
  formula: LatexVisual
  epicycleRoot: THREE.Group
  waveformRoot: THREE.Group
  epicycleCaption: LayoutVisual
  waveformCaption: LayoutVisual
  epicycles: EpicycleVisual[]
  tip: ReturnType<typeof createCircle>
  connector: CurveVisual
  partialWave: CurveVisual
  targetWave: CurveVisual
  countLabels: TextVisual[]
  summary: LayoutVisual
  stateProbe: THREE.Group & { text: string }
}

export function fourierSquareWaveScene(): AnimatedScene {
  return new AnimatedScene(WIDTH, HEIGHT, SpaceSetting.TwoDim, async (scene) => {
    scene.scene.background = new THREE.Color(COLORS.background)

    const visuals = await createVisuals()
    scene.add(
      visuals.header,
      visuals.epicycleRoot,
      visuals.waveformRoot,
      visuals.connector,
      visuals.summary,
      visuals.stateProbe
    )

    visuals.title.visible = false
    visuals.targetWave.visible = false
    visuals.summary.visible = false

    const frames: BeatFrames = {
      intro: 0,
      assemble: scene.secondsToFrames(5),
      compare: scene.secondsToFrames(18),
      resolve: scene.secondsToFrames(25),
      end: scene.secondsToFrames(30)
    }
    scene.timeline.defineBeats({
      intro: { start: frames.intro, end: frames.assemble },
      assemble: { start: frames.assemble, end: frames.compare },
      compare: { start: frames.compare, end: frames.resolve },
      resolve: { start: frames.resolve, end: frames.end }
    })

    const state: FourierState = {
      beat: 'intro',
      beatProgress: 0,
      phase: 0,
      activeTerms: 1,
      weights: Array.from({ length: TERM_COUNT }, (_, index) => (index === 0 ? 1 : 0))
    }

    scene.timeline.beat('intro', (beat) => {
      scene.addAnims(
        fadeIn(visuals.title, { duration: 0.75, easing: 'ease-out' }),
        latex.write(visuals.formula, { duration: 1.4, easing: 'linear' }),
        scaleIn(visuals.epicycleRoot, { duration: 1.1, easing: 'ease-out', from: 0.94 }),
        scaleIn(visuals.waveformRoot, { duration: 1.1, easing: 'ease-out', from: 0.94 })
      )
      scene.addAnims(wait(3.6))
      beat.onEachTick(({ beatProgress }) => setBeatState(state, 'intro', beatProgress))
    })

    scene.timeline.beat('assemble', (beat) => {
      scene.addAnims(wait(13))
      beat.onEachTick(({ beatProgress }) => setBeatState(state, 'assemble', beatProgress))
    })

    scene.timeline.beat('compare', (beat) => {
      scene.addAnims(
        fadeIn(visuals.targetWave, { duration: 0.75, easing: 'ease-out' }),
        latex.mark(visuals.formula.part('weight'), { color: COLORS.gold })
      )
      scene.addAnims(wait(4.6))
      beat.onEachTick(({ beatProgress }) => setBeatState(state, 'compare', beatProgress))
    })

    scene.timeline.beat('resolve', (beat) => {
      scene.addAnims(fadeIn(visuals.summary, { duration: 0.7, easing: 'ease-out' }))
      scene.addAnims(wait(4.3))
      beat.onEachTick(({ beatProgress }) => setBeatState(state, 'resolve', beatProgress))
    })

    scene.onEachTick((globalFrame) => {
      const phase = globalFrame / FRAMES_PER_PHASE_UNIT
      const weights = weightsAtFrame(globalFrame, frames)
      updateFourierVisuals(visuals, globalFrame, frames, phase, weights)
      state.phase = phase
      state.weights = weights
      state.activeTerms = Math.max(
        1,
        weights.reduce((count, weight) => count + (weight >= 0.5 ? 1 : 0), 0)
      )
      showCountLabel(visuals.countLabels, state.activeTerms)
      visuals.stateProbe.text = JSON.stringify({
        beat: state.beat,
        beatProgress: Number(state.beatProgress.toFixed(3)),
        phase: Number(state.phase.toFixed(5)),
        activeTerms: state.activeTerms,
        weights: state.weights.map((weight) => Number(weight.toFixed(3)))
      })
    })

    exposeScene(scene, visuals)
    addInspectionCameras(scene)
    registerVerifications(scene, frames, visuals, state)
  })
}

const createVisuals = async (): Promise<SceneVisuals> => {
  const title = await createText({
    text: 'A square wave from circles.',
    fontSize: 2.7,
    color: COLORS.ivory,
    anchorX: 'center',
    anchorY: 'top',
    textAlign: 'center'
  })
  title.name = 'FourierSquareWaveTitle'

  const formula = await createLatex({
    latex: String.raw`S_N(t)=\frac{4}{\pi}\sum_{k=0}^{N-1}\dmClass{weight}{\frac{1}{2k+1}}\sin\!\left(\dmClass{odd}{(2k+1)}t\right)`,
    fontSize: 1.72,
    color: COLORS.ivory,
    opacity: 0.7,
    anchorX: 'center',
    anchorY: 'top'
  })
  formula.name = 'FourierSquareWaveFormula'

  const header = layout.flex(
    {
      name: 'FourierSquareWaveHeader',
      flexDirection: 'column',
      gap: 0.9,
      alignItems: 'center',
      anchorX: 'center',
      anchorY: 'top'
    },
    [title, formula]
  )
  header.position.set(0, 27.5, 0.5)

  const epicycleRoot = new THREE.Group()
  epicycleRoot.name = 'FourierEpicyclePlot'
  epicycleRoot.position.set(LEFT_CENTER.x, LEFT_CENTER.y, 0)
  const waveformRoot = new THREE.Group()
  waveformRoot.name = 'FourierWaveformPlot'
  waveformRoot.position.set(RIGHT_CENTER.x, RIGHT_CENTER.y, 0)

  const epicycleCaption = await createCaption(
    'ROTATING ODD HARMONICS',
    String.raw`1,\;3,\;5,\;7,\ldots`
  )
  epicycleCaption.position.set(0, 15.25, 0.4)
  epicycleRoot.add(epicycleCaption)

  const waveformCaption = await createCaption('THE SAME SUM, UNROLLED', String.raw`N\text{ terms}`)
  waveformCaption.position.set(0, 15.25, 0.4)
  waveformRoot.add(waveformCaption)

  addEpicycleGuides(epicycleRoot)
  addWaveformGuides(waveformRoot)

  const epicycles = Array.from({ length: TERM_COUNT }, (_, index) => {
    const odd = 2 * index + 1
    const harmonicProgress = index / (TERM_COUNT - 1)
    const circle = createCurve({
      domain: [0, Math.PI * 2],
      sampleCount: CIRCLE_SAMPLES,
      closed: true,
      pointAt: (angle) => new THREE.Vector2(Math.cos(angle), Math.sin(angle)),
      stroke: {
        color: index === 0 ? COLORS.mint : COLORS.paleMint,
        width: index === 0 ? 0.12 : THREE.MathUtils.lerp(0.075, 0.028, harmonicProgress),
        opacity: index === 0 ? 0.82 : THREE.MathUtils.lerp(0.58, 0.32, harmonicProgress)
      }
    })
    circle.name = `FourierEpicycle${odd}`
    circle.position.z = DEPTH.data
    const radius = createCurve({
      sampleCount: 2,
      pointAt: () => new THREE.Vector2(),
      stroke: {
        color: index === 0 ? COLORS.gold : COLORS.muted,
        width: index === 0 ? 0.105 : THREE.MathUtils.lerp(0.06, 0.024, harmonicProgress),
        opacity: index === 0 ? 0.88 : THREE.MathUtils.lerp(0.64, 0.36, harmonicProgress)
      }
    })
    radius.name = `FourierRadius${odd}`
    radius.position.z = DEPTH.data + 0.02
    epicycleRoot.add(circle, radius)
    return { odd, circle, radius }
  })

  const tip = createCircle(0.34, { color: COLORS.ivory })
  tip.name = 'FourierVectorTip'
  tip.position.z = DEPTH.markers
  epicycleRoot.add(tip)

  const partialWave = createCurve({
    domain: [0, 1],
    sampleCount: CURVE_SAMPLES,
    pointAt: (progress) => partialWavePoint(progress, 0, [1, ...Array(TERM_COUNT - 1).fill(0)]),
    stroke: { color: COLORS.mint, width: 0.16 }
  })
  partialWave.name = 'FourierPartialSum'
  partialWave.position.z = DEPTH.data
  waveformRoot.add(partialWave)

  const targetWave = createCurve({
    domain: [0, 1],
    sampleCount: CURVE_SAMPLES,
    pointAt: (progress) => targetWavePoint(progress, 0),
    stroke: {
      color: COLORS.ivory,
      width: 0.07,
      opacity: 0.38,
      dash: { length: 0.75, gap: 0.48 }
    }
  })
  targetWave.name = 'IdealSquareWave'
  targetWave.position.z = DEPTH.target
  waveformRoot.add(targetWave)

  const countLabels = await Promise.all(
    Array.from({ length: TERM_COUNT }, (_, index) =>
      createText({
        text: `${index + 1} ${index === 0 ? 'term' : 'terms'}`,
        fontSize: 1.02,
        color: COLORS.gold,
        anchorX: 'center',
        anchorY: 'middle'
      })
    )
  )
  const countRoot = new THREE.Group()
  countRoot.name = 'FourierTermCount'
  countLabels.forEach((label, index) => {
    label.visible = index === 0
    countRoot.add(label)
  })
  countRoot.position.set(0, 11.6, 0.45)
  waveformRoot.add(countRoot)

  const connector = createCurve({
    sampleCount: 2,
    pointAt: () => new THREE.Vector2(),
    stroke: { color: COLORS.gold, width: 0.075, opacity: 0.72 }
  })
  connector.name = 'FourierEndpointConnector'
  connector.position.z = DEPTH.data

  const summaryText = await createText({
    text: 'More odd harmonics sharpen the edge. The overshoot remains.',
    fontSize: 1.16,
    color: COLORS.muted,
    anchorX: 'center',
    anchorY: 'middle',
    textAlign: 'center'
  })
  const summary = layout.flex(
    {
      name: 'FourierSquareWaveSummary',
      flexDirection: 'row',
      alignItems: 'center',
      anchorX: 'center',
      anchorY: 'middle'
    },
    [summaryText]
  )
  summary.position.set(0, -26.5, 0.5)

  const stateProbe = new THREE.Group() as THREE.Group & { text: string }
  stateProbe.name = 'FourierSquareWaveState'
  stateProbe.text = ''

  return {
    header,
    title,
    formula,
    epicycleRoot,
    waveformRoot,
    epicycleCaption,
    waveformCaption,
    epicycles,
    tip,
    connector,
    partialWave,
    targetWave,
    countLabels,
    summary,
    stateProbe
  }
}

const createCaption = async (titleText: string, latexText: string): Promise<LayoutVisual> => {
  const title = await createText({
    text: titleText,
    fontSize: 1.12,
    color: COLORS.muted,
    anchorX: 'center',
    anchorY: 'top',
    textAlign: 'center'
  })
  const formula = await createLatex({
    latex: latexText,
    fontSize: 1.05,
    color: COLORS.ivory,
    anchorX: 'center',
    anchorY: 'top'
  })
  return layout.flex(
    {
      flexDirection: 'column',
      gap: 0.42,
      alignItems: 'center',
      anchorX: 'center',
      anchorY: 'top'
    },
    [title, formula]
  )
}

const addEpicycleGuides = (root: THREE.Group): void => {
  root.add(
    guideLine(new THREE.Vector3(-12, 0, 0), new THREE.Vector3(12, 0, 0)),
    guideLine(new THREE.Vector3(0, -12, 0), new THREE.Vector3(0, 12, 0))
  )
}

const addWaveformGuides = (root: THREE.Group): void => {
  root.add(guideLine(new THREE.Vector3(PLOT_START_X, 0, 0), new THREE.Vector3(PLOT_END_X, 0, 0)))
  for (const y of [-WAVE_AMPLITUDE, WAVE_AMPLITUDE]) {
    const guide = guideLine(
      new THREE.Vector3(PLOT_START_X, y, 0),
      new THREE.Vector3(PLOT_END_X, y, 0)
    )
    const material = guide.material as THREE.LineBasicMaterial
    material.opacity = 0.45
    root.add(guide)
  }
}

const guideLine = (point1: THREE.Vector3, point2: THREE.Vector3): ReturnType<typeof createLine> => {
  const line = createLine({ point1, point2, color: COLORS.quiet })
  const material = line.material as THREE.LineBasicMaterial
  material.transparent = true
  material.opacity = 0.72
  material.depthWrite = false
  line.position.z = DEPTH.guides
  return line
}

const updateFourierVisuals = (
  visuals: SceneVisuals,
  globalFrame: number,
  frames: BeatFrames,
  phase: number,
  weights: number[]
): void => {
  let center = new THREE.Vector2()
  for (const [index, visual] of visuals.epicycles.entries()) {
    const weight = weights[index]
    const radius = ((4 / Math.PI) * WAVE_AMPLITUDE * weight) / visual.odd
    const centerAtStart = center.clone()
    const next = centerAtStart
      .clone()
      .add(
        new THREE.Vector2(
          Math.cos(visual.odd * phase),
          Math.sin(visual.odd * phase)
        ).multiplyScalar(radius)
      )

    visual.circle.visible = weight > 0.002
    visual.radius.visible = weight > 0.002
    const harmonicProgress = index / (TERM_COUNT - 1)
    visual.circle.material.opacity =
      (index === 0 ? 0.82 : THREE.MathUtils.lerp(0.58, 0.32, harmonicProgress)) * weight
    visual.radius.material.opacity =
      (index === 0 ? 0.88 : THREE.MathUtils.lerp(0.64, 0.36, harmonicProgress)) * weight
    visual.circle.setPath({
      domain: [0, Math.PI * 2],
      pointAt: (angle) =>
        new THREE.Vector2(
          centerAtStart.x + Math.cos(angle) * radius,
          centerAtStart.y + Math.sin(angle) * radius
        )
    })
    visual.radius.setPath({
      pointAt: (progress) => centerAtStart.clone().lerp(next, progress)
    })
    center = next
  }

  visuals.tip.position.set(center.x, center.y, DEPTH.markers)
  const endpoint = LEFT_CENTER.clone().add(center)
  const plotStart = RIGHT_CENTER.clone().add(new THREE.Vector2(PLOT_START_X, center.y))
  visuals.connector.setPath({ pointAt: (progress) => endpoint.clone().lerp(plotStart, progress) })
  visuals.partialWave.setPath({
    domain: [0, 1],
    pointAt: (progress) => tracedWavePoint(progress, globalFrame, frames)
  })
  visuals.targetWave.setPath({
    domain: [0, 1],
    pointAt: (progress) => targetWavePoint(progress, phase)
  })
}

const partialWavePoint = (
  progress: number,
  phase: number,
  weights: readonly number[]
): THREE.Vector2 => {
  const theta = phase - progress * WAVE_SPAN
  return new THREE.Vector2(
    THREE.MathUtils.lerp(PLOT_START_X, PLOT_END_X, progress),
    fourierValue(theta, weights) * WAVE_AMPLITUDE
  )
}

const tracedWavePoint = (
  progress: number,
  globalFrame: number,
  frames: BeatFrames
): THREE.Vector2 => {
  const historicalFrame = globalFrame - progress * WAVE_SPAN * FRAMES_PER_PHASE_UNIT
  const historicalPhase = historicalFrame / FRAMES_PER_PHASE_UNIT
  const historicalWeights = weightsAtFrame(historicalFrame, frames)
  return new THREE.Vector2(
    THREE.MathUtils.lerp(PLOT_START_X, PLOT_END_X, progress),
    fourierValue(historicalPhase, historicalWeights) * WAVE_AMPLITUDE
  )
}

const fourierValue = (phase: number, weights: readonly number[]): number =>
  weights.reduce((sum, weight, index) => {
    const odd = 2 * index + 1
    return sum + (weight * (4 / Math.PI) * Math.sin(odd * phase)) / odd
  }, 0)

const targetWavePoint = (progress: number, phase: number): THREE.Vector2 => {
  const theta = phase - progress * WAVE_SPAN
  return new THREE.Vector2(
    THREE.MathUtils.lerp(PLOT_START_X, PLOT_END_X, progress),
    Math.sign(Math.sin(theta)) * WAVE_AMPLITUDE
  )
}

const weightsAtFrame = (frame: number, frames: BeatFrames): number[] => {
  if (frame < frames.assemble) {
    return Array.from({ length: TERM_COUNT }, (_, index) => (index === 0 ? 1 : 0))
  }
  if (frame >= frames.compare) return Array(TERM_COUNT).fill(1)

  const progress = (frame - frames.assemble) / (frames.compare - frames.assemble - 1)
  return Array.from({ length: TERM_COUNT }, (_, index) => {
    if (index === 0) return 1
    const local = THREE.MathUtils.clamp((progress * (TERM_COUNT - 1) - (index - 1)) / 0.72, 0, 1)
    return local * local * (3 - 2 * local)
  })
}

const showCountLabel = (labels: readonly TextVisual[], activeTerms: number): void => {
  labels.forEach((label, index) => {
    label.visible = index === activeTerms - 1
  })
}

const setBeatState = (state: FourierState, beat: string, beatProgress: number): void => {
  state.beat = beat
  state.beatProgress = beatProgress
}

const exposeScene = (scene: AnimatedScene, visuals: SceneVisuals): void => {
  scene.expose('fourier-square-wave-header-layout', visuals.header)
  scene.expose('fourier-square-wave-formula', visuals.formula, {
    data: { semanticParts: true }
  })
  scene.expose('fourier-square-wave-epicycles', visuals.epicycleRoot)
  scene.expose('fourier-square-wave-partial-sum', visuals.partialWave)
  scene.expose('fourier-square-wave-target', visuals.targetWave)
  scene.expose('fourier-square-wave-summary-layout', visuals.summary)
  scene.expose('fourier-square-wave-state', visuals.stateProbe)
  scene.watchCollisions('fourier-square-wave-header', visuals.header, {})
  scene.watchCollisions('fourier-square-wave-summary', visuals.summary, {})
}

const addInspectionCameras = (scene: AnimatedScene): void => {
  const epicycles = scene.exposeCamera(
    'epicycles',
    new THREE.OrthographicCamera(-16, 16, 14, -14, 1, 100),
    { description: 'Focused inspection of the rotating odd-harmonic chain' }
  )
  epicycles.position.set(LEFT_CENTER.x, LEFT_CENTER.y, 30)
  epicycles.lookAt(LEFT_CENTER.x, LEFT_CENTER.y, 0)

  const waveform = scene.exposeCamera(
    'waveform',
    new THREE.OrthographicCamera(-31, 31, 14, -14, 1, 100),
    { description: 'Focused inspection of the Fourier partial sum and square-wave target' }
  )
  waveform.position.set(RIGHT_CENTER.x, RIGHT_CENTER.y, 30)
  waveform.lookAt(RIGHT_CENTER.x, RIGHT_CENTER.y, 0)
}

const registerVerifications = (
  scene: AnimatedScene,
  frames: BeatFrames,
  visuals: SceneVisuals,
  state: FourierState
): void => {
  scene.verify(
    'fourier-square-wave-duration-and-beats',
    { frames: { start: frames.end - 1, end: frames.end } },
    (context) => {
      context.assert(scene.totalSceneTicks === frames.end, 'The explainer must last 30 seconds', {
        expectedFrames: frames.end,
        actualFrames: scene.totalSceneTicks
      })
      context.assert(context.beat?.name === 'resolve', 'The final frame must belong to resolve', {
        beat: context.beat
      })
    }
  )

  scene.verify(
    'fourier-square-wave-primitive-contract',
    { frames: { start: frames.intro, end: frames.end } },
    (context) => {
      const curves = [
        ...visuals.epicycles.flatMap((item) => [item.circle, item.radius]),
        visuals.connector,
        visuals.partialWave,
        visuals.targetWave
      ]
      const layouts = [
        visuals.header,
        visuals.epicycleCaption,
        visuals.waveformCaption,
        visuals.summary
      ]
      context.assert(
        curves.every((item) => item.userData.definedMotionVisual === 'curve') &&
          layouts.every((item) => item.userData.definedMotionVisual === 'layout'),
        'Dynamic paths must use createCurve and typography groups must use layout',
        {
          frame: context.globalFrame,
          curveKinds: curves.map((item) => item.userData.definedMotionVisual),
          layoutKinds: layouts.map((item) => item.userData.definedMotionVisual)
        }
      )
    }
  )

  scene.verify(
    'fourier-square-wave-semantic-formula',
    { frames: { start: frames.intro, end: frames.end } },
    (context) => {
      context.assert(
        queryLaTeXClass(visuals.formula, 'weight') !== null &&
          queryLaTeXClass(visuals.formula, 'odd') !== null,
        'The coefficient and odd-frequency terms must remain semantically selectable',
        { frame: context.globalFrame, latex: visuals.formula.latex }
      )
    }
  )

  scene.verify(
    'fourier-square-wave-vector-sum',
    { frames: { start: frames.intro, end: frames.end } },
    (context) => {
      const expectedY = partialWavePoint(0, state.phase, state.weights).y
      const historicalEndpoint = curveEndPoint(visuals.partialWave)
      const expectedHistoricalEndpoint = tracedWavePoint(1, context.globalFrame, frames)
      context.assert(
        Math.abs(visuals.tip.position.y - expectedY) < 1e-5 &&
          historicalEndpoint.distanceTo(expectedHistoricalEndpoint) < 1e-4,
        'The waveform must connect to the current sum while preserving its historical samples',
        {
          frame: context.globalFrame,
          tipY: visuals.tip.position.y,
          expectedY,
          historicalEndpoint: historicalEndpoint.toArray(),
          expectedHistoricalEndpoint: expectedHistoricalEndpoint.toArray()
        }
      )
    }
  )

  scene.verify(
    'fourier-square-wave-regions-readable',
    { frames: { start: frames.intro, end: frames.end } },
    (context) => {
      const header = context.screenBounds(visuals.header)
      const epicycles = context.screenBounds(visuals.epicycleRoot)
      const waveform = context.screenBounds(visuals.waveformRoot)
      const summary = context.isVisibleInHierarchy(visuals.summary)
        ? context.screenBounds(visuals.summary)
        : null
      const bounds = [header, epicycles, waveform, summary].filter(
        (value): value is ScreenBounds => value !== null
      )
      const inViewport = bounds.every((value) =>
        insideViewport(value, context.viewport.width, context.viewport.height, 18)
      )
      const separated =
        epicycles !== null && waveform !== null && epicycles.right + 20 <= waveform.left
      context.assert(inViewport && separated, 'The header and diagrams must remain readable', {
        frame: context.globalFrame,
        header,
        epicycles,
        waveform,
        summary,
        minimumPlotGap: 20
      })
    }
  )

  scene.verify(
    'fourier-square-wave-finite-curves',
    { frames: { start: frames.intro, end: frames.end } },
    (context) => {
      const curves = [
        ...visuals.epicycles.flatMap((item) => [item.circle, item.radius]),
        visuals.connector,
        visuals.partialWave,
        visuals.targetWave
      ]
      const finite = curves.every((curve) =>
        Array.from(curve.geometry.getAttribute('position').array).every(Number.isFinite)
      )
      context.assert(finite, 'Every dynamic curve buffer must remain finite', {
        frame: context.globalFrame,
        finite
      })
    }
  )

  scene.verify(
    'fourier-square-wave-final-harmonics',
    { frames: { start: frames.end - 1, end: frames.end } },
    (context) => {
      context.assert(
        state.activeTerms === TERM_COUNT && state.weights.every((weight) => weight === 1),
        'The final composition must contain all fifty odd harmonics',
        {
          frame: context.globalFrame,
          activeTerms: state.activeTerms,
          weights: state.weights
        }
      )
    }
  )
}

const curveEndPoint = (curve: CurveVisual): THREE.Vector2 => {
  const positions = curve.geometry.getAttribute('position').array as ArrayLike<number>
  const segmentOffset = (curve.sampleCount - 2) * 18
  return new THREE.Vector2(
    (positions[segmentOffset + 6] + positions[segmentOffset + 15]) / 2,
    (positions[segmentOffset + 7] + positions[segmentOffset + 16]) / 2
  )
}

const insideViewport = (
  bounds: ScreenBounds,
  width: number,
  height: number,
  margin: number
): boolean =>
  bounds.left >= margin &&
  bounds.top >= margin &&
  bounds.right <= width - margin &&
  bounds.bottom <= height - margin
