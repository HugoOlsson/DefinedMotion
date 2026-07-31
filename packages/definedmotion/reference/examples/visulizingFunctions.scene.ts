import { camera, createAnimation, fadeIn, fadeOut, wait } from 'definedmotion/animation'
import { defineScene } from 'definedmotion'
import { COLORS } from 'definedmotion/rendering'
import { addBackgroundGradient, addSceneLighting } from 'definedmotion/rendering'
import { AnimatedScene, SpaceSetting } from 'definedmotion'
import * as THREE from 'three'
import { MeshLine, MeshLineMaterial } from 'three.meshline'
import { linspace } from 'definedmotion/math'
import { createText } from 'definedmotion/rendering'
import { addHDRI, HDRIs, loadHDRIData } from 'definedmotion/rendering'

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
  id: 'functions',
  name: 'Visualizing Functions',
  create: animatedFunctionsScene
})
const functions: [string, (x: number) => number][] = [
  // ──────────── Start Simple & Recognizable ────────────
  ['Constant', (_) => 0],
  ['Linear', (x) => x],
  ['Exponential', (x) => Math.exp(x / 3.3)],
  ['Cubic', (x) => Math.pow(x / 10, 3) * 10],
  ['Absolute Value', (x) => Math.abs(x)],
  ['Square Root of |x|', (x) => Math.sqrt(Math.abs(x))],

  // ──────────── Introduce Waves & Periodicity ────────────
  ['Sine', (x) => Math.sin(x) * 5],
  ['Cosine', (x) => Math.cos(x) * 5],
  ['Chirp', (x) => Math.sin(0.5 * x * x) * 5],
  ['Sawtooth Wave', (x) => 2 * (x / Math.PI - Math.floor(x / Math.PI + 0.5)) * 5],
  [
    'Triangle Wave',
    (x) => (2 * Math.abs(2 * (x / Math.PI - Math.floor(x / Math.PI + 0.5))) - 1) * 5
  ],
  ['Square Wave', (x) => Math.sign(Math.sin(x)) * 10],

  // ──────────── Smooth Curves & Transitions ────────────
  ['Gaussian Curve', (x) => Math.exp(-0.5 * x * x) * 10],
  ['ReLU', (x) => Math.max(0, x)],
  ['Sigmoid', (x) => (1 / (1 + Math.exp(-x))) * 10],
  ['Damped Sine Wave', (x) => Math.sin(x) * Math.exp(-0.05 * x * x) * 10],

  // ──────────── Chaotic/Unpredictable Climax ────────────
  ['Chaotic Oscillator', (x) => Math.sin(10 * x) * Math.sin(0.3 * x * x) * 5]
]
const vectorizeFunctions = (
  functions: [string, (x: number) => number][],
  threshold: number = Infinity
): [number, number][][] => {
  return functions.map(([label, fn]) => {
    const xs = linspace(-10, 10, 200)
    return xs.map((x) => {
      const raw = fn(x)
      // zero out anything non‐finite or exceeding threshold
      const y = Number.isFinite(raw) && Math.abs(raw) <= threshold ? raw : 0
      return [x, y] as [number, number]
    })
  })
}

const interpolate = (
  vectorFunc1: [number, number][],
  vectorFunc2: [number, number][],
  progress: number
): [number, number][] => {
  if (vectorFunc1.length !== vectorFunc2.length) {
    throw new Error('Both point‑lists must have the same length for interpolation.')
  }

  // clamp progress into [0,1]
  const t = Math.max(0, Math.min(1, progress))

  return vectorFunc1.map(([x1, y1], i) => {
    const [x2, y2] = vectorFunc2[i]
    // interpolate x and y
    const x = x1 + (x2 - x1) * t
    const y = y1 + (y2 - y1) * t
    return [x, y] as [number, number]
  })
}

