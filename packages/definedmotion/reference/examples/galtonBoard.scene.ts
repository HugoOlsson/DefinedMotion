import { AnimatedScene, SpaceSetting, defineScene, type ScreenBounds } from 'definedmotion'
import { fadeIn, fadeOut, wait } from 'definedmotion/animation'
import { createLatex, latex, queryLaTeXClass, type LatexVisual } from 'definedmotion/latex'
import {
  createCircle,
  createCurve,
  createLine,
  createRectangle,
  createText,
  layout,
  type CurveVisual,
  type LayoutVisual,
  type TextVisual
} from 'definedmotion/rendering'
import * as THREE from 'three'

export default defineScene({
  id: 'galton-board',
  name: 'Galton Board: The Normal Distribution',
  create: galtonBoardScene
})

const WIDTH = 1280
const HEIGHT = 720
const ROW_COUNT = 10
const BIN_COUNT = ROW_COUNT + 1
const BALL_COUNT = 160
const PEG_SPACING = 6.7
const FIRST_PEG_Y = 8.8
const ROW_SPACING = 1.65
const BIN_TOP_Y = -8.6
const BIN_BASE_Y = -24.8
const BALL_RADIUS = 0.34
const BALL_STACK_STEP = 0.62
const COUNT_HEIGHT_STEP = BALL_STACK_STEP / 2

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
  histogram: 0.14,
  pegs: 0.24,
  curve: 0.36,
  balls: 0.5,
  labels: 0.65
} as const

interface BeatFrames {
  intro: number
  path: number
  sample: number
  resolve: number
  end: number
}

interface BallSimulation {
  mesh: ReturnType<typeof createCircle>
  decisions: boolean[]
  path: THREE.Vector3[]
  bin: number
  startFrame: number
  durationFrames: number
}

interface BoardVisuals {
  root: THREE.Group
  pegField: THREE.Group
  bins: THREE.Group & { text: string }
  histogram: THREE.Group & { text: string }
  histogramBars: ReturnType<typeof createRectangle>[]
  expectedCurve: CurveVisual
  expectedLabel: TextVisual
  activeBalls: THREE.Group & { text: string }
  heroBall: ReturnType<typeof createCircle>
  decisionGuide: THREE.Group
  leftBranch: ReturnType<typeof createLine>
  rightBranch: ReturnType<typeof createLine>
  balls: BallSimulation[]
}

interface GaltonState {
  beat: string
  beatProgress: number
  activeCount: number
  landedCount: number
  landedCounts: number[]
}

interface SceneVisuals {
  header: LayoutVisual
  title: TextVisual
  formula: LatexVisual
  choiceCaption: LayoutVisual
  sampleCaption: LayoutVisual
  board: BoardVisuals
  summary: LayoutVisual
  stateProbe: THREE.Group & { text: string }
}

