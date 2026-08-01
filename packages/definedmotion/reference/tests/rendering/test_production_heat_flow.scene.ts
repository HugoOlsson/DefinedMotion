import { AnimatedScene, SpaceSetting, defineScene, type ScreenBounds } from 'definedmotion'
import { fadeIn, fadeOut, moveTo, scaleIn, wait } from 'definedmotion/animation'
import { createLatex, latex } from 'definedmotion/latex'
import { createCircle, createRectangle, createText, layout } from 'definedmotion/rendering'
import * as THREE from 'three'

export default defineScene({
  id: 'test-production-heat-flow',
  name: 'Production Heat Flow Explainer Contract',
  isTest: true,
  create: testProductionHeatFlow
})

interface HeatSpot {
  readonly root: THREE.Mesh
  readonly material: THREE.MeshBasicMaterial
  readonly start: THREE.Vector3
  readonly target: THREE.Vector3
  readonly initialTemperature: number
}

const COLD = new THREE.Color('#38bdf8')
const HOT = new THREE.Color('#fb7185')
const EVEN = new THREE.Color('#fbbf24')
const EVEN_LIGHT = new THREE.Color('#fde68a')

export function testProductionHeatFlow(): AnimatedScene {
  return new AnimatedScene(1200, 675, SpaceSetting.TwoDim, async (scene) => {
    scene.scene.background = new THREE.Color('#050816')

    const leftPanel = createRectangle(25.5, 25.5, {
      color: '#0b1220',
      stroke: { color: '#1e3a5f', width: 0.08, placement: 'inside' }
    })
    leftPanel.position.set(-13.35, 0, -3)
    const rightPanel = createRectangle(24.5, 25.5, {
      color: '#0c1424',
      stroke: { color: '#243b5a', width: 0.08, placement: 'inside' }
    })
    rightPanel.position.set(12.65, 0, -3)

    const title = await createText({
      text: 'WHY STIRRING WORKS',
      fontSize: 1.55,
      color: '#f8fafc',
      anchorX: 'left',
      anchorY: 'top'
    })
    const subtitle = await createText({
      text: 'Cold spots are a distribution problem—not a power problem.',
      fontSize: 0.83,
      color: '#7dd3fc',
      maxWidth: 21,
      lineHeight: 1.25,
      textAlign: 'left',
      anchorX: 'left',
      anchorY: 'top'
    })
    const equation = await createLatex({
      latex: String.raw`\dmClass{energy}{Q}=\dmClass{mass}{mc}\dmClass{temperature}{\Delta T}`,
      fontSize: 3.25,
      color: '#f8fafc',
      anchorX: 'left',
      anchorY: 'top'
    })
    const explanation = await createText({
      text: 'The same absorbed energy can still leave neighboring regions at very different temperatures.',
      fontSize: 0.88,
      color: '#cbd5e1',
      maxWidth: 21,
      lineHeight: 1.3,
      textAlign: 'left',
      anchorX: 'left',
      anchorY: 'top'
    })
    const takeaway = await createText({
      text: 'STIR + REST  →  LOWER TEMPERATURE SPREAD',
      fontSize: 0.9,
      color: '#fbbf24',
      maxWidth: 21,
      lineHeight: 1.2,
      textAlign: 'left',
      anchorX: 'left',
      anchorY: 'top'
    })
    takeaway.visible = false

    const leftColumn = layout.flex(
      {
        flexDirection: 'column',
        width: 21.5,
        gap: 1,
        alignItems: 'flex-start',
        anchorX: 'left',
        anchorY: 'top'
      },
      [title, subtitle, equation, explanation, takeaway]
    )
    leftColumn.position.set(-23.6, 10.1, 0)

    const diagramTitle = await createText({
      text: 'TEMPERATURE FIELD',
      fontSize: 1.05,
      color: '#94a3b8',
      anchorX: 'center',
      anchorY: 'middle'
    })
    diagramTitle.position.set(12.65, 9.8, 0)

    const diagram = createHeatDiagram()
    diagram.root.position.set(12.65, 0.4, 0)

    const unevenStatus = await createText({
      text: 'HIGH SPREAD  /  COLD SPOTS REMAIN',
      fontSize: 0.72,
      color: '#fb7185',
      anchorX: 'center',
      anchorY: 'middle'
    })
    unevenStatus.position.set(12.65, -9.8, 0)
    unevenStatus.visible = false
    const mixingStatus = await createText({
      text: 'REDISTRIBUTING ABSORBED ENERGY',
      fontSize: 0.72,
      color: '#7dd3fc',
      anchorX: 'center',
      anchorY: 'middle'
    })
    mixingStatus.position.copy(unevenStatus.position)
    mixingStatus.visible = false
    const uniformStatus = await createText({
      text: 'LOW SPREAD  /  HEAT IS EVEN',
      fontSize: 0.72,
      color: '#fbbf24',
      anchorX: 'center',
      anchorY: 'middle'
    })
    uniformStatus.position.copy(unevenStatus.position)
    uniformStatus.visible = false

    equation.visible = false
    const composition = new THREE.Group()
    composition.scale.setScalar(1.9)
    composition.add(
      leftPanel,
      rightPanel,
      leftColumn,
      diagramTitle,
      diagram.root,
      unevenStatus,
      mixingStatus,
      uniformStatus
    )
    scene.add(composition)

    scene.expose('heat-flow-left-panel', leftPanel)
    scene.expose('heat-flow-left-content', leftColumn)
    scene.expose('heat-flow-equation', equation, { data: { semanticParts: true } })
    scene.expose('heat-flow-diagram', diagram.root)
    scene.expose('heat-flow-spread-fill', diagram.spreadFill)
    scene.expose('heat-flow-takeaway', takeaway)

    scene.watchCollisions('heat-flow-title', title, { ignore: [leftPanel] })
    scene.watchCollisions('heat-flow-subtitle', subtitle, { ignore: [leftPanel] })
    scene.watchCollisions('heat-flow-equation', equation, { ignore: [leftPanel] })
    scene.watchCollisions('heat-flow-explanation', explanation, {
      ignore: [leftPanel]
    })
    scene.watchCollisions('heat-flow-takeaway', takeaway, { ignore: [leftPanel] })
    scene.watchCollisions('heat-flow-diagram-title', diagramTitle, {
      ignore: [rightPanel]
    })

    const frames = {
      intro: 0,
      diagnose: scene.secondsToFrames(1.5),
      mix: scene.secondsToFrames(4),
      resolve: scene.secondsToFrames(6.5),
      end: scene.secondsToFrames(8.5)
    }
    scene.timeline.defineBeats({
      intro: { start: frames.intro, end: frames.diagnose },
      diagnose: { start: frames.diagnose, end: frames.mix },
      mix: { start: frames.mix, end: frames.resolve },
      resolve: { start: frames.resolve, end: frames.end }
    })

    const equationMorph = await latex.morphTo(equation, {
      latex: String.raw`\dmClass{temperature}{\Delta T}=\frac{\dmClass{energy}{Q}}{\dmClass{mass}{mc}}`,
      duration: 1.2,
      particleCount: 2500,
      easing: 'ease-in-out'
    })

    scene.timeline.beat('intro', (beat) => {
      scene.addAnims(
        fadeIn(leftColumn, { duration: 0.6, easing: 'ease-out' }),
        fadeIn(diagramTitle, { duration: 0.45, easing: 'ease-out' }),
        fadeIn(diagram.root, { duration: 0.6, easing: 'ease-out' }),
        fadeIn(unevenStatus, { duration: 0.45, easing: 'ease-out' }),
        moveTo(diagram.root, new THREE.Vector3(12.65, 0.4, 0), {
          from: new THREE.Vector3(14.65, 0.4, 0),
          duration: 0.8,
          easing: 'ease-out'
        })
      )
      scene.addAnims(wait(0.7))
      beat.onEachTick(({ beatProgress }) => {
        updateUnevenHeat(diagram, beatProgress * 0.35)
        setSpread(diagram, THREE.MathUtils.lerp(0.92, 0.86, beatProgress))
      })
    })

    scene.timeline.beat('diagnose', (beat) => {
      scene.do(() => {
        equation.visible = true
      })
      scene.addAnims(latex.write(equation, { duration: 0.9, easing: 'linear' }))
      scene.addAnims(wait(0.2))
      scene.addAnims(
        latex.mark(equation.part('energy'), {
          duration: 0.8,
          color: '#fbbf24',
          pulses: 1
        })
      )
      scene.addAnims(wait(0.6))
      beat.onEachTick(({ localFrame }) => {
        updateUnevenHeat(diagram, localFrame / scene.fps)
        setSpread(diagram, 0.86)
      })
    })

    scene.timeline.beat('mix', (beat) => {
      scene.addAnims(
        equationMorph,
        fadeOut(unevenStatus, { duration: 0.35, easing: 'ease-in-out' }),
        fadeIn(mixingStatus, { duration: 0.35, easing: 'ease-in-out' })
      )
      scene.addAnims(
        latex.highlight(equation.part('temperature'), {
          duration: 0.8,
          color: '#38bdf8',
          pulses: 1
        })
      )
      scene.addAnims(wait(0.5))
      beat.onEachTick(({ beatProgress }) => {
        updateMixedHeat(diagram, beatProgress)
        setSpread(diagram, THREE.MathUtils.lerp(0.86, 0.18, beatProgress))
      })
    })

    scene.timeline.beat('resolve', (beat) => {
      scene.addAnims(
        fadeOut(mixingStatus, { duration: 0.35, easing: 'ease-in-out' }),
        fadeIn(uniformStatus, { duration: 0.35, easing: 'ease-in-out' }),
        fadeIn(takeaway, { duration: 0.55, easing: 'ease-out' }),
        scaleIn(takeaway, { duration: 0.55, from: 0.92, easing: 'ease-out' })
      )
      scene.addAnims(wait(1.45))
      beat.onEachTick(({ localFrame }) => {
        updateEvenHeat(diagram, localFrame / scene.fps)
        setSpread(diagram, 0.18)
      })
    })

    registerVerifications(scene, {
      frames,
      leftPanel,
      rightPanel,
      leftColumn,
      diagram,
      diagramTitle,
      unevenStatus,
      mixingStatus,
      uniformStatus,
      takeaway
    })
  })
}

