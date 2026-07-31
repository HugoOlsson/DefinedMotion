import { wait } from 'definedmotion/animation'
import * as THREE from 'three'
import { defineScene } from 'definedmotion'
import { createText, createLine } from 'definedmotion/rendering'
import { createSVGShape } from 'definedmotion/latex'
import { latexToSVG } from 'definedmotion/latex'
import { AnimatedScene, SpaceSetting } from 'definedmotion'

const applyOpacity = <T extends THREE.Object3D>(
  object: T,
  opacity: number,
  enableTransparency = true,
  hideWhenZero = true
): T => {
  const visible = opacity > 0.001
  if (hideWhenZero) object.visible = visible
  object.traverse((child) => {
    const material = (child as THREE.Object3D & { material?: THREE.Material | THREE.Material[] }).material
    for (const current of Array.isArray(material) ? material : material ? [material] : []) {
      if (enableTransparency) current.transparent = true
      current.opacity = opacity
      current.depthWrite = visible
    }
  })
  return object
}

export default defineScene({
  id: 'newtons-second-law',
  name: "Newton's Second Law",
  create: newtonsSecondLawScene
})

const DURATION_MS = 14_000
const START_X = -34
const TRACK_Y = -15

interface Trial {
  label: string
  explanation: string
  equation: string
  equationLatex: string
  mass: number
  force: number
  acceleration: number
  distance: number
}

interface TrialState extends Trial {
  index: number
  progress: number
  summary: boolean
}

interface TextSwitcher {
  group: THREE.Group & { text: string }
  show(index: number): void
}

interface VectorArrow {
  group: THREE.Group & { text: string }
  label: TextSwitcher
  update(start: THREE.Vector3, end: THREE.Vector3): void
}

const TRIALS: Trial[] = [
  {
    label: 'TRIAL 1 · BASELINE',
    explanation: 'A 6 N force pushes a 2 kg cart',
    equation: '6 N = 2 kg × 3 m/s²',
    equationLatex: String.raw`6\,\mathrm{N}=2\,\mathrm{kg}\cdot3\,\mathrm{m/s^2}`,
    mass: 2,
    force: 6,
    acceleration: 3,
    distance: 30
  },
  {
    label: 'TRIAL 2 · DOUBLE THE MASS',
    explanation: 'Same force, twice the mass, half the acceleration',
    equation: '6 N = 4 kg × 1.5 m/s²',
    equationLatex: String.raw`6\,\mathrm{N}=4\,\mathrm{kg}\cdot1.5\,\mathrm{m/s^2}`,
    mass: 4,
    force: 6,
    acceleration: 1.5,
    distance: 15
  },
  {
    label: 'TRIAL 3 · DOUBLE THE FORCE',
    explanation: 'Same mass, twice the force, twice the acceleration',
    equation: '12 N = 2 kg × 6 m/s²',
    equationLatex: String.raw`12\,\mathrm{N}=2\,\mathrm{kg}\cdot6\,\mathrm{m/s^2}`,
    mass: 2,
    force: 12,
    acceleration: 6,
    distance: 60
  }
]

