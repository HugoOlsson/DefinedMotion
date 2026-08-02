import { AnimatedScene, SpaceSetting, defineScene, type ScreenBounds } from 'definedmotion'
import { fadeIn, wait } from 'definedmotion/animation'
import { createLatex, latex, queryLaTeXClass, type LatexVisual } from 'definedmotion/latex'
import {
  createCircle,
  createCurve,
  createLine,
  createText,
  layout,
  type CurvePath,
  type CurveVisual,
  type LayoutVisual,
  type TextVisual
} from 'definedmotion/rendering'
import * as THREE from 'three'

export default defineScene({
  id: 'polar-cartesian-explainer',
  name: 'Polar versus Cartesian Explainer',
  create: polarCartesianExplainer
})

const WIDTH = 1280
const HEIGHT = 720
const AMPLITUDE = 2.8
const FREQUENCY = 1.6
const MAX_THETA = Math.PI * 10
const POLAR_SCALE = 4.2
const GRAPH_SCALE_Y = 3.55
const GRAPH_WIDTH = 40
const POLAR_CENTER = new THREE.Vector2(-25, -4)
const GRAPH_CENTER = new THREE.Vector2(25, -4)
const PLOT_DEPTH = {
  guides: 0.05,
  liveGuides: 0.25,
  data: 0.35,
  markers: 0.5
} as const

const COLORS = {
  background: '#040708',
  ivory: '#f0ece2',
  muted: '#879293',
  quiet: '#263638',
  quieter: '#182527',
  mint: '#55dec9',
  paleMint: '#a2eee2',
  gold: '#e0bd57',
  coral: '#e1876d',
  blue: '#788ddd'
} as const

interface BeatFrames {
  intro: number
  systems: number
  trace: number
  resolve: number
  end: number
}

interface TraceState {
  beat: string
  beatProgress: number
  theta: number
  radius: number
}

interface PlotVisual {
  root: THREE.Group
  caption: LayoutVisual
  trace: CurveVisual
}

interface SceneVisuals {
  header: LayoutVisual
  title: TextVisual
  formula: LatexVisual
  polar: PlotVisual
  cartesian: PlotVisual
  polarDot: ReturnType<typeof createCircle>
  graphDot: ReturnType<typeof createCircle>
  radialArm: CurveVisual
  graphGuide: CurveVisual
  markerGroups: readonly [THREE.Group, THREE.Group]
  summary: LayoutVisual
  stateProbe: THREE.Group & { text: string }
}