export function galtonBoardScene(): AnimatedScene {
  return new AnimatedScene(WIDTH, HEIGHT, SpaceSetting.TwoDim, async (scene) => {
    scene.scene.background = new THREE.Color(COLORS.background)

    const frames: BeatFrames = {
      intro: 0,
      path: scene.secondsToFrames(3.2),
      sample: scene.secondsToFrames(6),
      resolve: scene.secondsToFrames(11),
      end: scene.secondsToFrames(14)
    }
    scene.timeline.defineBeats({
      intro: { start: frames.intro, end: frames.path },
      path: { start: frames.path, end: frames.sample },
      sample: { start: frames.sample, end: frames.resolve },
      resolve: { start: frames.resolve, end: frames.end }
    })

    const visuals = await createVisuals(scene, frames)
    scene.add(
      visuals.header,
      visuals.choiceCaption,
      visuals.sampleCaption,
      visuals.board.root,
      visuals.summary,
      visuals.stateProbe
    )

    visuals.title.visible = false
    visuals.choiceCaption.visible = false
    visuals.sampleCaption.visible = false
    visuals.board.root.visible = false
    visuals.board.expectedCurve.visible = false
    visuals.board.expectedLabel.visible = false
    visuals.summary.visible = false

    const state: GaltonState = {
      beat: 'intro',
      beatProgress: 0,
      activeCount: 0,
      landedCount: 0,
      landedCounts: Array.from({ length: BIN_COUNT }, () => 0)
    }

    scene.timeline.beat('intro', (beat) => {
      scene.addAnims(
        fadeIn(visuals.title, { duration: 0.7, easing: 'ease-out' }),
        latex.write(visuals.formula, { duration: 1.35, easing: 'linear' }),
        fadeIn(visuals.choiceCaption, { duration: 0.8, easing: 'ease-out' }),
        fadeIn(visuals.sampleCaption, { duration: 0.8, easing: 'ease-out' }),
        fadeIn(visuals.board.root, { duration: 1.05, easing: 'ease-out' }),
        wait((frames.path - frames.intro) / scene.fps)
      )
      beat.onEachTick(({ beatProgress }) => setBeatState(state, 'intro', beatProgress))
    })

    scene.timeline.beat('path', (beat) => {
      scene.addAnims(wait((frames.sample - frames.path) / scene.fps))
      beat.onEachTick(({ beatProgress }) => setBeatState(state, 'path', beatProgress))
    })

    scene.timeline.beat('sample', (beat) => {
      scene.addAnims(wait((frames.resolve - frames.sample) / scene.fps))
      beat.onEachTick(({ beatProgress }) => setBeatState(state, 'sample', beatProgress))
    })

    scene.timeline.beat('resolve', (beat) => {
      scene.addAnims(
        fadeIn(visuals.board.expectedCurve, { duration: 0.9, easing: 'ease-out' }),
        fadeIn(visuals.board.expectedLabel, { duration: 0.7, easing: 'ease-out' }),
        fadeIn(visuals.summary, { duration: 0.7, easing: 'ease-out' }),
        fadeOut(visuals.choiceCaption, { duration: 0.45, easing: 'ease-out' }),
        fadeOut(visuals.sampleCaption, { duration: 0.45, easing: 'ease-out' }),
        latex.mark(visuals.formula.part('normal'), { color: COLORS.gold }),
        wait((frames.end - frames.resolve) / scene.fps)
      )
      beat.onEachTick(({ beatProgress }) => setBeatState(state, 'resolve', beatProgress))
    })

    scene.onEachTick((globalFrame) => {
      updateSimulation(visuals.board, state, globalFrame)
      visuals.stateProbe.text = JSON.stringify({
        beat: state.beat,
        beatProgress: Number(state.beatProgress.toFixed(3)),
        active: state.activeCount,
        landed: state.landedCount,
        counts: state.landedCounts
      })
    })

    exposeScene(scene, visuals)
    addInspectionCameras(scene)
    registerVerifications(scene, frames, visuals, state)
  })
}

