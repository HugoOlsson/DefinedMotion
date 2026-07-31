import { wait } from 'definedmotion/animation'
import * as THREE from 'three'
import { defineScene } from 'definedmotion'
import { createText, createLine } from 'definedmotion/rendering'
import { createSVGShape } from 'definedmotion/latex'
import { latexToSVG } from 'definedmotion/latex'
import { AnimatedScene, SpaceSetting } from 'definedmotion'

export default defineScene({
  id: 'galton-board',
  name: 'Galton Board: The Normal Distribution',
  create: galtonBoardScene
})

const DURATION_MS = 14_000
const ROW_COUNT = 10
const BIN_COUNT = ROW_COUNT + 1
const BALL_COUNT = 160
const PEG_SPACING = 7.5
const FIRST_PEG_Y = 9.8
const ROW_SPACING = 1.72
const BIN_BASE_Y = -26.5
const BALL_STACK_STEP = 0.68
const COUNT_HEIGHT_STEP = BALL_STACK_STEP / 2
const BALL_RADIUS = 0.38

interface BallSimulation {
  mesh: THREE.Mesh
  decisions: boolean[]
  path: THREE.Vector3[]
  bin: number
  stackIndex: number
  startFrame: number
  durationFrames: number
}

interface DynamicLine extends THREE.Line {
  updatePoints(points: THREE.Vector3[]): void
}

interface TextSwitcher {
  group: THREE.Group & { text: string }
  show(index: number): void
}