export function polarCartesianExplainer(): AnimatedScene {
  return new AnimatedScene(WIDTH, HEIGHT, SpaceSetting.TwoDim, async (scene) => {
    scene.scene.background = new THREE.Color(COLORS.background)

    const visuals = await createVisuals()
    scene.add(visuals.header, visuals.polar.root, visuals.cartesian.root, visuals.summary)

    const stateProbe = new THREE.Group() as THREE.Group & { text: string }
    stateProbe.name = 'PolarCartesianState'
    stateProbe.text = ''
    visuals.stateProbe = stateProbe
    scene.add(stateProbe)

    visuals.title.visible = false
    visuals.polar.root.visible = false
    visuals.cartesian.root.visible = false
    for (const markerGroup of visuals.markerGroups) markerGroup.visible = false
    visuals.summary.visible = false

    const frames: BeatFrames = {
      intro: 0,
      systems: scene.secondsToFrames(4),
      trace: scene.secondsToFrames(8),
      resolve: scene.secondsToFrames(20),
      end: scene.secondsToFrames(26)
    }

    scene.timeline.defineBeats({
      intro: { start: frames.intro, end: frames.systems },
      systems: { start: frames.systems, end: frames.trace },
      trace: { start: frames.trace, end: frames.resolve },
      resolve: { start: frames.resolve, end: frames.end }
    })

    const state: TraceState = { beat: 'intro', beatProgress: 0, theta: 0, radius: 0 }
    setTrace(visuals, state, 0)

    scene.timeline.beat('intro', (beat) => {
      scene.addAnims(
        fadeIn(visuals.title, { duration: 0.75, easing: 'ease-out' }),
        latex.write(visuals.formula, { duration: 1.25, easing: 'linear' })
      )
      scene.addAnims(wait(2.55))
      beat.onEachTick(({ beatProgress }) => setBeatState(state, 'intro', beatProgress))
    })

    scene.timeline.beat('systems', (beat) => {
      scene.addAnims(
        fadeIn(visuals.polar.root, { duration: 1.05, easing: 'ease-out' }),
        fadeIn(visuals.cartesian.root, { duration: 1.05, easing: 'ease-out' })
      )
      scene.addAnims(wait(2.8))
      beat.onEachTick(({ beatProgress }) => setBeatState(state, 'systems', beatProgress))
    })

    scene.timeline.beat('trace', (beat) => {
      scene.addAnims(
        ...visuals.markerGroups.map((group) => fadeIn(group, { duration: 0.4, easing: 'ease-out' }))
      )
      scene.addAnims(wait(11.4))
      beat.onEachTick(({ beatProgress }) => {
        setBeatState(state, 'trace', beatProgress)
        setTrace(visuals, state, beatProgress * MAX_THETA)
      })
    })

    scene.timeline.beat('resolve', (beat) => {
      scene.addAnims(
        fadeIn(visuals.summary, { duration: 0.75, easing: 'ease-out' }),
        latex.mark(visuals.formula.part('ratio'), { color: COLORS.gold })
      )
      scene.addAnims(wait(3.5))
      beat.onEachTick(({ beatProgress }) => {
        setBeatState(state, 'resolve', beatProgress)
        setTrace(visuals, state, MAX_THETA)
      })
    })

    scene.onEachTick(() => {
      stateProbe.text = JSON.stringify({
        beat: state.beat,
        beatProgress: Number(state.beatProgress.toFixed(3)),
        theta: Number(state.theta.toFixed(6)),
        radius: Number(state.radius.toFixed(6)),
        turns: Number((state.theta / (Math.PI * 2)).toFixed(3))
      })
    })

    exposeScene(scene, visuals)
    registerVerifications(scene, frames, visuals, state)
  })
}

const createVisuals = async (): Promise<SceneVisuals> => {
  const title = await createText({
    text: 'Polar vs Cartesian',
    fontSize: 2.65,
    color: COLORS.ivory,
    anchorX: 'center',
    anchorY: 'top',
    textAlign: 'center'
  })
  title.name = 'PolarCartesianTitle'
  const formula = await createLatex({
    latex: String.raw`r(\theta)=2.8\sin\!\left(\dmClass{ratio}{1.6\theta}\right)`,
    fontSize: 2.15,
    color: COLORS.ivory,
    anchorX: 'center',
    anchorY: 'top'
  })
  formula.name = 'PolarCartesianFormula'
  const header = layout.flex(
    {
      name: 'PolarCartesianHeader',
      flexDirection: 'column',
      gap: 0.9,
      alignItems: 'center',
      anchorX: 'center',
      anchorY: 'top'
    },
    [title, formula]
  )
  header.position.set(0, 27, 0.4)

  const polar = await createPolarPlot()
  const cartesian = await createCartesianPlot()
  polar.root.position.set(POLAR_CENTER.x, POLAR_CENTER.y, 0)
  cartesian.root.position.set(GRAPH_CENTER.x, GRAPH_CENTER.y, 0)

  const polarDot = createCircle(0.28, { color: COLORS.ivory })
  polarDot.name = 'PolarTracePoint'
  polarDot.position.z = PLOT_DEPTH.markers
  const graphDot = createCircle(0.28, { color: COLORS.ivory })
  graphDot.name = 'CartesianTracePoint'
  graphDot.position.z = PLOT_DEPTH.markers
  const radialArm = createCurve({
    sampleCount: 2,
    pointAt: () => new THREE.Vector2(),
    stroke: { color: COLORS.gold, width: 0.055, opacity: 0.68 }
  })
  radialArm.name = 'PolarRadiusArm'
  radialArm.position.z = PLOT_DEPTH.liveGuides
  const graphGuide = createCurve({
    sampleCount: 2,
    pointAt: () => new THREE.Vector2(),
    stroke: { color: COLORS.gold, width: 0.045, opacity: 0.46 }
  })
  graphGuide.name = 'CartesianValueGuide'
  graphGuide.position.z = PLOT_DEPTH.liveGuides

  const polarMarkerRoot = new THREE.Group()
  polarMarkerRoot.name = 'PolarTraceMarkers'
  polarMarkerRoot.add(radialArm, polarDot)
  const graphMarkerRoot = new THREE.Group()
  graphMarkerRoot.name = 'CartesianTraceMarkers'
  graphMarkerRoot.add(graphGuide, graphDot)
  polar.root.add(polarMarkerRoot)
  cartesian.root.add(graphMarkerRoot)

  const turns = await createText({
    text: 'five turns around',
    fontSize: 1.16,
    color: COLORS.mint,
    anchorX: 'center',
    anchorY: 'middle'
  })
  const relation = await createText({
    text: 'the same samples become',
    fontSize: 1.08,
    color: COLORS.muted,
    anchorX: 'center',
    anchorY: 'middle'
  })
  const oscillations = await createText({
    text: 'eight radial oscillations',
    fontSize: 1.16,
    color: COLORS.coral,
    anchorX: 'center',
    anchorY: 'middle'
  })
  const summary = layout.flex(
    {
      name: 'PolarCartesianSummary',
      flexDirection: 'row',
      gap: 1.45,
      alignItems: 'center',
      anchorX: 'center',
      anchorY: 'middle'
    },
    [turns, relation, oscillations]
  )
  summary.position.set(0, -26.4, 0.4)

  const placeholder = new THREE.Group() as THREE.Group & { text: string }
  placeholder.text = ''
  return {
    header,
    title,
    formula,
    polar,
    cartesian,
    polarDot,
    graphDot,
    radialArm,
    graphGuide,
    markerGroups: [polarMarkerRoot, graphMarkerRoot],
    summary,
    stateProbe: placeholder
  }
}