const createVisuals = async (scene: AnimatedScene, frames: BeatFrames): Promise<SceneVisuals> => {
  const title = await createText({
    text: 'Random choices. Predictable shape.',
    fontSize: 2.7,
    color: COLORS.ivory,
    anchorX: 'center',
    anchorY: 'top',
    textAlign: 'center'
  })
  title.name = 'GaltonBoardTitle'

  const formula = await createLatex({
    latex: String.raw`X\sim\operatorname{Binomial}\!\left(10,\frac12\right)\;\dmClass{normal}{\approx\;\mathcal N\!\left(5,2.5\right)}`,
    fontSize: 1.72,
    color: COLORS.ivory,
    opacity: 0.72,
    anchorX: 'center',
    anchorY: 'top'
  })
  formula.name = 'GaltonBoardFormula'

  const header = layout.flex(
    {
      name: 'GaltonBoardHeader',
      flexDirection: 'column',
      gap: 0.9,
      alignItems: 'center',
      anchorX: 'center',
      anchorY: 'top'
    },
    [title, formula]
  )
  header.position.set(0, 28.2, DEPTH.labels)

  const choiceCaption = await createCaption(
    'AT EACH PEG',
    String.raw`p(L)=p(R)=\frac12`,
    COLORS.mint
  )
  choiceCaption.position.set(-34.5, 14.5, DEPTH.labels)

  const sampleCaption = await createCaption(
    'INDEPENDENT DROPS',
    String.raw`n=160`,
    COLORS.coral
  )
  sampleCaption.position.set(34.5, 14.5, DEPTH.labels)

  const board = await createBoard(scene, frames)

  const summaryText = await createText({
    text: 'The center has the most paths.',
    fontSize: 1.28,
    color: COLORS.ivory,
    anchorX: 'center',
    anchorY: 'middle'
  })
  const summaryEquation = await createLatex({
    latex: String.raw`\binom{10}{5}=252`,
    fontSize: 1.42,
    color: COLORS.gold,
    anchorX: 'center',
    anchorY: 'middle'
  })
  const summary = layout.flex(
    {
      name: 'GaltonBoardSummary',
      flexDirection: 'row',
      gap: 1.5,
      alignItems: 'center',
      anchorX: 'center',
      anchorY: 'middle'
    },
    [summaryText, summaryEquation]
  )
  summary.position.set(0, 14.2, DEPTH.labels)

  const stateProbe = new THREE.Group() as THREE.Group & { text: string }
  stateProbe.name = 'GaltonBoardState'
  stateProbe.text = ''

  return {
    header,
    title,
    formula,
    choiceCaption,
    sampleCaption,
    board,
    summary,
    stateProbe
  }
}

const createCaption = async (
  labelText: string,
  latexText: string,
  accent: THREE.ColorRepresentation
): Promise<LayoutVisual> => {
  const label = await createText({
    text: labelText,
    fontSize: 1.02,
    color: COLORS.muted,
    anchorX: 'center',
    anchorY: 'top',
    textAlign: 'center'
  })
  const equation = await createLatex({
    latex: latexText,
    fontSize: 1.58,
    color: accent,
    anchorX: 'center',
    anchorY: 'top'
  })
  return layout.flex(
    {
      name: `${labelText} caption`,
      flexDirection: 'column',
      gap: 0.55,
      alignItems: 'center',
      anchorX: 'center',
      anchorY: 'top'
    },
    [label, equation]
  )
}

