import { AnimatedScene, SpaceSetting, defineScene, type ScreenBounds } from 'definedmotion'
import {
  createAnimation,
  fadeIn,
  fadeOut,
  moveTo,
  rotateTo,
  scaleIn,
  wait
} from 'definedmotion/animation'
import { createLatex, latex, queryLaTeXClass, type LatexVisual } from 'definedmotion/latex'
import {
  createRectangle,
  createText,
  layout,
  type LayoutVisual,
  type TextVisual
} from 'definedmotion/rendering'
import * as THREE from 'three'

export default defineScene({
  id: 'quadratic-formula-explainer',
  name: 'Quadratic Formula Explainer',
  create: quadraticFormulaExplainer
})

const COLORS = {
  background: '#07090b',
  ivory: '#f0ece2',
  muted: '#9ca5a6',
  mint: '#88c5ae',
  blue: '#70aebc',
  gold: '#d2ae59',
  coral: '#cf7864'
} as const

interface BeatFrames {
  readonly setup: number
  readonly normalize: number
  readonly completeSquare: number
  readonly factor: number
  readonly squareRoot: number
  readonly isolate: number
  readonly resolve: number
  readonly end: number
}

interface ProofState {
  beatName: string
  beatProgress: number
  timelineProgress: number
  completedSteps: number
}

interface SquareDiagram {
  readonly root: THREE.Group
  readonly xSquare: ReturnType<typeof createRectangle>
  readonly rightStrip: ReturnType<typeof createRectangle>
  readonly topStrip: ReturnType<typeof createRectangle>
  readonly corner: ReturnType<typeof createRectangle>
  readonly xLabel: LatexVisual
  readonly rightLabel: LatexVisual
  readonly topLabel: LatexVisual
  readonly cornerLabel: LatexVisual
  readonly caption: TextVisual
}

interface ProofVisuals {
  readonly root: THREE.Group
  readonly header: LayoutVisual
  readonly title: TextVisual
  readonly equationStage: LayoutVisual
  readonly equation: LatexVisual
  readonly diagram: SquareDiagram
  readonly stepsLayout: LayoutVisual
  readonly stepsList: LayoutVisual
  readonly stepRows: readonly LayoutVisual[]
  readonly finalNote: LayoutVisual
  readonly finalNoteText: TextVisual
  readonly stateProbe: THREE.Group & { text: string }
}