const createPolarPlot = async (): Promise<PlotVisual> => {
  const root = new THREE.Group()
  root.name = 'PolarPlot'

  for (const radius of [4, 8, 12]) {
    const ring = createCurve({
      domain: [0, Math.PI * 2],
      sampleCount: 128,
      closed: true,
      pointAt: (angle) => new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius),
      stroke: {
        color: radius === 12 ? COLORS.quiet : COLORS.quieter,
        width: radius === 12 ? 0.075 : 0.045,
        opacity: radius === 12 ? 0.85 : 0.72
      }
    })
    ring.name = `PolarRing${radius}`
    root.add(ring)
  }

  for (let index = 0; index < 16; index++) {
    const angle = (index / 16) * Math.PI * 2
    root.add(
      guideLine(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(Math.cos(angle) * 12, Math.sin(angle) * 12, 0),
        index % 4 === 0 ? COLORS.quiet : COLORS.quieter,
        index % 4 === 0 ? 0.75 : 0.55
      )
    )
  }

  const angleLabels = [
    { latex: '0', x: 13.15, y: 0 },
    { latex: String.raw`\frac{\pi}{2}`, x: 0, y: 13.15 },
    { latex: String.raw`\pi`, x: -13.15, y: 0 },
    { latex: String.raw`\frac{3\pi}{2}`, x: 0, y: -13.15 }
  ]
  for (const item of angleLabels) {
    const label = await createLatex({
      latex: item.latex,
      fontSize: 0.7,
      color: COLORS.muted
    })
    label.position.set(item.x, item.y, 0.15)
    root.add(label)
  }

  const captionTitle = await createText({
    text: 'POLAR COORDINATES',
    fontSize: 1.08,
    color: COLORS.muted,
    anchorX: 'center',
    anchorY: 'top'
  })
  const captionFormula = await createLatex({
    latex: String.raw`(x,y)=(r\cos\theta,r\sin\theta)`,
    fontSize: 1.5,
    color: COLORS.ivory,
    anchorX: 'center',
    anchorY: 'top'
  })
  const caption = layout.flex(
    {
      name: 'PolarPlotCaption',
      flexDirection: 'column',
      gap: 0.55,
      alignItems: 'center',
      anchorX: 'center',
      anchorY: 'top'
    },
    [captionTitle, captionFormula]
  )
  caption.position.set(0, 19, 0.3)
  root.add(caption)

  const trace = createCurve({
    ...polarTracePath(0),
    sampleCount: 961,
    stroke: { color: COLORS.paleMint, width: 0.15 }
  })
  trace.name = 'PolarFunctionTrace'
  trace.position.z = PLOT_DEPTH.data
  root.add(trace)
  return { root, caption, trace }
}