const createBoard = async (scene: AnimatedScene, frames: BeatFrames): Promise<BoardVisuals> => {
  const root = new THREE.Group()
  root.name = 'GaltonBoardDiagram'

  const pegField = new THREE.Group()
  pegField.name = 'GaltonBoardPegs'
  for (let row = 0; row < ROW_COUNT; row++) {
    for (let column = 0; column <= row; column++) {
      const peg = createCircle(0.21, { color: row === 0 ? COLORS.gold : COLORS.quiet })
      peg.position.set(pegX(row, column), pegY(row), DEPTH.pegs)
      pegField.add(peg)
    }
  }

  const bins = Object.assign(new THREE.Group(), { text: '0 balls landed' })
  bins.name = 'GaltonBoardBins'
  addBinGuides(bins)
  const binLabels = await Promise.all(
    Array.from({ length: BIN_COUNT }, (_, index) =>
      createText({
        text: `${index}`,
        fontSize: 0.72,
        color: COLORS.muted,
        anchorX: 'center',
        anchorY: 'top'
      })
    )
  )
  binLabels.forEach((label, index) => {
    label.position.set(binX(index), BIN_BASE_Y - 0.8, DEPTH.labels)
    bins.add(label)
  })

  const histogram = Object.assign(new THREE.Group(), {
    text: 'counts: 0,0,0,0,0,0,0,0,0,0,0'
  })
  histogram.name = 'GaltonBoardHistogram'
  const histogramBars = createHistogramBars(histogram)

  const expectedCurve = createCurve({
    domain: [-0.5, ROW_COUNT + 0.5],
    sampleCount: 257,
    pointAt: (outcome) => expectedCurvePoint(outcome),
    stroke: { color: COLORS.coral, width: 0.13, opacity: 0.95 }
  })
  expectedCurve.name = 'GaltonBoardExpectedCurve'
  expectedCurve.position.z = DEPTH.curve

  const expectedLabel = await createText({
    text: 'EXPECTED FREQUENCY',
    fontSize: 0.78,
    color: COLORS.coral,
    anchorX: 'center',
    anchorY: 'bottom'
  })
  expectedLabel.name = 'GaltonBoardExpectedLabel'
  expectedLabel.position.set(25.5, -10.5, DEPTH.labels)

  const activeBalls = Object.assign(new THREE.Group(), {
    text: `0 active, 0 landed, ${BALL_COUNT} total`
  })
  activeBalls.name = 'GaltonBoardBalls'

  const landingSlots = Array.from({ length: BIN_COUNT }, () => 0)
  const balls: BallSimulation[] = []
  for (let index = 0; index < BALL_COUNT; index++) {
    const decisions = Array.from({ length: ROW_COUNT }, () => scene.random() >= 0.5)
    const bin = decisions.filter(Boolean).length
    const stackIndex = landingSlots[bin]++
    const mesh = createCircle(BALL_RADIUS, {
      color: index === 0 ? COLORS.gold : COLORS.paleMint
    })
    mesh.name = index === 0 ? 'GaltonBoardHeroBall' : `GaltonBoardBall${index}`
    mesh.visible = false
    mesh.position.z = DEPTH.balls
    activeBalls.add(mesh)
    balls.push({
      mesh,
      decisions,
      path: ballPath(decisions, stackIndex),
      bin,
      startFrame: index === 0 ? frames.path + 12 : frames.sample + (index - 1) * 2,
      durationFrames: index === 0 ? 145 : 108
    })
  }

  const decisionGuide = new THREE.Group()
  decisionGuide.name = 'GaltonBoardDecisionGuide'
  const leftBranch = createLine({ color: COLORS.mint })
  const rightBranch = createLine({ color: COLORS.coral })
  decisionGuide.add(leftBranch, rightBranch)
  decisionGuide.visible = false

  root.add(
    histogram,
    bins,
    pegField,
    expectedCurve,
    expectedLabel,
    decisionGuide,
    activeBalls
  )

  return {
    root,
    pegField,
    bins,
    histogram,
    histogramBars,
    expectedCurve,
    expectedLabel,
    activeBalls,
    heroBall: balls[0].mesh,
    decisionGuide,
    leftBranch,
    rightBranch,
    balls
  }
}

const updateSimulation = (
  board: BoardVisuals,
  state: GaltonState,
  globalFrame: number
): void => {
  state.landedCounts.fill(0)
  state.activeCount = 0
  state.landedCount = 0

  for (const ball of board.balls) {
    const progress = (globalFrame - ball.startFrame) / ball.durationFrames
    if (progress < 0) {
      ball.mesh.visible = false
      continue
    }
    ball.mesh.visible = true
    if (progress >= 1) {
      ball.mesh.position.copy(ball.path[ball.path.length - 1])
      state.landedCounts[ball.bin]++
      state.landedCount++
      continue
    }
    state.activeCount++
    ball.mesh.position.copy(positionOnPath(ball.path, progress))
  }

  const hero = board.balls[0]
  const heroProgress = (globalFrame - hero.startFrame) / hero.durationFrames
  updateDecisionGuide(board, heroProgress)

  board.histogramBars.forEach((bar, index) => {
    const height = Math.max(0.001, state.landedCounts[index] * COUNT_HEIGHT_STEP)
    bar.scale.y = height
    bar.position.y = BIN_BASE_Y + height / 2
  })

  board.activeBalls.text =
    `${state.activeCount} active, ${state.landedCount} landed, ${BALL_COUNT} total`
  board.bins.text = `${state.landedCount} balls landed across ${BIN_COUNT} bins`
  board.histogram.text = `counts: ${state.landedCounts.join(',')}`
}