export function galtonBoardScene(): AnimatedScene {
  return new AnimatedScene(
    1600,
    900,
    SpaceSetting.TwoDim,
    async (scene) => {
      scene.scene.background = new THREE.Color('#070b16')

      const title = await createText({ text: 'Order from Randomness', fontSize: 3.1, color: 0xf8fafc })
      title.position.set(0, 27, 1)
      scene.add(title)

      const subtitle = await createText({ text: 'A Galton board turns many coin-flip paths into a bell curve', fontSize: 1.18, color: 0x94a3b8 })
      subtitle.position.set(0, 23.5, 1)
      scene.add(subtitle)

      const formula = scene.expose(
        'distribution-formula',
        createSVGShape(
          latexToSVG(
            String.raw`X\sim\operatorname{Binomial}\!\left(10,\frac12\right)\ \approx\ \mathcal N\!\left(5,\,2.5\right)`
          ),
          29
        ),
        {
          description:
            'Ten independent left-or-right decisions form a binomial distribution approaching a normal distribution',
          tags: ['latex', 'probability', 'normal-distribution']
        }
      )
      formula.position.set(0, 17.3, 1)
      scene.add(formula)

      scene.add(
        createLine({
          point1: new THREE.Vector3(-49, 13.1, 0),
          point2: new THREE.Vector3(49, 13.1, 0),
          color: '#26324f'
        })
      )

      const phaseLabels = await createTextSwitcher(
        ['ONE RANDOM PATH', 'WATCH THE SAMPLE GROW', 'A PATTERN EMERGES'],
        1.05,
        0x64748b
      )
      phaseLabels.group.position.set(-37, 10.5, 2)
      scene.add(phaseLabels.group)

      const probability = createSVGShape(
        latexToSVG(String.raw`p(\mathrm{left})=p(\mathrm{right})=\frac12`),
        21
      )
      probability.position.set(31, 10.3, 1)
      scene.add(probability)

      const pegField = scene.expose('peg-field', new THREE.Group(), {
        description: 'Ten rows of pegs where every collision sends a ball left or right',
        tags: ['galton-board', 'pegs', 'probability']
      })
      const pegGeometry = new THREE.CircleGeometry(0.24, 20)
      const pegMaterial = new THREE.MeshBasicMaterial({ color: '#94a3b8', depthTest: false })
      for (let row = 0; row < ROW_COUNT; row++) {
        for (let column = 0; column <= row; column++) {
          const peg = new THREE.Mesh(pegGeometry, pegMaterial)
          peg.position.set(pegX(row, column), pegY(row), 0)
          pegField.add(peg)
        }
      }
      scene.add(pegField)

      const bins = scene.expose(
        'outcome-bins',
        Object.assign(new THREE.Group(), { text: 'No balls have landed' }),
        {
          description: 'Eleven bins corresponding to zero through ten rightward decisions',
          tags: ['bins', 'outcomes', 'histogram']
        }
      )
      addBins(bins)
      const binLabels = await Promise.all(
        Array.from({ length: BIN_COUNT }, (_, index) => createText({ text: `${index}`, fontSize: 0.78, color: 0x64748b }))
      )
      binLabels.forEach((label, index) => {
        label.position.set(binX(index), -27.45, 1)
        bins.add(label)
      })
      scene.add(bins)

      const histogram = scene.expose(
        'sample-histogram',
        Object.assign(new THREE.Group(), { text: 'counts: 0,0,0,0,0,0,0,0,0,0,0' }),
        {
          description: 'Live counts of landed balls for every final horizontal outcome',
          tags: ['histogram', 'sample', 'dynamic']
        }
      )
      const histogramBars = createHistogramBars(histogram)
      scene.add(histogram)

      const normalCurve = scene.expose(
        'expected-normal-curve',
        createDynamicLine(241, '#f472b6', 0),
        {
          description: 'Expected bell curve from the binomial probabilities for 160 trials',
          tags: ['normal-curve', 'expected-distribution', 'dynamic']
        }
      )
      normalCurve.updatePoints(expectedCurvePoints())
      scene.add(normalCurve)

      const curveLabel = await createText({ text: 'expected bell curve', fontSize: 1.05, color: 0xf9a8d4 })
      curveLabel.position.set(30, -9.2, 1)
      curveLabel.visible = false
      scene.add(curveLabel)

      const ballGeometry = new THREE.CircleGeometry(BALL_RADIUS, 24)
      const ballMaterial = new THREE.MeshBasicMaterial({ color: '#38bdf8', depthTest: false })
      const heroMaterial = new THREE.MeshBasicMaterial({ color: '#fbbf24', depthTest: false })
      const landingSlots = Array.from({ length: BIN_COUNT }, () => 0)
      const balls: BallSimulation[] = []
      const activeBalls = scene.expose(
        'simulated-balls',
        Object.assign(new THREE.Group(), { text: '0 active, 0 landed, 160 total' }),
        {
          description: 'Seeded balls following reproducible left-or-right paths through the pegs',
          tags: ['balls', 'simulation', 'dynamic', 'deterministic']
        }
      )

      for (let index = 0; index < BALL_COUNT; index++) {
        const decisions = Array.from({ length: ROW_COUNT }, () => scene.random() >= 0.5)
        const bin = decisions.filter(Boolean).length
        const stackIndex = landingSlots[bin]++
        const mesh = new THREE.Mesh(ballGeometry, index === 0 ? heroMaterial : ballMaterial)
        mesh.visible = false
        mesh.renderOrder = index === 0 ? 4 : 3
        activeBalls.add(mesh)
        balls.push({
          mesh,
          decisions,
          path: ballPath(decisions, stackIndex),
          bin,
          stackIndex,
          startFrame: index === 0 ? 28 : 105 + (index - 1) * 3,
          durationFrames: index === 0 ? 180 : 140
        })
      }
      scene.add(activeBalls)

      const heroBall = scene.expose('hero-ball', balls[0].mesh, {
        description: 'Highlighted first ball demonstrating one sequence of ten random choices',
        tags: ['hero', 'ball', 'random-path']
      })
      Object.assign(heroBall, { text: decisionText(balls[0].decisions) })

      const decisionGuide = scene.expose('decision-guide', new THREE.Group(), {
        description: 'The two equally likely branches available at the hero ball’s current peg',
        tags: ['branch', 'probability', 'hero']
      })
      const leftBranch = createLine({ color: '#22d3ee' })
      const rightBranch = createLine({ color: '#c084fc' })
      decisionGuide.add(leftBranch, rightBranch)
      scene.add(decisionGuide)

      const sampleLabels = await createTextSwitcher(
        ['1 ball', '40 balls', '80 balls', '120 balls', '160 balls'],
        1.15,
        0xe2e8f0
      )
      sampleLabels.group.position.set(-40, -29, 1)
      scene.add(sampleLabels.group)

      const insight = await createText({ text: 'many independent choices  →  a predictable shape', fontSize: 1.15, color: 0x94a3b8 })
      insight.position.set(19, -29, 1)
      scene.add(insight)

      const boardCamera = scene.exposeCamera(
        'board',
        new THREE.OrthographicCamera(-47, 47, 26.4375, -26.4375, 1, 100),
        {
          description: 'Wide view of the peg field, falling balls, and accumulating bins',
          tags: ['overview', 'board']
        }
      )
      boardCamera.position.set(0, -11.5, 30)
      boardCamera.lookAt(0, -11.5, 0)

      const decisionCamera = scene.exposeCamera(
        'decision',
        new THREE.OrthographicCamera(-18, 18, 10.125, -10.125, 1, 100),
        {
          description: 'Close view of balls making left-or-right decisions among the upper pegs',
          tags: ['detail', 'decisions', 'pegs']
        }
      )
      decisionCamera.position.set(0, 2, 30)
      decisionCamera.lookAt(0, 2, 0)

      const distributionCamera = scene.exposeCamera(
        'distribution',
        new THREE.OrthographicCamera(-47, 47, 26.4375, -26.4375, 1, 100),
        {
          description: 'Close view of the final sampled histogram and expected bell curve',
          tags: ['detail', 'histogram', 'normal-curve']
        }
      )
      distributionCamera.position.set(0, -20, 30)
      distributionCamera.lookAt(0, -20, 0)

      const landedCounts = Array.from({ length: BIN_COUNT }, () => 0)
      let previousLanded = -1
      let previousPhase = -1
      scene.onEachTick((frame) => {
        landedCounts.fill(0)
        let activeCount = 0
        let landedCount = 0

        balls.forEach((ball) => {
          const progress = (frame - ball.startFrame) / ball.durationFrames
          if (progress < 0) {
            ball.mesh.visible = false
            return
          }
          ball.mesh.visible = true
          if (progress >= 1) {
            ball.mesh.position.copy(ball.path[ball.path.length - 1])
            landedCounts[ball.bin]++
            landedCount++
            return
          }
          activeCount++
          ball.mesh.position.copy(positionOnPath(ball.path, progress))
        })

        const heroProgress = (frame - balls[0].startFrame) / balls[0].durationFrames
        updateDecisionGuide(decisionGuide, leftBranch, rightBranch, balls[0].mesh, heroProgress)

        histogramBars.forEach((bar, index) => {
          const height = Math.max(0.001, landedCounts[index] * COUNT_HEIGHT_STEP)
          bar.scale.y = height
          bar.position.y = BIN_BASE_Y + height / 2
        })

        const curveProgress = smoothstep((frame - 510) / 150)
        ;(normalCurve.material as THREE.LineBasicMaterial).opacity = curveProgress * 0.95
        curveLabel.visible = curveProgress > 0.08

        if (landedCount !== previousLanded) {
          previousLanded = landedCount
          activeBalls.text = `${activeCount} active, ${landedCount} landed, ${BALL_COUNT} total`
          bins.text = `${landedCount} balls landed across ${BIN_COUNT} outcome bins`
          histogram.text = `counts: ${landedCounts.join(',')}`
          const sampleIndex = Math.min(4, Math.floor(landedCount / 40))
          sampleLabels.show(sampleIndex)
        }

        const phase = frame < 105 ? 0 : frame < 650 ? 1 : 2
        if (phase !== previousPhase) {
          previousPhase = phase
          phaseLabels.show(phase)
        }
      })

      scene.addAnims(wait((DURATION_MS) / 1000))
    }
  )
}