const createCartesianPlot = async (): Promise<PlotVisual> => {
  const root = new THREE.Group()
  root.name = 'CartesianPlot'

  root.add(
    guideLine(new THREE.Vector3(-20.8, 0, 0), new THREE.Vector3(21, 0, 0), COLORS.quiet, 0.9),
    guideLine(new THREE.Vector3(-20, -11.3, 0), new THREE.Vector3(-20, 11.3, 0), COLORS.quiet, 0.9)
  )
  for (let turn = 0; turn <= 5; turn++) {
    const x = -20 + (turn / 5) * GRAPH_WIDTH
    root.add(
      guideLine(
        new THREE.Vector3(x, -10.5, 0),
        new THREE.Vector3(x, 10.5, 0),
        turn === 0 ? COLORS.quiet : COLORS.quieter,
        turn === 0 ? 0.8 : 0.55
      )
    )
    const label = await createLatex({
      latex: turn === 0 ? '0' : turn === 1 ? String.raw`2\pi` : String.raw`${turn * 2}\pi`,
      fontSize: 0.62,
      color: COLORS.muted
    })
    label.position.set(x, -11.65, 0.15)
    root.add(label)
  }
  for (const sign of [-1, 1]) {
    const y = sign * AMPLITUDE * GRAPH_SCALE_Y
    root.add(
      guideLine(new THREE.Vector3(-20, y, 0), new THREE.Vector3(20, y, 0), COLORS.quieter, 0.5)
    )
    const label = await createText({
      text: sign > 0 ? '+2.8' : '−2.8',
      fontSize: 0.68,
      color: COLORS.muted,
      anchorX: 'right',
      anchorY: 'middle',
      textAlign: 'right'
    })
    label.position.set(-21, y, 0.15)
    root.add(label)
  }
  const thetaLabel = await createLatex({
    latex: String.raw`\theta`,
    fontSize: 1.25,
    color: COLORS.gold
  })
  thetaLabel.position.set(21.45, 1.15, 0.2)
  root.add(thetaLabel)

  const captionTitle = await createText({
    text: 'CARTESIAN COORDINATES',
    fontSize: 1.08,
    color: COLORS.muted,
    anchorX: 'center',
    anchorY: 'top'
  })
  const captionFormula = await createLatex({
    latex: String.raw`(x,y)=(\theta,r(\theta))`,
    fontSize: 1.5,
    color: COLORS.ivory,
    anchorX: 'center',
    anchorY: 'top'
  })
  const caption = layout.flex(
    {
      name: 'CartesianPlotCaption',
      flexDirection: 'column',
      gap: 0.55,
      alignItems: 'center',
      anchorX: 'center',
      anchorY: 'top'
    },
    [captionTitle, captionFormula]
  )
  caption.position.set(0, 19, 0.3)
  root.add(caption)

  const trace = createCurve({
    ...cartesianTracePath(0),
    sampleCount: 961,
    stroke: { color: COLORS.blue, width: 0.14 }
  })
  trace.name = 'CartesianFunctionTrace'
  trace.position.z = PLOT_DEPTH.data
  root.add(trace)
  return { root, caption, trace }
}

const radiusAt = (theta: number): number => AMPLITUDE * Math.sin(FREQUENCY * theta)

const polarPoint = (theta: number): THREE.Vector2 => {
  const radius = radiusAt(theta) * POLAR_SCALE
  return new THREE.Vector2(Math.cos(theta) * radius, Math.sin(theta) * radius)
}

const graphPoint = (theta: number): THREE.Vector2 =>
  new THREE.Vector2(
    -GRAPH_WIDTH / 2 + (theta / MAX_THETA) * GRAPH_WIDTH,
    radiusAt(theta) * GRAPH_SCALE_Y
  )