export function newtonsSecondLawScene(): AnimatedScene {
  return new AnimatedScene(
    1600,
    900,
    SpaceSetting.TwoDim,
    async (scene) => {
      scene.scene.background = new THREE.Color('#080b16')

      const title = await createText({ text: "Newton's Second Law", fontSize: 3.15, color: 0xf8fafc })
      title.position.set(0, 27, 1)
      scene.add(title)

      const subtitle = await createText({ text: 'Predict motion with force and mass', fontSize: 1.2, color: 0x94a3b8 })
      subtitle.position.set(0, 23.5, 1)
      scene.add(subtitle)

      const formula = scene.expose(
        'newton-formula',
        createSVGShape(latexToSVG(String.raw`\vec{F}=m\vec{a}`), 18),
        {
          description: "Newton's second law: net force equals mass times acceleration",
          tags: ['latex', 'formula', 'newton']
        }
      )
      formula.position.set(0, 17.5, 1)
      scene.add(formula)

      const termLegend = new THREE.Group()
      const forceLegend = await createText({ text: 'force', fontSize: 1.05, color: 0x22d3ee })
      const massLegend = await createText({ text: 'mass', fontSize: 1.05, color: 0xfbbf24 })
      const accelerationLegend = await createText({ text: 'acceleration', fontSize: 1.05, color: 0xc084fc })
      forceLegend.position.x = -8
      accelerationLegend.position.x = 8
      termLegend.add(forceLegend, massLegend, accelerationLegend)
      termLegend.position.set(0, 13.1, 1)
      scene.add(termLegend)

      scene.add(
        createLine({
          point1: new THREE.Vector3(-49, 11.4, 0),
          point2: new THREE.Vector3(49, 11.4, 0),
          color: '#26324f'
        })
      )

      const stageLabels = await createTextSwitcher(
        ['START WITH THE EQUATION', ...TRIALS.map((trial) => trial.label), 'THE RULE'],
        1.12,
        0x64748b
      )
      stageLabels.group.position.set(-30, 7.8, 1)
      scene.add(stageLabels.group)

      const explanations = await createTextSwitcher(
        [
          'Apply a force, then watch the velocity change',
          ...TRIALS.map((trial) => trial.explanation),
          'More force speeds up. More mass resists.'
        ],
        1.25,
        0xe2e8f0
      )
      explanations.group.position.set(-23, 4.8, 1)
      scene.add(explanations.group)

      const numericalEquation = scene.expose(
        'numerical-equation',
        Object.assign(new THREE.Group(), { text: 'a = F / m' }),
        {
          description: 'Numbers for the currently visible Newton-law experiment',
          tags: ['latex', 'calculation', 'dynamic']
        }
      )
      const equationValues = [
        String.raw`\vec a=\frac{\vec F}{m}`,
        ...TRIALS.map((trial) => trial.equationLatex),
        String.raw`\boxed{\vec a=\frac{\vec F}{m}}`
      ]
      const equationGroups = equationValues.map((value) =>
        createSVGShape(latexToSVG(value), value.includes('boxed') ? 17 : 25)
      )
      equationGroups.forEach((equation, index) => {
        applyOpacity(equation, index === 0 ? 1 : 0, true, false)
        numericalEquation.add(equation)
      })
      numericalEquation.position.set(27, 6, 1)
      scene.add(numericalEquation)

      const track = scene.expose('track', createTrack(), {
        description: 'Reference track shared by all three force-and-mass trials',
        tags: ['track', 'reference']
      })
      scene.add(track)

      const cart = scene.expose('cart', createCart(), {
        description: 'Cart whose width represents mass and whose position responds to acceleration',
        tags: ['cart', 'mass', 'dynamic']
      }) as THREE.Group & { text: string }
      cart.text = 'm = 2 kg'
      scene.add(cart)

      const massLabels = await createTextSwitcher(['2 kg', '4 kg'], 1.25, 0x111827)
      massLabels.group.position.set(0, 0.4, 2)
      cart.add(massLabels.group)

      const forceArrow = await createVectorArrow(
        ['F = 6 N', 'F = 12 N'],
        0x22d3ee,
        new THREE.Vector3(0, 2.2, 0)
      )
      scene.expose('force-vector', forceArrow.group, {
        description: 'Applied horizontal force vector; its length scales with force',
        tags: ['vector', 'force', 'dynamic']
      })
      scene.add(forceArrow.group)

      const accelerationArrow = await createVectorArrow(
        ['a = 1.5 m/s²', 'a = 3 m/s²', 'a = 6 m/s²'],
        0xc084fc,
        new THREE.Vector3(0, 2.2, 0)
      )
      scene.expose('acceleration-vector', accelerationArrow.group, {
        description: 'Acceleration vector derived from force divided by mass',
        tags: ['vector', 'acceleration', 'dynamic']
      })
      scene.add(accelerationArrow.group)

      const motionTrails = Array.from({ length: 5 }, (_, index) => {
        const material = new THREE.LineBasicMaterial({
          color: '#38bdf8',
          transparent: true,
          opacity: 0.12 + index * 0.07,
          depthTest: false
        })
        const trail = createLine({ color: '#38bdf8' })
        trail.material = material
        trail.frustumCulled = false
        scene.add(trail)
        return trail
      })

      const relationship = await createText({ text: 'distance grows with  a · t²', fontSize: 1.05, color: 0x64748b })
      relationship.position.set(25, -24, 1)
      scene.add(relationship)

      const experimentCamera = scene.exposeCamera(
        'experiment',
        new THREE.OrthographicCamera(-50, 50, 28.125, -28.125, 1, 100),
        {
          description: 'Wide diagnostic view of the track, cart, and both vectors',
          tags: ['overview', 'experiment']
        }
      )
      experimentCamera.position.set(0, -7, 30)
      experimentCamera.lookAt(0, -7, 0)

      const equationCamera = scene.exposeCamera(
        'equation',
        new THREE.OrthographicCamera(-24, 24, 13.5, -13.5, 1, 100),
        {
          description: "Close view of Newton's symbolic force equation",
          tags: ['detail', 'formula']
        }
      )
      equationCamera.position.set(0, 22.5, 30)
      equationCamera.lookAt(0, 22.5, 0)

      const cartCamera = scene.exposeCamera(
        'cart-follow',
        new THREE.OrthographicCamera(-21.333, 21.333, 12, -12, 1, 100),
        {
          description: 'Dynamic close-up that follows the cart and its force vectors',
          tags: ['dynamic', 'follow', 'cart']
        }
      )

      let visibleStage = -1
      scene.onEachTick((frame) => {
        const state = trialState(frame)
        const cartX = START_X + state.distance * state.progress * state.progress
        const bodyScale = state.mass === 4 ? 1.42 : 1
        const halfWidth = 4.5 * bodyScale
        const forceLength = 4 + state.force * 0.78
        const accelerationLength = 4 + state.acceleration * 1.75

        cart.position.set(cartX, TRACK_Y + 4.6, 0)
        const body = cart.getObjectByName('body')!
        body.scale.x = bodyScale
        const outline = cart.getObjectByName('outline')!
        outline.scale.x = bodyScale
        cart.getObjectByName('left-wheel')!.position.x = -2.7 * bodyScale
        cart.getObjectByName('right-wheel')!.position.x = 2.7 * bodyScale
        cart.text = `m = ${state.mass} kg`
        massLabels.show(state.mass === 4 ? 1 : 0)

        const arrowY = cart.position.y + 6.2
        forceArrow.update(
          new THREE.Vector3(cartX - halfWidth - forceLength, arrowY, 0),
          new THREE.Vector3(cartX - halfWidth, arrowY, 0)
        )
        forceArrow.label.show(state.force === 12 ? 1 : 0)
        forceArrow.group.text = `F = ${state.force} N`

        accelerationArrow.update(
          new THREE.Vector3(cartX, arrowY + 4.3, 0),
          new THREE.Vector3(cartX + accelerationLength, arrowY + 4.3, 0)
        )
        const accelerationIndex = state.acceleration === 1.5 ? 0 : state.acceleration === 3 ? 1 : 2
        accelerationArrow.label.show(accelerationIndex)
        accelerationArrow.group.text = `a = ${state.acceleration} m/s²`

        motionTrails.forEach((trail, index) => {
          const length = state.progress * state.acceleration * (1.4 + index * 0.75)
          const y = cart.position.y - 1.8 + index * 0.9
          trail.visible = state.progress > 0.04 && !state.summary
          trail.updatePositions(
            new THREE.Vector3(cartX - halfWidth - length, y, -1),
            new THREE.Vector3(cartX - halfWidth - 0.7, y, -1)
          )
        })

        if (state.index !== visibleStage) {
          visibleStage = state.index
          stageLabels.show(state.index)
          explanations.show(state.index)
          equationGroups.forEach((equation, index) => {
            applyOpacity(equation, index === state.index ? 1 : 0, true, false)
          })
          numericalEquation.text = state.index === 0 || state.summary ? 'a = F / m' : state.equation
        }

        cartCamera.position.set(cartX, cart.position.y + 2, 30)
        cartCamera.lookAt(cartX, cart.position.y + 2, 0)
      })

      scene.addAnims(wait((DURATION_MS) / 1000))
    }
  )
}