const pegX = (row: number, column: number): number => (column - row / 2) * PEG_SPACING

const pegY = (row: number): number => FIRST_PEG_Y - row * ROW_SPACING

const binX = (bin: number): number => (bin - ROW_COUNT / 2) * PEG_SPACING

const ballPath = (decisions: boolean[], stackIndex: number): THREE.Vector3[] => {
  const points = [new THREE.Vector3(0, 12.3, 2)]
  let rights = 0
  points.push(new THREE.Vector3(pegX(0, 0), pegY(0) + 0.55, 2))
  decisions.forEach((right, row) => {
    if (right) rights++
    if (row < ROW_COUNT - 1) {
      points.push(new THREE.Vector3(pegX(row + 1, rights), pegY(row + 1) + 0.55, 2))
    }
  })
  points.push(
    new THREE.Vector3(
      binX(rights) + (stackIndex % 2 === 0 ? -0.62 : 0.62),
      BIN_BASE_Y + BALL_RADIUS + Math.floor(stackIndex / 2) * BALL_STACK_STEP,
      2
    )
  )
  return points
}

const positionOnPath = (path: THREE.Vector3[], progress: number): THREE.Vector3 => {
  const scaled = THREE.MathUtils.clamp(progress, 0, 0.999999) * (path.length - 1)
  const segment = Math.floor(scaled)
  const local = scaled - segment
  const eased = smoothstep(local)
  const position = path[segment].clone().lerp(path[segment + 1], eased)
  if (segment > 0 && segment < path.length - 2) position.y += Math.sin(local * Math.PI) * 0.28
  return position
}