const polarTracePath = (visibleThrough: number): CurvePath => ({
  domain: [0, MAX_THETA],
  pointAt: polarPoint,
  visibleAt: (theta) => theta <= visibleThrough + 1e-10
})

const cartesianTracePath = (visibleThrough: number): CurvePath => ({
  domain: [0, MAX_THETA],
  pointAt: graphPoint,
  visibleAt: (theta) => theta <= visibleThrough + 1e-10
})

const setTrace = (visuals: SceneVisuals, state: TraceState, theta: number): void => {
  const clamped = THREE.MathUtils.clamp(theta, 0, MAX_THETA)
  const polar = polarPoint(clamped)
  const graph = graphPoint(clamped)
  state.theta = clamped
  state.radius = radiusAt(clamped)
  visuals.polar.trace.setPath(polarTracePath(clamped))
  visuals.cartesian.trace.setPath(cartesianTracePath(clamped))
  visuals.polarDot.position.set(polar.x, polar.y, 0.5)
  visuals.graphDot.position.set(graph.x, graph.y, 0.5)
  visuals.radialArm.setPath({
    pointAt: (progress) => polar.clone().multiplyScalar(progress)
  })
  visuals.graphGuide.setPath({
    pointAt: (progress) => new THREE.Vector2(graph.x, graph.y * progress)
  })
}

const guideLine = (
  point1: THREE.Vector3,
  point2: THREE.Vector3,
  color: THREE.ColorRepresentation,
  opacity: number
): ReturnType<typeof createLine> => {
  const line = createLine({ point1, point2, color })
  const material = line.material as THREE.LineBasicMaterial
  material.transparent = true
  material.opacity = opacity
  material.depthWrite = false
  line.position.z = PLOT_DEPTH.guides
  return line
}

const setBeatState = (state: TraceState, beat: string, beatProgress: number): void => {
  state.beat = beat
  state.beatProgress = beatProgress
}

const exposeScene = (scene: AnimatedScene, visuals: SceneVisuals): void => {
  scene.expose('polar-cartesian-header-layout', visuals.header)
  scene.expose('polar-cartesian-formula', visuals.formula, { data: { semanticParts: true } })
  scene.expose('polar-cartesian-polar-plot', visuals.polar.root)
  scene.expose('polar-cartesian-cartesian-plot', visuals.cartesian.root)
  scene.expose('polar-cartesian-polar-trace', visuals.polar.trace)
  scene.expose('polar-cartesian-cartesian-trace', visuals.cartesian.trace)
  scene.expose('polar-cartesian-polar-markers', visuals.markerGroups[0])
  scene.expose('polar-cartesian-cartesian-markers', visuals.markerGroups[1])
  scene.expose('polar-cartesian-summary-layout', visuals.summary)
  scene.expose('polar-cartesian-state', visuals.stateProbe)
  scene.watchCollisions('polar-cartesian-header', visuals.header, {})
  scene.watchCollisions('polar-cartesian-summary', visuals.summary, {})
}