const createTrack = (): THREE.Group => {
  const track = new THREE.Group()
  track.add(
    createLine({
      point1: new THREE.Vector3(-48, TRACK_Y, 0),
      point2: new THREE.Vector3(48, TRACK_Y, 0),
      color: '#334155'
    })
  )
  for (let x = -45; x <= 45; x += 10) {
    track.add(
      createLine({
        point1: new THREE.Vector3(x, TRACK_Y - 0.7, 0),
        point2: new THREE.Vector3(x, TRACK_Y + 0.7, 0),
        color: '#1e293b'
      })
    )
  }
  return track
}

const createCart = (): THREE.Group => {
  const cart = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 7),
    new THREE.MeshBasicMaterial({ color: '#fbbf24', depthTest: false })
  )
  body.name = 'body'
  body.position.y = 0.5
  const outline = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-4.5, -3, 0),
      new THREE.Vector3(4.5, -3, 0),
      new THREE.Vector3(4.5, 4, 0),
      new THREE.Vector3(-4.5, 4, 0)
    ]),
    new THREE.LineBasicMaterial({ color: '#fef3c7', depthTest: false })
  )
  outline.name = 'outline'
  outline.position.z = 1
  cart.add(body, outline, createWheel('left-wheel', -2.7), createWheel('right-wheel', 2.7))
  return cart
}