const createHeatDiagram = (): {
  root: THREE.Group
  spots: HeatSpot[]
  spreadFill: THREE.Mesh
  spreadWidth: number
} => {
  const root = new THREE.Group()
  const vessel = createCircle(6.7, {
    color: '#111d31',
    stroke: { color: '#315078', width: 0.12, placement: 'inside' }
  })
  vessel.scale.y = 0.72
  vessel.position.y = 0.9
  vessel.position.z = -1
  root.add(vessel)

  const starts = [
    [-4.6, 3.5],
    [-2.6, 3.1],
    [0.2, 3.6],
    [2.5, 3.2],
    [4.5, 2.9],
    [-4.2, 0.9],
    [-1.5, 1.3],
    [1.2, 0.5],
    [3.7, 1.1],
    [-3.7, -1.8],
    [-1.1, -2.2],
    [1.6, -1.8],
    [4.1, -1.4]
  ]
  const targets = [
    [-4.2, 3],
    [-2.1, 3],
    [0, 3],
    [2.1, 3],
    [4.2, 3],
    [-3.3, 0.6],
    [-1.1, 0.6],
    [1.1, 0.6],
    [3.3, 0.6],
    [-3.3, -1.8],
    [-1.1, -1.8],
    [1.1, -1.8],
    [3.3, -1.8]
  ]
  const temperatures = [0.08, 0.18, 0.92, 0.85, 0.2, 0.12, 0.78, 0.16, 0.88, 0.28, 0.82, 0.1, 0.72]
  const spots = starts.map(([x, y], index): HeatSpot => {
    const root = createCircle(index % 3 === 0 ? 0.7 : 0.58, { color: '#ffffff' })
    const material = root.material as THREE.MeshBasicMaterial
    const start = new THREE.Vector3(x, y + 0.9, 0)
    const target = new THREE.Vector3(targets[index][0], targets[index][1] + 0.9, 0)
    root.position.copy(start)
    root.renderOrder = 2
    const spot = { root, material, start, target, initialTemperature: temperatures[index] }
    applyTemperature(spot, temperatures[index])
    return spot
  })
  root.add(...spots.map((spot) => spot.root))

  const spreadTrack = createRectangle(9.2, 0.46, { color: '#26364d' })
  spreadTrack.position.set(0, -5.65, 0)
  const spreadWidth = 8.8
  const spreadFill = createRectangle(spreadWidth, 0.28, { color: '#fb7185' })
  spreadFill.position.set(0, -5.65, 0.1)
  root.add(spreadTrack, spreadFill)

  return { root, spots, spreadFill, spreadWidth }
}