const updateDecisionGuide = (
  group: THREE.Group,
  left: ReturnType<typeof createLine>,
  right: ReturnType<typeof createLine>,
  hero: THREE.Mesh,
  heroProgress: number
): void => {
  if (heroProgress < 0 || heroProgress >= 0.48) {
    group.visible = false
    return
  }
  group.visible = true
  const spread = PEG_SPACING / 2
  left.updatePositions(
    new THREE.Vector3(hero.position.x, hero.position.y, 1),
    new THREE.Vector3(hero.position.x - spread, hero.position.y - 2.2, 1)
  )
  right.updatePositions(
    new THREE.Vector3(hero.position.x, hero.position.y, 1),
    new THREE.Vector3(hero.position.x + spread, hero.position.y - 2.2, 1)
  )
}

const addBins = (group: THREE.Group): void => {
  const top = -9.25
  const leftEdge = binX(0) - PEG_SPACING / 2
  const rightEdge = binX(BIN_COUNT - 1) + PEG_SPACING / 2
  group.add(
    createLine({
      point1: new THREE.Vector3(leftEdge, BIN_BASE_Y, 0),
      point2: new THREE.Vector3(rightEdge, BIN_BASE_Y, 0),
      color: '#475569'
    })
  )
  for (let index = 0; index <= BIN_COUNT; index++) {
    const x = leftEdge + index * PEG_SPACING
    group.add(
      createLine({
        point1: new THREE.Vector3(x, BIN_BASE_Y, 0),
        point2: new THREE.Vector3(x, top, 0),
        color: '#1e293b'
      })
    )
  }
}

const createHistogramBars = (group: THREE.Group): THREE.Mesh[] => {
  const geometry = new THREE.PlaneGeometry(PEG_SPACING - 1.1, 1)
  const material = new THREE.MeshBasicMaterial({
    color: '#8b5cf6',
    transparent: true,
    opacity: 0.18,
    depthTest: false,
    depthWrite: false
  })
  return Array.from({ length: BIN_COUNT }, (_, index) => {
    const bar = new THREE.Mesh(geometry, material)
    bar.position.set(binX(index), BIN_BASE_Y, -1)
    bar.scale.y = 0.001
    group.add(bar)
    return bar
  })
}

const expectedCurvePoints = (): THREE.Vector3[] =>
  Array.from({ length: 241 }, (_, index) => {
    const outcome = THREE.MathUtils.lerp(-0.5, ROW_COUNT + 0.5, index / 240)
    const expectedCount =
      BALL_COUNT *
      (1 / Math.sqrt(2 * Math.PI * (ROW_COUNT / 4))) *
      Math.exp(-((outcome - ROW_COUNT / 2) ** 2) / (2 * (ROW_COUNT / 4)))
    return new THREE.Vector3(
      (outcome - ROW_COUNT / 2) * PEG_SPACING,
      BIN_BASE_Y + expectedCount * COUNT_HEIGHT_STEP,
      3
    )
  })

const createDynamicLine = (
  pointCount: number,
  color: THREE.ColorRepresentation,
  opacity: number
): DynamicLine => {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pointCount * 3), 3))
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false
  })
  const line = new THREE.Line(geometry, material) as DynamicLine
  line.frustumCulled = false
  line.updatePoints = (points): void => {
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute
    points.forEach((point, index) => positions.setXYZ(index, point.x, point.y, point.z))
    positions.needsUpdate = true
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
  }
  return line
}

const createTextSwitcher = async (
  values: string[],
  size: number,
  color: number
): Promise<TextSwitcher> => {
  const group = Object.assign(new THREE.Group(), { text: values[0] })
  const labels = await Promise.all(values.map((value) => createText({ text: value, fontSize: size, color: color })))
  labels.forEach((label, index) => {
    label.visible = index === 0
    group.add(label)
  })
  return {
    group,
    show: (index): void => {
      group.text = values[index]
      labels.forEach((label, labelIndex) => {
        label.visible = labelIndex === index
      })
    }
  }
}

const decisionText = (decisions: boolean[]): string =>
  decisions.map((right) => (right ? 'R' : 'L')).join(' → ')

const smoothstep = (value: number): number => {
  const clamped = THREE.MathUtils.clamp(value, 0, 1)
  return clamped * clamped * (3 - 2 * clamped)
}