const createWheel = (name: string, x: number): THREE.Mesh => {
  const wheel = new THREE.Mesh(
    new THREE.CircleGeometry(1.05, 32),
    new THREE.MeshBasicMaterial({ color: '#111827', depthTest: false })
  )
  wheel.name = name
  wheel.position.set(x, -3.4, 2)
  return wheel
}

const createTextSwitcher = async (
  values: string[],
  size: number,
  color: number
): Promise<TextSwitcher> => {
  const group = Object.assign(new THREE.Group(), { text: values[0] })
  const labels = await Promise.all(values.map((value) => createText({ text: value, fontSize: size, color: color })))
  labels.forEach((label, index) => {
    applyOpacity(label, index === 0 ? 1 : 0, true, false)
    group.add(label)
  })
  return {
    group,
    show: (index): void => {
      group.text = values[index]
      labels.forEach((label, labelIndex) => {
        applyOpacity(label, labelIndex === index ? 1 : 0, true, false)
      })
    }
  }
}

const createVectorArrow = async (
  labels: string[],
  color: number,
  labelOffset: THREE.Vector3
): Promise<VectorArrow> => {
  const group = Object.assign(new THREE.Group(), { text: labels[0] })
  const shaft = createLine({ color })
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.lineTo(-1.7, 1)
  shape.lineTo(-1.7, -1)
  shape.closePath()
  const head = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshBasicMaterial({ color, depthTest: false })
  )
  const label = await createTextSwitcher(labels, 1.08, color)
  group.add(shaft, head, label.group)
  return {
    group,
    label,
    update: (start, end): void => {
      shaft.updatePositions(start, end)
      head.position.copy(end)
      const angle = Math.atan2(end.y - start.y, end.x - start.x)
      head.rotation.z = angle
      label.group.position.copy(start.clone().lerp(end, 0.5).add(labelOffset))
    }
  }
}

const trialState = (frame: number): TrialState => {
  if (frame < 120) return { ...TRIALS[0], index: 0, progress: 0, summary: false }
  if (frame < 300) return activeTrial(TRIALS[0], 1, frame, 120, 299)
  if (frame < 330) return resetTrial(TRIALS[0], 1, frame, 300, 329)
  if (frame < 510) return activeTrial(TRIALS[1], 2, frame, 330, 509)
  if (frame < 540) return resetTrial(TRIALS[1], 2, frame, 510, 539)
  if (frame < 720) return activeTrial(TRIALS[2], 3, frame, 540, 719)
  return { ...TRIALS[2], index: 4, progress: 0.68, summary: true }
}

const activeTrial = (
  trial: Trial,
  index: number,
  frame: number,
  start: number,
  end: number
): TrialState => ({
  ...trial,
  index,
  progress: THREE.MathUtils.clamp((frame - start) / (end - start), 0, 1),
  summary: false
})

const resetTrial = (
  trial: Trial,
  index: number,
  frame: number,
  start: number,
  end: number
): TrialState => ({
  ...trial,
  index,
  progress: 1 - THREE.MathUtils.clamp((frame - start) / (end - start), 0, 1),
  summary: false
})