const registerVerifications = (
  scene: AnimatedScene,
  frames: BeatFrames,
  visuals: SceneVisuals,
  state: TraceState
): void => {
  scene.verify(
    'polar-cartesian-duration-and-beats',
    { frames: { start: frames.end - 1, end: frames.end } },
    (context) => {
      context.assert(scene.totalSceneTicks === frames.end, 'The explainer must last 26 seconds', {
        durationInFrames: scene.totalSceneTicks,
        expectedFrames: frames.end
      })
      context.assert(context.beat?.name === 'resolve', 'The final frame must belong to resolve', {
        beat: context.beat
      })
    }
  )

  scene.verify(
    'polar-cartesian-primitive-contract',
    { frames: { start: frames.intro, end: frames.end } },
    (context) => {
      const curves = [
        visuals.polar.trace,
        visuals.cartesian.trace,
        visuals.radialArm,
        visuals.graphGuide
      ]
      const layoutBacked = [
        visuals.header,
        visuals.polar.caption,
        visuals.cartesian.caption,
        visuals.summary
      ].every((item) => item.userData.definedMotionVisual === 'layout')
      context.assert(
        curves.every((item) => item.userData.definedMotionVisual === 'curve') && layoutBacked,
        'Foreground paths must use createCurve and typography groups must use layout',
        {
          frame: context.globalFrame,
          layoutBacked,
          curveKinds: curves.map((item) => item.userData.definedMotionVisual)
        }
      )
    }
  )

  scene.verify(
    'polar-cartesian-semantic-formula',
    { frames: { start: frames.intro, end: frames.end } },
    (context) => {
      context.assert(
        queryLaTeXClass(visuals.formula, 'ratio') !== null,
        'The non-integer frequency must remain semantically selectable',
        { frame: context.globalFrame, latex: visuals.formula.latex }
      )
    }
  )

  scene.verify(
    'polar-cartesian-trace-synchronization',
    { frames: { start: frames.trace, end: frames.end } },
    (context) => {
      const progress =
        context.globalFrame < frames.resolve
          ? (context.globalFrame - frames.trace) / (frames.resolve - frames.trace - 1)
          : 1
      const expectedTheta = THREE.MathUtils.clamp(progress, 0, 1) * MAX_THETA
      const expectedPolar = polarPoint(expectedTheta)
      const expectedGraph = graphPoint(expectedTheta)
      const tolerance = 2e-5
      const synchronized =
        Math.abs(state.theta - expectedTheta) < tolerance &&
        visuals.polarDot.position.distanceTo(
          new THREE.Vector3(expectedPolar.x, expectedPolar.y, 0.5)
        ) < tolerance &&
        visuals.graphDot.position.distanceTo(
          new THREE.Vector3(expectedGraph.x, expectedGraph.y, 0.5)
        ) < tolerance
      context.assert(synchronized, 'Both moving points must represent the same theta sample', {
        frame: context.globalFrame,
        expectedTheta,
        actualTheta: state.theta,
        polarDot: visuals.polarDot.position,
        graphDot: visuals.graphDot.position
      })
    }
  )

  scene.verify(
    'polar-cartesian-regions-readable',
    { frames: { start: frames.systems, end: frames.end } },
    (context) => {
      const header = context.screenBounds(visuals.header)
      const polar = context.screenBounds(visuals.polar.root)
      const cartesian = context.screenBounds(visuals.cartesian.root)
      const summary = context.isVisibleInHierarchy(visuals.summary)
        ? context.screenBounds(visuals.summary)
        : null
      const inViewport = [header, polar, cartesian, summary]
        .filter((bounds): bounds is ScreenBounds => bounds !== null)
        .every((bounds) =>
          insideViewport(bounds, context.viewport.width, context.viewport.height, 18)
        )
      const separated = polar !== null && cartesian !== null && polar.right + 24 <= cartesian.left
      context.assert(
        inViewport && separated,
        'Header and plots must remain readable and separated',
        {
          frame: context.globalFrame,
          header,
          polar,
          cartesian,
          summary,
          minimumPlotGap: 24
        }
      )
    }
  )

  scene.verify(
    'polar-cartesian-finite-curves',
    { frames: { start: frames.trace, end: frames.end } },
    (context) => {
      const curves = [
        visuals.polar.trace,
        visuals.cartesian.trace,
        visuals.radialArm,
        visuals.graphGuide
      ]
      const finite = curves.every((curve) =>
        Array.from(curve.geometry.getAttribute('position').array).every(Number.isFinite)
      )
      context.assert(finite, 'Every procedurally updated curve buffer must remain finite', {
        frame: context.globalFrame,
        finite
      })
    }
  )

  scene.verify(
    'polar-cartesian-final-rational-cycle',
    { frames: { start: frames.end - 1, end: frames.end } },
    (context) => {
      const turns = MAX_THETA / (Math.PI * 2)
      const oscillations = (FREQUENCY * MAX_THETA) / (Math.PI * 2)
      const endpoint = polarPoint(MAX_THETA)
      context.assert(
        Math.abs(turns - 5) < 1e-12 &&
          Math.abs(oscillations - 8) < 1e-12 &&
          endpoint.length() < 1e-10,
        'The 8/5 frequency must close after five turns and eight oscillations',
        { frame: context.globalFrame, turns, oscillations, endpoint }
      )
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