export function quadraticFormulaExplainer(): AnimatedScene {
  return new AnimatedScene(1280, 720, SpaceSetting.TwoDim, async (scene) => {
    scene.scene.background = new THREE.Color(COLORS.background)

    const visuals = await createProofVisuals()
    scene.add(visuals.root)

    const frames: BeatFrames = {
      setup: 0,
      normalize: scene.secondsToFrames(5),
      completeSquare: scene.secondsToFrames(11),
      factor: scene.secondsToFrames(19),
      squareRoot: scene.secondsToFrames(26),
      isolate: scene.secondsToFrames(33),
      resolve: scene.secondsToFrames(40),
      end: scene.secondsToFrames(44)
    }

    scene.timeline.defineBeats({
      setup: { start: frames.setup, end: frames.normalize },
      normalize: { start: frames.normalize, end: frames.completeSquare },
      'complete-square': { start: frames.completeSquare, end: frames.factor },
      factor: { start: frames.factor, end: frames.squareRoot },
      'square-root': { start: frames.squareRoot, end: frames.isolate },
      isolate: { start: frames.isolate, end: frames.resolve },
      resolve: { start: frames.resolve, end: frames.end }
    })

    const state: ProofState = {
      beatName: 'setup',
      beatProgress: 0,
      timelineProgress: 0,
      completedSteps: 0
    }
    const equationRootId = visuals.equation.uuid

    const normalizeEquation = String.raw`x^2+\dmClass{linear}{\frac{b}{a}}x=-\dmClass{constant}{\frac{c}{a}}`
    const completeEquation = String.raw`x^2+\frac{b}{a}x+\dmClass{added}{\left(\frac{b}{2a}\right)^2}=-\frac{c}{a}+\dmClass{added}{\left(\frac{b}{2a}\right)^2}`
    const factorEquation = String.raw`\dmClass{binomial}{\left(x+\frac{b}{2a}\right)^2}=\dmClass{rhs}{\frac{b^2-4ac}{4a^2}}`
    const rootEquation = String.raw`x+\frac{b}{2a}=\dmClass{sign}{\pm}\frac{\sqrt{\dmClass{disc}{b^2-4ac}}}{2a}`
    const finalEquation = String.raw`\dmClass{solution}{x=\frac{-b\pm\sqrt{\dmClass{disc}{b^2-4ac}}}{2a}}`

    const normalizeMorph = await latex.morphTo(visuals.equation, {
      latex: normalizeEquation,
      duration: 1.55,
      particleCount: 2500,
      easing: 'ease-in-out'
    })
    const completeMorph = await latex.morphTo(visuals.equation, {
      latex: completeEquation,
      duration: 1.8,
      particleCount: 2500,
      easing: 'ease-in-out'
    })
    const factorMorph = await latex.morphTo(visuals.equation, {
      latex: factorEquation,
      duration: 1.65,
      particleCount: 2500,
      easing: 'ease-in-out'
    })
    const rootMorph = await latex.morphTo(visuals.equation, {
      latex: rootEquation,
      duration: 1.65,
      particleCount: 2500,
      easing: 'ease-in-out'
    })
    const finalMorph = await latex.morphTo(visuals.equation, {
      latex: finalEquation,
      duration: 1.7,
      particleCount: 2500,
      easing: 'ease-in-out'
    })

    const pointer = scene.getTimelinePointer()
    scene.addAnims(
      createAnimation({
        duration: 44,
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
    scene.setTimelinePointer(pointer)

    scene.timeline.beat('setup', (beat) => {
      scene.addAnims(
        fadeIn(visuals.header, { duration: 0.75, easing: 'ease-out' }),
        scaleIn(visuals.equationStage, { duration: 0.8, from: 0.965, easing: 'ease-out' }),
        latex.write(visuals.equation, { duration: 1.4, easing: 'linear' })
      )
      scene.addAnims(wait(0.35))
      scene.addAnims(
        latex.mark(visuals.equation.part('coefficients'), {
          color: COLORS.coral
        })
      )
      scene.addAnims(wait(0.75))
      beat.onEachTick(({ beatProgress }) => setBeatState(state, 'setup', beatProgress))
    })

    scene.timeline.beat('normalize', (beat) => {
      scene.do(() => {
        visuals.stepsList.append(visuals.stepRows[0])
        state.completedSteps = 1
      })
      scene.addAnims(
        fadeIn(visuals.stepsLayout, { duration: 0.55, easing: 'ease-out' }),
        normalizeMorph
      )
      scene.addAnims(
        latex.highlight(visuals.equation.part('linear'), {
          duration: 0.75,
          color: COLORS.blue,
          pulses: 1
        })
      )
      scene.addAnims(wait(1.7))
      beat.onEachTick(({ beatProgress }) => setBeatState(state, 'normalize', beatProgress))
    })

    scene.timeline.beat('complete-square', (beat) => {
      scene.do(() => {
        visuals.stepsList.append(visuals.stepRows[1])
        state.completedSteps = 2
      })
      scene.addAnims(
        fadeIn(visuals.diagram.root, { duration: 0.7, easing: 'ease-out' }),
        fadeIn(visuals.stepRows[1], { duration: 0.45, easing: 'ease-out' })
      )
      scene.addAnims(wait(0.45))
      scene.addAnims(
        completeMorph,
        moveTo(visuals.diagram.topStrip, new THREE.Vector3(0, 7.4, 0), {
          duration: 1.55,
          easing: 'ease-in-out'
        }),
        rotateTo(visuals.diagram.topStrip, new THREE.Euler(0, 0, Math.PI / 2), {
          duration: 1.55,
          easing: 'ease-in-out'
        })
      )
      scene.addAnims(
        fadeIn(visuals.diagram.corner, { duration: 0.45, easing: 'ease-out' }),
        scaleIn(visuals.diagram.corner, { duration: 0.45, from: 0.2, easing: 'ease-out' }),
        fadeIn(visuals.diagram.rightLabel, { duration: 0.4, easing: 'ease-out' }),
        fadeIn(visuals.diagram.topLabel, { duration: 0.4, easing: 'ease-out' }),
        fadeIn(visuals.diagram.cornerLabel, { duration: 0.4, easing: 'ease-out' })
      )
      scene.addAnims(
        latex.mark(visuals.equation.part('added'), {
          color: COLORS.gold
        })
      )
      scene.addAnims(wait(1.2))
      beat.onEachTick(({ beatProgress }) =>
        setBeatState(state, 'complete-square', beatProgress)
      )
    })

    scene.timeline.beat('factor', (beat) => {
      scene.do(() => {
        visuals.stepsList.append(visuals.stepRows[2])
        state.completedSteps = 3
      })
      scene.addAnims(
        factorMorph,
        fadeIn(visuals.stepRows[2], { duration: 0.45, easing: 'ease-out' })
      )
      scene.addAnims(
        latex.highlight(visuals.equation.part('binomial'), {
          duration: 0.85,
          color: COLORS.mint,
          pulses: 1
        }),
        scaleIn(visuals.diagram.root, { duration: 0.65, from: 0.985, easing: 'ease-out' })
      )
      scene.addAnims(wait(2.1))
      beat.onEachTick(({ beatProgress }) => setBeatState(state, 'factor', beatProgress))
    })

    scene.timeline.beat('square-root', (beat) => {
      scene.do(() => {
        visuals.stepsList.append(visuals.stepRows[3])
        state.completedSteps = 4
      })
      scene.addAnims(
        rootMorph,
        fadeIn(visuals.stepRows[3], { duration: 0.45, easing: 'ease-out' })
      )
      scene.addAnims(
        latex.mark(visuals.equation.part('sign'), {
          color: COLORS.coral
        })
      )
      scene.addAnims(wait(2.25))
      beat.onEachTick(({ beatProgress }) => setBeatState(state, 'square-root', beatProgress))
    })

    scene.timeline.beat('isolate', (beat) => {
      scene.addAnims(
        finalMorph,
        fadeOut(visuals.diagram.caption, { duration: 0.45, easing: 'ease-in-out' })
      )
      scene.addAnims(
        latex.highlight(visuals.equation.part('disc'), {
          duration: 0.9,
          color: COLORS.gold,
          pulses: 1
        })
      )
      scene.addAnims(wait(2.2))
      beat.onEachTick(({ beatProgress }) => setBeatState(state, 'isolate', beatProgress))
    })

    scene.timeline.beat('resolve', (beat) => {
      scene.addAnims(
        fadeOut(visuals.diagram.root, { duration: 0.65, easing: 'ease-in-out' }),
        fadeOut(visuals.stepsLayout, { duration: 0.65, easing: 'ease-in-out' })
      )
      scene.addAnims(
        fadeIn(visuals.finalNote, { duration: 0.65, easing: 'ease-out' }),
        scaleIn(visuals.finalNote, { duration: 0.65, from: 0.96, easing: 'ease-out' })
      )
      scene.addAnims(
        latex.mark(visuals.equation.part('solution'), {
          color: COLORS.mint
        })
      )
      scene.addAnims(wait(0.2))
      beat.onEachTick(({ beatProgress }) => setBeatState(state, 'resolve', beatProgress))
    })

    scene.onEachTick(() => {
      visuals.stateProbe.text = JSON.stringify({
        beat: state.beatName,
        beatProgress: Number(state.beatProgress.toFixed(3)),
        timelineProgress: Number(state.timelineProgress.toFixed(3)),
        completedSteps: state.completedSteps,
        equation: visuals.equation.latex
      })
    })

    exposeProof(scene, visuals)
    addInspectionCameras(scene)
    registerVerifications(scene, frames, visuals, state, equationRootId, {
      normalizeEquation,
      completeEquation,
      factorEquation,
      rootEquation,
      finalEquation
    })
  })
}

const createProofVisuals = async (): Promise<ProofVisuals> => {
  const root = new THREE.Group()
  root.name = 'QuadraticFormulaExplainer'

  const title = await createText({
    text: 'Complete the square, then the formula appears.',
    fontSize: 2.35,
    color: COLORS.ivory,
    maxWidth: 88,
    lineHeight: 1.02,
    textAlign: 'center',
    anchorX: 'center',
    anchorY: 'top'
  })
  const header = layout.flex(
    {
      flexDirection: 'column',
      width: 90,
      alignItems: 'center',
      anchorX: 'center',
      anchorY: 'top'
    },
    [title]
  )
  header.name = 'QuadraticHeader'
  header.position.set(0, 26.2, 0)

  const equation = await createLatex({
    latex: String.raw`\dmClass{coefficients}{a}x^2+\dmClass{coefficients}{b}x+\dmClass{coefficients}{c}=0`,
    fontSize: 2.9,
    color: COLORS.ivory,
    anchorX: 'center',
    anchorY: 'middle'
  })
  const equationStage = layout.flex(
    {
      flexDirection: 'column',
      width: 92,
      height: 11.8,
      alignItems: 'center',
      justifyContent: 'center',
      anchorX: 'center',
      anchorY: 'middle'
    },
    [equation]
  )
  equationStage.name = 'QuadraticEquationStage'
  equationStage.position.set(0, 8.2, 0)

  const diagram = await createSquareDiagram()
  diagram.root.position.set(-21.5, -10.8, 0)
  diagram.root.visible = false

  const stepRows = await Promise.all([
    createStepRow('01', 'Divide every term by a', COLORS.blue),
    createStepRow('02', 'Add the missing corner', COLORS.gold),
    createStepRow('03', 'Factor the completed square', COLORS.mint),
    createStepRow('04', 'Take both square roots', COLORS.coral)
  ])
  const stepsIntro = await createText({
    text: 'PROOF STEPS',
    fontSize: 0.62,
    color: COLORS.mint,
    anchorX: 'left',
    anchorY: 'top'
  })
  const stepsGuide = await createText({
    text: 'Each operation keeps the solution set unchanged.',
    fontSize: 0.82,
    color: COLORS.muted,
    maxWidth: 34,
    lineHeight: 1.3,
    textAlign: 'left',
    anchorX: 'left',
    anchorY: 'top'
  })
  const stepsList = layout.flex(
    {
      flexDirection: 'column',
      width: 35,
      gap: 1.15,
      alignItems: 'flex-start',
      anchorX: 'left',
      anchorY: 'top'
    },
    [stepsGuide]
  )
  stepsList.name = 'QuadraticStepsList'
  const stepsLayout = layout.flex(
    {
      flexDirection: 'column',
      width: 35,
      gap: 0.95,
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      anchorX: 'left',
      anchorY: 'top'
    },
    [stepsIntro, stepsList]
  )
  stepsLayout.name = 'QuadraticStepsLayout'
  stepsLayout.position.set(12, -1.5, 0)
  stepsLayout.visible = false

  const finalNoteText = await createText({
    text: 'The discriminant b² − 4ac is the quantity left under the square root.',
    fontSize: 1.2,
    color: COLORS.ivory,
    maxWidth: 52,
    lineHeight: 1.28,
    textAlign: 'center',
    anchorX: 'center',
    anchorY: 'middle'
  })
  const finalNote = layout.flex(
    {
      flexDirection: 'column',
      width: 70,
      height: 4.6,
      alignItems: 'center',
      justifyContent: 'center',
      anchorX: 'center',
      anchorY: 'middle'
    },
    [finalNoteText]
  )
  finalNote.name = 'QuadraticFinalNote'
  finalNote.position.set(0, -10.8, 0)
  finalNote.visible = false

  const stateProbe = new THREE.Group() as THREE.Group & { text: string }
  stateProbe.name = 'QuadraticFormulaState'
  stateProbe.text = ''

  root.add(
    header,
    equationStage,
    diagram.root,
    stepsLayout,
    finalNote,
    stateProbe
  )
  return {
    root,
    header,
    title,
    equationStage,
    equation,
    diagram,
    stepsLayout,
    stepsList,
    stepRows,
    finalNote,
    finalNoteText,
    stateProbe
  }
}

const createSquareDiagram = async (): Promise<SquareDiagram> => {
  const root = new THREE.Group()
  root.name = 'CompletingSquareDiagram'

  const xSquare = createRectangle(12, 12, {
    color: '#14252a',
    stroke: { color: COLORS.blue, width: 0.09, placement: 'inside' }
  })
  xSquare.name = 'XSquaredArea'

  const rightStrip = createRectangle(2.8, 12, {
    color: '#25322f',
    stroke: { color: COLORS.mint, width: 0.09, placement: 'inside' }
  })
  rightStrip.name = 'RightHalfLinearArea'
  rightStrip.position.set(7.4, 0, 0)

  const topStrip = createRectangle(2.8, 12, {
    color: '#25322f',
    stroke: { color: COLORS.mint, width: 0.09, placement: 'inside' }
  })
  topStrip.name = 'TopHalfLinearArea'
  topStrip.position.set(10.4, 0, 0)

  const corner = createRectangle(2.8, 2.8, {
    color: COLORS.gold,
    stroke: { color: '#f0d383', width: 0.08, placement: 'inside' }
  })
  corner.name = 'MissingCornerArea'
  corner.position.set(7.4, 7.4, 0.02)
  corner.visible = false

  const xLabel = await createLatex({
    latex: String.raw`x^2`,
    fontSize: 1.8,
    color: COLORS.ivory
  })
  xLabel.position.set(0, 0, 0.05)

  const rightLabel = await createLatex({
    latex: String.raw`\frac{b}{2a}x`,
    fontSize: 1.45,
    color: COLORS.ivory
  })
  rightLabel.position.set(11.15, 0, 0.05)
  rightLabel.visible = false

  const topLabel = await createLatex({
    latex: String.raw`\frac{b}{2a}x`,
    fontSize: 1.45,
    color: COLORS.ivory
  })
  topLabel.position.set(0, 11.35, 0.05)
  topLabel.visible = false

  const cornerLabel = await createLatex({
    latex: String.raw`\left(\frac{b}{2a}\right)^2`,
    fontSize: 1.05,
    color: COLORS.gold
  })
  cornerLabel.position.set(11.55, 7.4, 0.06)
  cornerLabel.visible = false

  const caption = await createText({
    text: 'Split the linear term. The missing corner completes a square.',
    fontSize: 1,
    color: COLORS.muted,
    maxWidth: 38,
    lineHeight: 1.25,
    textAlign: 'center',
    anchorX: 'center',
    anchorY: 'middle'
  })
  caption.position.set(1.4, -9.2, 0)

  root.add(
    xSquare,
    rightStrip,
    topStrip,
    corner,
    xLabel,
    rightLabel,
    topLabel,
    cornerLabel,
    caption
  )
  return {
    root,
    xSquare,
    rightStrip,
    topStrip,
    corner,
    xLabel,
    rightLabel,
    topLabel,
    cornerLabel,
    caption
  }
}

const createStepRow = async (
  number: string,
  text: string,
  color: THREE.ColorRepresentation
): Promise<LayoutVisual> => {
  const numberText = await createText({
    text: number,
    fontSize: 1.08,
    color,
    anchorX: 'left',
    anchorY: 'middle'
  })
  const description = await createText({
    text,
    fontSize: 1.32,
    color: COLORS.ivory,
    maxWidth: 29,
    lineHeight: 1.2,
    textAlign: 'left',
    anchorX: 'left',
    anchorY: 'middle'
  })
  const row = layout.flex(
    {
      flexDirection: 'row',
      width: 35,
      gap: 1.2,
      alignItems: 'center',
      anchorX: 'left',
      anchorY: 'top'
    },
    [numberText, description]
  )
  row.name = `QuadraticStep${number}`
  return row
}

const setBeatState = (state: ProofState, beatName: string, beatProgress: number): void => {
  state.beatName = beatName
  state.beatProgress = beatProgress
}

const exposeProof = (scene: AnimatedScene, visuals: ProofVisuals): void => {
  scene.expose('quadratic-proof', visuals.root, {
    description: 'Complete quadratic-formula derivation with synchronized geometric construction'
  })
  scene.expose('quadratic-header-layout', visuals.header)
  scene.expose('quadratic-equation-stage', visuals.equationStage)
  scene.expose('quadratic-equation', visuals.equation, { data: { semanticParts: true } })
  scene.expose('quadratic-square-diagram', visuals.diagram.root)
  scene.expose('quadratic-x-squared-area', visuals.diagram.xSquare)
  scene.expose('quadratic-right-half-area', visuals.diagram.rightStrip)
  scene.expose('quadratic-top-half-area', visuals.diagram.topStrip)
  scene.expose('quadratic-missing-corner', visuals.diagram.corner)
  scene.expose('quadratic-steps-layout', visuals.stepsLayout)
  scene.expose('quadratic-steps-list', visuals.stepsList)
  scene.expose('quadratic-final-note', visuals.finalNote)
  scene.expose('quadratic-state', visuals.stateProbe)

  scene.watchCollisions('quadratic-header', visuals.header, {})
  scene.watchCollisions('quadratic-equation-stage', visuals.equationStage, {})
  scene.watchCollisions('quadratic-steps-layout', visuals.stepsLayout, {})
  scene.watchCollisions('quadratic-final-note', visuals.finalNote, {})
}

const addInspectionCameras = (scene: AnimatedScene): void => {
  const aspect = scene.width / scene.height
  const equation = scene.exposeCamera(
    'equation-focus',
    new THREE.OrthographicCamera(-30 * aspect, 30 * aspect, 30, -30, 1, 1000),
    {
      description: 'Centered view for inspecting formula morphing and semantic selections',
      tags: ['equation', 'latex', 'semantic-parts']
    }
  )
  equation.position.set(0, 3, 30)
  equation.zoom = 1.8
  equation.updateProjectionMatrix()

  const geometry = scene.exposeCamera(
    'geometry-focus',
    new THREE.OrthographicCamera(-30 * aspect, 30 * aspect, 30, -30, 1, 1000),
    {
      description: 'Close view of the completed-square area construction',
      tags: ['geometry', 'layout', 'proof']
    }
  )
  geometry.position.set(-19.5, -12, 30)
  geometry.zoom = 2.5
  geometry.updateProjectionMatrix()
}

const registerVerifications = (
  scene: AnimatedScene,
  frames: BeatFrames,
  visuals: ProofVisuals,
  state: ProofState,
  equationRootId: string,
  equations: {
    normalizeEquation: string
    completeEquation: string
    factorEquation: string
    rootEquation: string
    finalEquation: string
  }
): void => {
  scene.verify(
    'quadratic-duration-and-beats',
    { frames: { start: frames.end - 1, end: frames.end } },
    (context) => {
      context.assert(scene.totalSceneTicks === frames.end, 'The explainer must last 44 seconds', {
        durationInFrames: scene.totalSceneTicks,
        expectedFrames: frames.end,
        fps: scene.fps
      })
      context.assert(context.beat?.name === 'resolve', 'The final frame must belong to resolve', {
        beat: context.beat
      })
    }
  )

  scene.verify(
    'quadratic-equation-root-stable',
    { frames: { start: frames.setup, end: frames.end } },
    (context) => {
      context.assert(
        visuals.equation.uuid === equationRootId,
        'The LaTeX root must remain stable through the complete derivation',
        { frame: context.globalFrame, equationRootId, actualRootId: visuals.equation.uuid }
      )
    }
  )

  scene.verify(
    'quadratic-equation-readable',
    { frames: { start: frames.setup, end: frames.end } },
    (context) => {
      const equationBounds = context.screenBounds(visuals.equation)
      context.assert(
        equationBounds !== null &&
          equationBounds.height >= 32 &&
          insideViewport(equationBounds, context.viewport.width, context.viewport.height, 40),
        'Every intermediate equation must remain readable and clear of the viewport edge',
        { frame: context.globalFrame, equationBounds, minimumHeight: 32, viewportMargin: 40 }
      )
    }
  )

  scene.verify(
    'quadratic-primary-regions-in-viewport',
    { frames: { start: frames.setup, end: frames.end } },
    (context) => {
      const visibleRegions = [
        visuals.header,
        visuals.equationStage,
        visuals.diagram.root,
        visuals.stepsLayout,
        visuals.finalNote
      ].filter((object) => isVisibleInHierarchy(object))
      const bounds = visibleRegions.map((object) => ({ name: object.name, bounds: context.screenBounds(object) }))
      context.assert(
        bounds.every(({ bounds: current }) =>
          insideViewport(current, context.viewport.width, context.viewport.height, 20)
        ),
        'Every visible primary region must remain inside the viewport',
        { frame: context.globalFrame, bounds }
      )
    }
  )

  scene.verify(
    'quadratic-primary-regions-separated',
    { frames: { start: frames.completeSquare, end: frames.resolve } },
    (context) => {
      const equationBounds = context.screenBounds(visuals.equationStage)
      const diagramBounds = context.screenBounds(visuals.diagram.root)
      const stepsBounds = context.screenBounds(visuals.stepsLayout)
      context.assert(
        equationBounds !== null &&
          diagramBounds !== null &&
          stepsBounds !== null &&
          equationBounds.bottom + 12 <= Math.min(diagramBounds.top, stepsBounds.top) &&
          diagramBounds.right + 12 <= stepsBounds.left,
        'Equation, geometry, and proof-step regions must remain visually separated',
        { frame: context.globalFrame, equationBounds, diagramBounds, stepsBounds }
      )
    }
  )

  const checkpoints = [
    {
      id: 'normalized',
      frame: frames.completeSquare - 1,
      latex: equations.normalizeEquation,
      parts: ['linear', 'constant']
    },
    {
      id: 'completed-square',
      frame: frames.factor - 1,
      latex: equations.completeEquation,
      parts: ['added']
    },
    {
      id: 'factored',
      frame: frames.squareRoot - 1,
      latex: equations.factorEquation,
      parts: ['binomial', 'rhs']
    },
    {
      id: 'square-rooted',
      frame: frames.isolate - 1,
      latex: equations.rootEquation,
      parts: ['sign', 'disc']
    },
    {
      id: 'isolated',
      frame: frames.resolve - 1,
      latex: equations.finalEquation,
      parts: ['solution', 'disc']
    }
  ] as const
  checkpoints.forEach((checkpoint) => {
    scene.verify(
      `quadratic-equation-${checkpoint.id}`,
      { frames: { start: checkpoint.frame, end: checkpoint.frame + 1 } },
      (context) => {
        const missingParts = checkpoint.parts.filter(
          (part) => queryLaTeXClass(visuals.equation, part) === null
        )
        context.assert(
          visuals.equation.latex === checkpoint.latex,
          `The ${checkpoint.id} checkpoint must contain the authored equation`,
          {
            frame: context.globalFrame,
            expected: checkpoint.latex,
            actual: visuals.equation.latex
          }
        )
        context.assert(
          missingParts.length === 0,
          `The ${checkpoint.id} checkpoint must expose every semantic part`,
          { frame: context.globalFrame, missingParts }
        )
      }
    )
  })

  scene.verify(
    'quadratic-step-list-progresses',
    { frames: { start: frames.normalize, end: frames.resolve } },
    (context) => {
      const expected =
        context.globalFrame < frames.completeSquare
          ? 1
          : context.globalFrame < frames.factor
            ? 2
            : context.globalFrame < frames.squareRoot
              ? 3
              : 4
      context.assert(
        state.completedSteps === expected && visuals.stepsList.items.length === expected + 1,
        'The proof-step list must reflect the completed operations at this frame',
        {
          frame: context.globalFrame,
          expected,
          completedSteps: state.completedSteps,
          listItemCount: visuals.stepsList.items.length
        }
      )
    }
  )

  scene.verify(
    'quadratic-proof-steps-readable',
    { frames: { start: frames.normalize, end: frames.resolve } },
    (context) => {
      const attachedRows = visuals.stepRows.filter((row) => row.parent !== null)
      const rowBounds = attachedRows.map((item) => context.screenBounds(item))
      const readable = rowBounds.every(
        (bounds) => bounds !== null && bounds.height >= 18
      )
      const separated = rowBounds.every(
        (bounds, index) =>
          index === 0 ||
          (bounds !== null &&
            rowBounds[index - 1] !== null &&
            rowBounds[index - 1]!.bottom + 8 <= bounds.top)
      )
      context.assert(
        readable && separated,
        'Every dynamically appended proof step must remain readable and visually separated',
        { frame: context.globalFrame, rowBounds, minimumHeight: 18, minimumGap: 8 }
      )
    }
  )

  scene.verify(
    'quadratic-completed-square-geometry',
    { frames: { start: frames.factor, end: frames.resolve } },
    (context) => {
      const square = context.worldBounds(visuals.diagram.xSquare)
      const right = context.worldBounds(visuals.diagram.rightStrip)
      const top = context.worldBounds(visuals.diagram.topStrip)
      const corner = context.worldBounds(visuals.diagram.corner)
      const tolerance = 1e-5
      const aligned =
        Math.abs(square.max.x - right.min.x) < tolerance &&
        Math.abs(square.max.y - top.min.y) < tolerance &&
        Math.abs(square.max.x - corner.min.x) < tolerance &&
        Math.abs(square.max.y - corner.min.y) < tolerance &&
        Math.abs(right.max.y - square.max.y) < tolerance &&
        Math.abs(top.max.x - square.max.x) < tolerance &&
        Math.abs(corner.max.x - right.max.x) < tolerance &&
        Math.abs(corner.max.y - top.max.y) < tolerance
      const outerWidth = corner.max.x - square.min.x
      const outerHeight = corner.max.y - square.min.y
      context.assert(aligned, 'The four pieces must meet without gaps or overlap', {
        frame: context.globalFrame,
        square,
        right,
        top,
        corner
      })
      context.assert(
        Math.abs(outerWidth - outerHeight) < tolerance,
        'Adding the missing corner must produce a true square',
        { frame: context.globalFrame, outerWidth, outerHeight }
      )
    }
  )

  scene.verify(
    'quadratic-geometry-labels-outside-tiles',
    { frames: { start: frames.factor, end: frames.resolve } },
    (context) => {
      const topTile = context.worldBounds(visuals.diagram.topStrip)
      const rightTile = context.worldBounds(visuals.diagram.rightStrip)
      const cornerTile = context.worldBounds(visuals.diagram.corner)
      const topLabel = context.worldBounds(visuals.diagram.topLabel)
      const rightLabel = context.worldBounds(visuals.diagram.rightLabel)
      const cornerLabel = context.worldBounds(visuals.diagram.cornerLabel)
      const gap = 0.75
      context.assert(
        topLabel.min.y >= topTile.max.y + gap &&
          rightLabel.min.x >= rightTile.max.x + gap &&
          cornerLabel.min.x >= cornerTile.max.x + gap,
        'Geometric expressions must remain external annotations rather than overflow their tiles',
        {
          frame: context.globalFrame,
          gap,
          topTile,
          topLabel,
          rightTile,
          rightLabel,
          cornerTile,
          cornerLabel
        }
      )
    }
  )

  scene.verify(
    'quadratic-final-note-readable',
    { frames: { start: frames.resolve, end: frames.end } },
    (context) => {
      const noteBounds = context.screenBounds(visuals.finalNoteText)
      context.assert(
        noteBounds !== null &&
          noteBounds.height >= 16 &&
          insideViewport(noteBounds, context.viewport.width, context.viewport.height, 40),
        'The final discriminant note must remain readable and clear of the viewport edge',
        { frame: context.globalFrame, noteBounds, minimumHeight: 16, viewportMargin: 40 }
      )
    }
  )
}

const isVisibleInHierarchy = (object: THREE.Object3D): boolean => {
  let current: THREE.Object3D | null = object
  while (current) {
    if (!current.visible) return false
    current = current.parent
  }
  return true
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

const containsWithMargin = (
  outer: ScreenBounds | null,
  inner: ScreenBounds | null,
  margin: number
): boolean =>
  outer !== null &&
  inner !== null &&
  inner.left >= outer.left + margin &&
  inner.right <= outer.right - margin &&
  inner.top >= outer.top + margin &&
  inner.bottom <= outer.bottom - margin