const updateDecisionGuide = (board: BoardVisuals, heroProgress: number): void => {
  if (heroProgress < 0 || heroProgress >= 0.64) {
    board.decisionGuide.visible = false
    return
  }
  board.decisionGuide.visible = true
  const spread = PEG_SPACING / 2
  const start = new THREE.Vector3(
    board.heroBall.position.x,
    board.heroBall.position.y,
    DEPTH.balls - 0.02
  )
  board.leftBranch.updatePositions(
    start,
    new THREE.Vector3(start.x - spread, start.y - 2, start.z)
  )
  board.rightBranch.updatePositions(
    start,
    new THREE.Vector3(start.x + spread, start.y - 2, start.z)
  )
}

const addBinGuides = (group: THREE.Group): void => {
  const leftEdge = binX(0) - PEG_SPACING / 2
  const rightEdge = binX(BIN_COUNT - 1) + PEG_SPACING / 2
  group.add(
    createLine({
      point1: new THREE.Vector3(leftEdge, BIN_BASE_Y, DEPTH.guides),
      point2: new THREE.Vector3(rightEdge, BIN_BASE_Y, DEPTH.guides),
      color: COLORS.quiet
    })
  )
  for (let index = 0; index <= BIN_COUNT; index++) {
    const x = leftEdge + index * PEG_SPACING
    group.add(
      createLine({
        point1: new THREE.Vector3(x, BIN_BASE_Y, DEPTH.guides),
        point2: new THREE.Vector3(x, BIN_TOP_Y, DEPTH.guides),
        color: COLORS.quieter
      })
    )
  }
}

const createHistogramBars = (group: THREE.Group): ReturnType<typeof createRectangle>[] =>
  Array.from({ length: BIN_COUNT }, (_, index) => {
    const bar = createRectangle(PEG_SPACING - 0.72, 1, { color: COLORS.mint })
    bar.name = `GaltonBoardHistogramBar${index}`
    bar.position.set(binX(index), BIN_BASE_Y, DEPTH.histogram)
    bar.scale.y = 0.001
    bar.material.transparent = true
    bar.material.opacity = 0.16
    bar.material.depthWrite = false
    group.add(bar)
    return bar
  })

const pegX = (row: number, column: number): number => (column - row / 2) * PEG_SPACING

const pegY = (row: number): number => FIRST_PEG_Y - row * ROW_SPACING

const binX = (bin: number): number => (bin - ROW_COUNT / 2) * PEG_SPACING

const ballPath = (decisions: boolean[], stackIndex: number): THREE.Vector3[] => {
  const points = [new THREE.Vector3(0, 11.8, DEPTH.balls)]
  let rights = 0
  points.push(new THREE.Vector3(pegX(0, 0), pegY(0) + 0.48, DEPTH.balls))
  decisions.forEach((right, row) => {
    if (right) rights++
    if (row < ROW_COUNT - 1) {
      points.push(
        new THREE.Vector3(pegX(row + 1, rights), pegY(row + 1) + 0.48, DEPTH.balls)
      )
    }
  })
  points.push(
    new THREE.Vector3(
      binX(rights) + (stackIndex % 2 === 0 ? -0.53 : 0.53),
      BIN_BASE_Y + BALL_RADIUS + Math.floor(stackIndex / 2) * BALL_STACK_STEP,
      DEPTH.balls
    )
  )
  return points
}

const positionOnPath = (path: THREE.Vector3[], progress: number): THREE.Vector3 => {
  const scaled = THREE.MathUtils.clamp(progress, 0, 0.999999) * (path.length - 1)
  const segment = Math.floor(scaled)
  const localProgress = scaled - segment
  const eased = smoothstep(localProgress)
  const position = path[segment].clone().lerp(path[segment + 1], eased)
  if (segment > 0 && segment < path.length - 2) {
    position.y += Math.sin(localProgress * Math.PI) * 0.24
  }
  return position
}