const morphAnimation = (
  line: PlotLine,
  vecFunc1: [number, number][],
  vecFunc2: [number, number][],
  duration: number = 500
) => {
  return createAnimation({
    duration: duration / 1000,
    easing: 'ease-in-out',
    bind: () => ({
      update({ easedProgress }) {
        line.setPoints(interpolate(vecFunc1, vecFunc2, easedProgress))
      }
    })
  })
}
export function animatedFunctionsScene(): AnimatedScene {
  return new AnimatedScene(
    1080,
    2160,
    SpaceSetting.ThreeDim,
    async (scene) => {
      const hdriData = await loadHDRIData(HDRIs.outdoor1, 1)
      // scene.registerAudio(fadeSound)
      const coordinateAxes = scene.expose(
        'coordinate-axes',
        create2DAxis({ xmin: -10, xmax: 10, ymin: -10, ymax: 10, ticks: 10, tickSize: 0.5 }),
        {
          description: 'The fixed x and y axes used as the reference frame for every function',
          tags: ['axes', 'reference']
        }
      )
      scene.add(coordinateAxes)
      addSceneLighting(scene.scene)

      await addHDRI(scene, hdriData, 1)
      addBackgroundGradient({
        scene,
        topColor: '#00639d',
        bottomColor: COLORS.black,
        backgroundOpacity: 0.5
      })
      scene.camera.position.set(0, 0, 10)
      const informationTextNode = scene.expose(
        'scaling-note',
        await createText({ text: 'Some of the functions are scaled.', fontSize: 0.6 }),
        {
          description: 'Supporting note shown above the current function name',
          tags: ['text', 'supporting-copy']
        }
      )
      informationTextNode.position.y = 13.5
      applyOpacity(informationTextNode, 0.4)
      scene.add(informationTextNode)
      const textNode = scene.expose('function-name', await createText({ text: '', fontSize: 1.5 }), {
        description: 'The name of the function currently represented by the plot',
        tags: ['text', 'title', 'dynamic']
      })
      textNode.position.y = 12
      scene.add(textNode)

      const plotLine = new PlotLine(scene.scene, 0xffffff)
      scene.expose('function-plot', plotLine.object, {
        description: 'The animated line that morphs between the functions',
        tags: ['plot', 'primary-subject', 'dynamic']
      })

      const vecFuncs = vectorizeFunctions(functions)

      scene.camera.position.set(9.82015, 4.347805, 29.81918)
      scene.camera.quaternion.set(-0.07633829, 0.3762715, 0.03112576, 0.9228345)
      scene.camera.zoom = 0.8

      const cameraStart = scene.camera.position.clone()
      const cameraEnd = new THREE.Vector3(-9.625222, 4.32878, 29.57185)

      scene.onEachTick(() => {
        scene.camera.lookAt(0, 0, -2)
      })

      const resumeAt = scene.getTimelinePointer()
      for (let index = 0; index < 20; index++) {
        scene.addAnims(camera.moveTo(scene.camera, cameraEnd, { duration: 2.5 }))
        scene.addAnims(camera.moveTo(scene.camera, cameraStart, { duration: 2.5 }))
      }
      scene.setTimelinePointer(resumeAt)

      for (let i = 0; i < vecFuncs.length - 1; i++) {
        // scene.playAudio(fadeSound, 0.03)

        const morphStart = scene.getTimelinePointer()
        scene.addAnims(morphAnimation(plotLine, vecFuncs[i], vecFuncs[i + 1], 300))
        scene.setTimelinePointer(morphStart)
        scene.addAnims(fadeOut(textNode, { duration: 0.15 }))
        scene.do(async () => {
          await textNode.setText(functions[i + 1][0])
        })
        scene.addAnims(fadeIn(textNode, { duration: 0.15 }))
        scene.addAnims(wait((800) / 1000))
      }

      scene.addAnims(wait((1600) / 1000))
    }
  )
}

class PlotLine {
  private meshLine: MeshLine
  private mesh: THREE.Mesh

  constructor(scene: THREE.Scene, color: THREE.ColorRepresentation) {
    // create MeshLine + material + mesh
    this.meshLine = new MeshLine()
    const material = new MeshLineMaterial({
      lineWidth: 0.1,
      color,
      transparent: false
    })
    this.mesh = new THREE.Mesh(this.meshLine.geometry, material)
    scene.add(this.mesh)
  }

  get object(): THREE.Mesh {
    return this.mesh
  }

  setPoints(points: [number, number][]) {
    // flatten into [x0, y0, z0, x1, y1, z1, …]
    const flatPoints: number[] = []
    for (const [x, y] of points) {
      flatPoints.push(x, y, 0)
    }
    // false = don't close the loop
    this.meshLine.setPoints(flatPoints, false)
  }
}

export function create2DAxis({
  xmin = -10,
  xmax = 10,
  ymin = -10,
  ymax = 10,
  ticks = 10,
  tickSize = 0.2
} = {}) {
  const group = new THREE.Group()
  const mat = new THREE.LineBasicMaterial({ color: 0xffffff })

  // main X axis
  let geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(xmin, 0, 0),
    new THREE.Vector3(xmax, 0, 0)
  ])
  group.add(new THREE.Line(geo, mat))

  // main Y axis
  geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, ymin, 0),
    new THREE.Vector3(0, ymax, 0)
  ])
  group.add(new THREE.Line(geo, mat))

  // tick marks
  const dx = (xmax - xmin) / ticks
  for (let i = 0; i <= ticks; i++) {
    const x = xmin + i * dx
    const tgeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, -tickSize / 2, 0),
      new THREE.Vector3(x, tickSize / 2, 0)
    ])
    group.add(new THREE.Line(tgeo, mat))
  }
  const dy = (ymax - ymin) / ticks
  for (let j = 0; j <= ticks; j++) {
    const y = ymin + j * dy
    const tgeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-tickSize / 2, y, 0),
      new THREE.Vector3(tickSize / 2, y, 0)
    ])
    group.add(new THREE.Line(tgeo, mat))
  }

  return group
}