const applyTemperature = (spot: HeatSpot, temperature: number): void => {
  const clamped = THREE.MathUtils.clamp(temperature, 0, 1)
  spot.material.color.lerpColors(COLD, HOT, clamped)
  spot.root.userData.temperature = clamped
}

const updateUnevenHeat = (diagram: ReturnType<typeof createHeatDiagram>, time: number): void => {
  diagram.spots.forEach((spot, index) => {
    const pulse = Math.sin(time * 4.2 + index * 0.83) * 0.035
    applyTemperature(spot, spot.initialTemperature + pulse)
    spot.root.scale.setScalar(0.96 + Math.sin(time * 3.1 + index) * 0.04)
  })
}

const updateMixedHeat = (diagram: ReturnType<typeof createHeatDiagram>, progress: number): void => {
  const eased = THREE.MathUtils.smoothstep(progress, 0, 1)
  diagram.spots.forEach((spot, index) => {
    const orbit = spot.start
      .clone()
      .applyAxisAngle(
        new THREE.Vector3(0, 0, 1),
        Math.sin(progress * Math.PI) * (index % 2 === 0 ? 0.7 : -0.55)
      )
    spot.root.position.copy(orbit.lerp(spot.target, eased))
    applyTemperature(spot, THREE.MathUtils.lerp(spot.initialTemperature, 0.56, eased))
    spot.material.color.lerp(EVEN, eased)
    spot.root.scale.setScalar(THREE.MathUtils.lerp(0.96, 1, eased))
  })
}