const expectedCurvePoint = (outcome: number): THREE.Vector3 => {
  const variance = ROW_COUNT / 4
  const expectedCount =
    BALL_COUNT *
    (1 / Math.sqrt(2 * Math.PI * variance)) *
    Math.exp(-((outcome - ROW_COUNT / 2) ** 2) / (2 * variance))
  return new THREE.Vector3(
    (outcome - ROW_COUNT / 2) * PEG_SPACING,
    BIN_BASE_Y + expectedCount * COUNT_HEIGHT_STEP,
    0
  )
}

const smoothstep = (value: number): number => {
  const clamped = THREE.MathUtils.clamp(value, 0, 1)
  return clamped * clamped * (3 - 2 * clamped)
}

const setBeatState = (state: GaltonState, beat: string, beatProgress: number): void => {
  state.beat = beat
  state.beatProgress = beatProgress
}

const exposeScene = (scene: AnimatedScene, visuals: SceneVisuals): void => {
  scene.expose('galton-board-header-layout', visuals.header)
  scene.expose('distribution-formula', visuals.formula, {
    description: 'The binomial distribution and its normal approximation',
    tags: ['latex', 'probability', 'normal-distribution'],
    data: { rows: ROW_COUNT, probability: 0.5 }
  })
  scene.expose('peg-field', visuals.board.pegField, {
    description: 'Ten rows of equally likely left-or-right decisions',
    tags: ['galton-board', 'pegs', 'probability']
  })
  scene.expose('outcome-bins', visuals.board.bins, {
    description: 'Eleven outcomes representing zero through ten right turns',
    tags: ['bins', 'outcomes']
  })
  scene.expose('sample-histogram', visuals.board.histogram, {
    description: 'The accumulated deterministic sample',
    tags: ['histogram', 'sample', 'dynamic']
  })
  scene.expose('expected-normal-curve', visuals.board.expectedCurve, {
    description: 'The expected normal approximation over the sampled bins',
    tags: ['curve', 'expected-distribution']
  })
  scene.expose('simulated-balls', visuals.board.activeBalls, {
    description: 'Seeded balls following reproducible paths through the pegs',
    tags: ['balls', 'simulation', 'deterministic'],
    data: { total: BALL_COUNT }
  })
  scene.expose('hero-ball', visuals.board.heroBall, {
    description: 'The first highlighted path through all ten decisions',
    tags: ['hero', 'ball', 'random-path']
  })
  scene.expose('galton-board-summary-layout', visuals.summary)
  scene.expose('galton-board-state', visuals.stateProbe)
  scene.watchCollisions('galton-board-header', visuals.header, {})
  scene.watchCollisions('galton-board-summary', visuals.summary, {})
}

const addInspectionCameras = (scene: AnimatedScene): void => {
  const decisions = scene.exposeCamera(
    'decisions',
    new THREE.OrthographicCamera(-20, 20, 11.25, -11.25, 1, 100),
    { description: 'Close view of the upper peg rows and branch choices' }
  )
  decisions.position.set(0, 2.5, 30)
  decisions.lookAt(0, 2.5, 0)

  const distribution = scene.exposeCamera(
    'distribution',
    new THREE.OrthographicCamera(-43, 43, 15, -15, 1, 100),
    { description: 'Close view of the final sample and expected curve' }
  )
  distribution.position.set(0, -18, 30)
  distribution.lookAt(0, -18, 0)
}