const updateEvenHeat = (diagram: ReturnType<typeof createHeatDiagram>, time: number): void => {
  diagram.spots.forEach((spot, index) => {
    spot.root.position.copy(spot.target)
    applyTemperature(spot, 0.56 + Math.sin(time * 2.4 + index * 0.55) * 0.012)
    spot.material.color.lerpColors(EVEN, EVEN_LIGHT, 0.35 + Math.sin(time * 2 + index * 0.7) * 0.15)
    spot.root.scale.setScalar(1 + Math.sin(time * 2 + index) * 0.018)
  })
}

const setSpread = (diagram: ReturnType<typeof createHeatDiagram>, spread: number): void => {
  const clamped = THREE.MathUtils.clamp(spread, 0.001, 1)
  diagram.spreadFill.scale.x = clamped
  diagram.spreadFill.position.x = -diagram.spreadWidth / 2 + (diagram.spreadWidth * clamped) / 2
  ;(diagram.spreadFill.material as THREE.MeshBasicMaterial).color.lerpColors(EVEN, HOT, clamped)
}

const temperatureSpread = (spots: readonly HeatSpot[]): number => {
  const temperatures = spots.map((spot) => Number(spot.root.userData.temperature))
  return Math.max(...temperatures) - Math.min(...temperatures)
}

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

const separated = (left: ScreenBounds | null, right: ScreenBounds | null): boolean =>
  left !== null && right !== null && left.right <= right.left

const insideViewport = (
  bounds: ScreenBounds | null,
  viewport: { width: number; height: number }
): boolean =>
  bounds !== null &&
  bounds.left >= 0 &&
  bounds.right <= viewport.width &&
  bounds.top >= 0 &&
  bounds.bottom <= viewport.height

const registerVerifications = (
  scene: AnimatedScene,
  visuals: {
    frames: { intro: number; diagnose: number; mix: number; resolve: number; end: number }
    leftPanel: THREE.Object3D
    rightPanel: THREE.Object3D
    leftColumn: THREE.Object3D
    diagram: ReturnType<typeof createHeatDiagram>
    diagramTitle: THREE.Object3D
    unevenStatus: THREE.Object3D
    mixingStatus: THREE.Object3D
    uniformStatus: THREE.Object3D
    takeaway: THREE.Object3D
  }
): void => {
  scene.verify(
    'production-heat-left-contained',
    { frames: { start: 0, end: visuals.frames.end } },
    (context) => {
      const panelBounds = context.screenBounds(visuals.leftPanel)
      const contentBounds = context.screenBounds(visuals.leftColumn)
      context.assert(
        containsWithMargin(panelBounds, contentBounds, 24),
        'The complete narrative column must remain inside its panel',
        { panelBounds, contentBounds, requiredMargin: 24 }
      )
    }
  )

  scene.verify(
    'production-heat-panels-separated',
    { frames: { start: 0, end: visuals.frames.end } },
    (context) => {
      const leftBounds = context.screenBounds(visuals.leftPanel)
      const rightBounds = context.screenBounds(visuals.rightPanel)
      context.assert(
        separated(leftBounds, rightBounds),
        'The narrative and diagram panels overlap',
        {
          leftBounds,
          rightBounds
        }
      )
    }
  )

  scene.verify(
    'production-heat-panels-in-viewport',
    { frames: { start: 0, end: visuals.frames.end } },
    (context) => {
      const leftBounds = context.screenBounds(visuals.leftPanel)
      const rightBounds = context.screenBounds(visuals.rightPanel)
      context.assert(
        insideViewport(leftBounds, context.viewport) &&
          insideViewport(rightBounds, context.viewport),
        'The production composition must remain inside the video viewport',
        { leftBounds, rightBounds, viewport: context.viewport }
      )
    }
  )

  scene.verify(
    'production-heat-diagram-contained',
    { frames: { start: 0, end: visuals.frames.end } },
    (context) => {
      const panelBounds = context.screenBounds(visuals.rightPanel)
      const diagramBounds = context.screenBounds(visuals.diagram.root)
      const titleBounds = context.screenBounds(visuals.diagramTitle)
      context.assert(
        containsWithMargin(panelBounds, diagramBounds, 20) &&
          containsWithMargin(panelBounds, titleBounds, 20),
        'The animated temperature field must remain inside its panel',
        { panelBounds, diagramBounds, titleBounds, requiredMargin: 20 }
      )
    }
  )

  scene.verify(
    'production-heat-starts-uneven',
    { frames: { start: visuals.frames.mix - 1, end: visuals.frames.mix } },
    (context) => {
      const spread = temperatureSpread(visuals.diagram.spots)
      context.assert(spread > 0.65, 'The diagnosis must visibly contain hot and cold regions', {
        spread
      })
    }
  )

  scene.verify(
    'production-heat-finishes-even',
    { frames: { start: visuals.frames.end - 1, end: visuals.frames.end } },
    (context) => {
      const spread = temperatureSpread(visuals.diagram.spots)
      context.assert(spread < 0.04, 'The resolved field must have low temperature spread', {
        spread
      })
    }
  )

  scene.verify(
    'production-heat-final-message',
    { frames: { start: visuals.frames.end - 1, end: visuals.frames.end } },
    (context) => {
      context.assert(
        !context.isVisibleInHierarchy(visuals.unevenStatus) &&
          !context.isVisibleInHierarchy(visuals.mixingStatus) &&
          context.isVisibleInHierarchy(visuals.uniformStatus) &&
          context.isVisibleInHierarchy(visuals.takeaway),
        'The final explanatory state must replace the diagnostic state'
      )
    }
  )
}