const registerVerifications = (
  scene: AnimatedScene,
  frames: BeatFrames,
  visuals: SceneVisuals,
  state: GaltonState
): void => {
  scene.verify(
    'galton-board-duration-and-beats',
    { frames: { start: frames.end - 1, end: frames.end } },
    (context) => {
      context.assert(
        scene.totalSceneTicks === frames.end && context.beat?.name === 'resolve',
        'The scene must end after fourteen seconds inside the resolve beat',
        {
          expectedFrames: frames.end,
          actualFrames: scene.totalSceneTicks,
          beat: context.beat?.name ?? null
        }
      )
    }
  )

  scene.verify(
    'galton-board-primitive-contract',
    { frames: { start: frames.intro, end: frames.end } },
    (context) => {
      const layouts = [
        visuals.header,
        visuals.choiceCaption,
        visuals.sampleCaption,
        visuals.summary
      ]
      const primitivesAreCanonical =
        layouts.every((item) => item.userData.definedMotionVisual === 'layout') &&
        visuals.board.expectedCurve.userData.definedMotionVisual === 'curve' &&
        visuals.board.histogramBars.every(
          (item) => item.userData.definedMotionVisual === 'rectangle'
        )
      context.assert(
        primitivesAreCanonical,
        'Typography, the expected curve, and histogram bars must use DefinedMotion primitives',
        { frame: context.globalFrame, primitivesAreCanonical }
      )
    }
  )

  scene.verify(
    'galton-board-formula-semantic-handle',
    { frames: { start: frames.intro, end: frames.end } },
    (context) => {
      context.assert(
        queryLaTeXClass(visuals.formula, 'normal') !== null,
        'The normal approximation must remain semantically selectable',
        { frame: context.globalFrame, latex: visuals.formula.latex }
      )
    }
  )

  scene.verify(
    'galton-board-regions-readable',
    { frames: { start: frames.intro, end: frames.end } },
    (context) => {
      const header = context.screenBounds(visuals.header)
      const pegs = context.screenBounds(visuals.board.pegField)
      const bins = context.screenBounds(visuals.board.bins)
      const summary = context.isVisibleInHierarchy(visuals.summary)
        ? context.screenBounds(visuals.summary)
        : null
      const bounds = [header, pegs, bins, summary].filter(
        (value): value is ScreenBounds => value !== null
      )
      const inViewport = bounds.every((value) =>
        insideViewport(value, context.viewport.width, context.viewport.height, 18)
      )
      const verticallySeparated = header !== null && pegs !== null && header.bottom + 16 <= pegs.top
      context.assert(
        inViewport && verticallySeparated,
        'The header, board, bins, and final summary must remain readable',
        { frame: context.globalFrame, header, pegs, bins, summary }
      )
    }
  )

  scene.verify(
    'galton-board-final-sample',
    { frames: { start: frames.end - 1, end: frames.end } },
    (context) => {
      const countSum = state.landedCounts.reduce((sum, count) => sum + count, 0)
      const centralCount = state.landedCounts[ROW_COUNT / 2]
      const edgeCount = state.landedCounts[0] + state.landedCounts[ROW_COUNT]
      context.assert(
        state.activeCount === 0 && state.landedCount === BALL_COUNT && countSum === BALL_COUNT,
        'Every seeded ball must land before the final frame',
        {
          frame: context.globalFrame,
          active: state.activeCount,
          landed: state.landedCount,
          countSum,
          centralCount,
          edgeCount
        }
      )
    }
  )

  scene.verify(
    'galton-board-bar-heights-match-counts',
    { frames: { start: frames.sample, end: frames.end } },
    (context) => {
      const matches = visuals.board.histogramBars.every((bar, index) => {
        const expectedHeight = Math.max(0.001, state.landedCounts[index] * COUNT_HEIGHT_STEP)
        return (
          Math.abs(bar.scale.y - expectedHeight) < 1e-6 &&
          Math.abs(bar.position.y - (BIN_BASE_Y + expectedHeight / 2)) < 1e-6
        )
      })
      context.assert(matches, 'Every histogram bar must represent its landed count exactly', {
        frame: context.globalFrame,
        counts: state.landedCounts.join(',')
      })
    }
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
