import { group } from 'console'
import {
  createCircle,
  createFastText,
  createLine,
  PaddedLine,
  updateText
} from '../../lib/rendering/objects2d'
import { createSVGShape, vectorizeSVGStructure } from '../../lib/rendering/svg/parsing'
import { AnimatedScene } from '../../lib/scene/sceneClass'
import * as THREE from 'three'
import { MeshLine, MeshLineMaterial } from 'three.meshline'
import { addBackgroundGradient, addHDRI, HDRIs } from '../../lib/rendering/lighting3d'
import { COLORS } from '../../lib/rendering/helpers'
import {
  fade,
  fadeIn,
  fadeOut,
  moveCameraAnimation,
  moveRotateCameraAnimation3D,
  setOpacity
} from '../../lib/animation/animations'
import tickSound from '../../assets/audio/tick_sound.mp3'
import { ThreeMFLoader } from 'three/examples/jsm/Addons.js'
import { linspace } from '../../lib/mathHelpers/vectors'
import { modelDirection } from 'three/tsl'
import { UserAnimation } from '../../lib/animation/protocols'
import { linear } from 'svelte/easing'
import { easeLinear } from '../../lib/animation/interpolations'
import interstellar from '../../assets/audio/interstellar.mp3'
import { latexToSVG } from '../../lib/rendering/svg/rastered'

const getCircleSVG = (color: string, percentageStrokeWidth: number = 4) => `
<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
  <circle
    cx="0" cy="0" r="100"
    stroke="${color}"
    stroke-width="${percentageStrokeWidth}"
    fill="none" />
</svg>
`

export const neonColors: string[] = [
  '#39FF14',
  '#CCFF00',
  '#FFFF33',
  '#FF6EC7',
  '#FE4164',
  '#FF3131',
  '#FF9933',
  '#FC0FC0',
  '#6F00FF',
  '#BF00FF',
  '#7DF9FF',
  '#00FFFF',
  '#08E8DE',
  '#00FF7F',
  '#FFFF00',
  '#00FFEF',
  '#7FFF00',
  '#FF00FF',
  '#FF1E56',
  '#1AE1F2'
]

class CircleGroup {
  public group = new THREE.Group()
  public rotationAngle: number = 0
  private anchorVector: THREE.Vector3
  private rotationAxis = new THREE.Vector3(0, 0, 1)
  constructor(center: THREE.Vector3, radius: number, strokePercentage: number, color: string) {
    const circle = createSVGShape(getCircleSVG(color, strokePercentage), radius * 2)
    const anchorNode = createSVGShape(getCircleSVG('white', 50), radius * 0.15)
    this.anchorVector = new THREE.Vector3(radius, 0, 0)
    anchorNode.position.copy(this.anchorVector)
    const line = createLine({
      point1: circle.position,
      point2: this.anchorVector,
      color: new THREE.Color('white')
    })
    this.group.add(circle, line, anchorNode)
    this.group.position.copy(center)
  }

  setCenter(worldPos: THREE.Vector3) {
    this.group.position.copy(this.group.parent!.worldToLocal(worldPos.clone()))
  }

  setRotation(angle: number) {
    this.rotationAngle = angle
    this.group.setRotationFromAxisAngle(this.rotationAxis, angle)
  }

  getAnchorPoint(): THREE.Vector3 {
    // make sure your world‐matrices are fresh
    this.group.updateMatrixWorld(true)
    // transform the “radius,0,0” vector to WORLD space in one go
    return this.group.localToWorld(this.anchorVector.clone())
  }
}

interface Relation {
  name: string
  radius: (n: number) => number
  k: (n: number) => number
  phase: (n: number) => number
  latexString: string
}

interface RelationGroup {
  group: THREE.Group
  circleGroups: CircleGroup[]
  plotLines: PlotLine[]
  connectionLines: PaddedLine[]
  topGroup: THREE.Group
  relation: Relation
  opacity: number
}

const N = 20
const colors = [...neonColors] //interpolateHexColors('#0062ff', '#ff0000', N)
const plotYOffset = -21
const baseRadius = 5

const relations: Relation[] = [
  {
    name: 'Square Wave',
    radius: (n) => {
      const m = 2 * n - 1
      return ((4 / Math.PI) * baseRadius) / m
    },
    k: (n) => 2 * n - 1,
    phase: (_) => 0,
    latexString: String.raw`\sum_{n=1}^{\infty} \frac{4}{\pi (2n-1)} \sin\left( (2n-1)t \right)`
  },

  // 2. Sawtooth Wave
  {
    name: 'Sawtooth Wave',
    // all harmonics, amplitude ∝1/n with alternating sign
    radius: (n) => ((2 * baseRadius) / (Math.PI * n)) * (-1) ** (n + 1),
    k: (n) => n,
    phase: () => 0,
    latexString: String.raw`\sum_{n=1}^{N} \frac{2(-1)^{n+1}}{\pi n} \sin(nt)`
  },

  // 3. Hann‑Windowed Series
  {
    name: 'Hann Window',
    // smooth taper ≈½(1−cos(2πn/N))
    radius: (n) => {
      const raw = ((2 / Math.PI) * baseRadius) / n
      const w = 0.5 * (1 - Math.cos((2 * Math.PI * (n - 1)) / (N - 1)))
      return raw * w
    },
    k: (n) => n,
    phase: () => 0,
    latexString: String.raw`\sum_{n=1}^{N} \frac{2}{\pi n} \left(\frac{1 - \cos\left(\frac{2\pi(n-1)}{N-1}\right)}{2}\right) \sin(nt)`
  },

  // 6. Random‑Phase Wave
  {
    name: 'Quadratic Chirp',
    // standard 1/n amplitude fall‑off
    radius: (n) => ((2 / Math.PI) * baseRadius) / n,
    // quadratic frequency scaling → high harmonics whirl away!
    k: (n) => n * n,
    // no extra phase offset
    phase: () => 0,
    latexString: String.raw`\sum_{n=1}^{N} \frac{2}{\pi n} \sin(n^2 t)`
  },
  // 7. Blackman Window
  {
    name: 'Envelope Ripple',
    // 1/n decay × a cosine ripple over n
    radius: (n) => {
      const raw = ((2 / Math.PI) * baseRadius) / n
      // ripple period ≈ every 5 harmonics
      const ripple = 0.5 + 0.5 * Math.cos((2 * Math.PI * n) / 5)
      return raw * ripple
    },
    k: (n) => n,
    phase: () => 0,
    latexString: String.raw`\sum_{n=1}^{N} \frac{2}{\pi n} \left(\frac{1 + \cos\left(\frac{2\pi n}{5}\right)}{2}\right) \sin(nt)`
  }
]

async function svgStringToTexture(
  svgString: string,
  scaleFactor: number = 2 // Default 2x resolution
): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgString], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)

    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)

      // Calculate scaled dimensions
      const baseWidth = img.naturalWidth
      const baseHeight = img.naturalHeight
      const scaledWidth = baseWidth * scaleFactor
      const scaledHeight = baseHeight * scaleFactor

      // Create high-res canvas
      const canvas = document.createElement('canvas')
      canvas.width = scaledWidth
      canvas.height = scaledHeight

      const ctx = canvas.getContext('2d')!
      ctx.setTransform(scaleFactor, 0, 0, scaleFactor, 0, 0)
      ctx.drawImage(img, 0, 0)

      // 2) now re‑color everything white:
      //   switch to “source‐in” so our fill only appears where the SVG is opaque
      ctx.globalCompositeOperation = 'source-in'
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, scaledWidth, scaledHeight)

      // 3) reset composite so nothing else is affected
      ctx.globalCompositeOperation = 'source-over'

      const texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = 16 // Improve texture filtering
      resolve(texture)
    }

    img.onerror = reject
    img.src = url
  })
}

async function createSVGPlane(svgString: string, size: number = 5, resolutionScale: number = 2) {
  const texture = await svgStringToTexture(svgString, resolutionScale)
  texture.colorSpace = THREE.SRGBColorSpace

  // Maintain aspect ratio
  const aspect = texture.image.width / texture.image.height
  const geometry = new THREE.PlaneGeometry(size * aspect, size)
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    color: '#ffffff',
    side: THREE.DoubleSide
  })

  return new THREE.Mesh(geometry, material)
}

export const fourierSeriesScene = (): AnimatedScene => {
  return new AnimatedScene(1080, 2160, true, true, async (scene) => {
    scene.registerAudio(tickSound)
    //scene.registerAudio(interstellar)
    //scene.playAudio(interstellar)
    //await addHDRI({ scene, hdriPath: HDRIs.outdoor1, useAsBackground: true, blurAmount: 2 })
    addBackgroundGradient({
      scene,
      topColor: '#000000',
      bottomColor: COLORS.black,
      backgroundOpacity: 0.5
    })

    const relationGroups: RelationGroup[] = []
    const relationsZ = linspace(-25, 25, relations.length)

    for (let i = 0; i < relations.length; i++) {
      const relation = relations[i]
      const relationGroup = new THREE.Group()
      const topGroup = new THREE.Group()
      const circlesAxes = create2DAxis({ tickSpacing: baseRadius })

      topGroup.add(circlesAxes)

      const circleGroups: CircleGroup[] = []
      for (let i = 0; i < N; i++) {
        const n = i + 1
        const circleGroup = new CircleGroup(
          new THREE.Vector3(0, 0, 0),
          relation.radius(n),
          5 + i * 1,
          colors[i]
        )
        topGroup.add(circleGroup.group)
        circleGroups.push(circleGroup)
      }

      relationGroup.add(topGroup)

      const plotAxes = create2DAxis({
        ymin: -baseRadius * 1.5,
        ymax: baseRadius * 1.5,
        xmax: Math.PI * 27,
        tickSpacing: Math.PI / 2
      })
      plotAxes.position.y = plotYOffset
      relationGroup.add(plotAxes)

      const plotLines: PlotLine[] = []
      const connectionLines: PaddedLine[] = []

      for (let i = 0; i < N; i++) {
        const plotLine = new PlotLine(relationGroup, colors[i], 100_000)
        plotLines.push(plotLine)
        const line = createLine({ color: colors[i], width: 1 })
        line.frustumCulled = false
        relationGroup.add(line)
        connectionLines.push(line)
      }

      /* const fourierTextNode = await createFastText(relation.name, 1)
      fourierTextNode.position.y = 13

      topGroup.add(fourierTextNode) */

      let svgString = latexToSVG(relation.latexString) // 1.5x scaling

      const svgImage = await createSVGPlane(svgString, 3, 6)
      svgImage.position.set(0, 13, 0)

      topGroup.add(svgImage)

      relationGroup.position.z = relationsZ[i]
      scene.add(relationGroup)

      relationGroups.push({
        group: relationGroup,
        circleGroups,
        plotLines,
        connectionLines,
        topGroup,
        relation,
        opacity: 1
      })
    }

    const startCameraPos = new THREE.Vector3(-42.1133, 6.217837, 52.55059)
    const startCameraRot = new THREE.Quaternion(-0.1144444, -0.3540472, -0.04370152, 0.9271695)
    scene.camera.position.copy(startCameraPos)
    scene.camera.quaternion.copy(startCameraRot)

    const textsGroup = new THREE.Group()

    const fourierTextNode = await createFastText('Fourier Series', 3)
    fourierTextNode.position.y = 3

    textsGroup.add(fourierTextNode)

    const textNode = await createFastText('Sawtooth Wave', 1.8)
    textNode.position.y = 0
    setOpacity(textNode, 0.4)
    textsGroup.add(textNode)

    textsGroup.position.y = 20

    //scene.add(textsGroup)

    let mode: string = 'wide'
    let mode2: number = 1
    let mode2List = [1, 0, 2]
    let mode2Index = 0

    const POS_SNAP_TIME = 10000
    const ROT_SNAP_TIME = 8000
    let lastTransition = 0

    let cameraLineIndex = 0
    scene.onEachTick((tick, time) => {
      const x = time / 700

      if (tick % 480 === 0 && tick !== 0) {
        console.log(cameraLineIndex, mode, mode2)
        if (cameraLineIndex < relations.length) {
          mode = cameraLineIndex.toString()
          cameraLineIndex++
        } else {
          cameraLineIndex = 0
          mode = cameraLineIndex.toString()
          mode2Index++
          mode2 = mode2List[mode2Index % mode2List.length]
          cameraLineIndex++
        }

        lastTransition = time

        for (let i = 0; i < relationGroups.length; i++) {
          if (i !== Number(mode)) {
            scene.insertAnimAt(
              tick,
              fade(relationGroups[i].group, 100, relationGroups[i].opacity, 0.1)
            )
            relationGroups[i].opacity = 0.1
          } else {
            scene.insertAnimAt(
              tick,
              fade(relationGroups[i].group, 100, relationGroups[i].opacity, 1)
            )
            relationGroups[i].opacity = 1
          }
        }
      }

      for (const relationGroup of relationGroups) {
        const circleGroups = relationGroup.circleGroups
        const plotLines = relationGroup.plotLines
        const connectionLines = relationGroup.connectionLines
        const topGroup = relationGroup.topGroup
        for (let i = 0; i < N; i++) {
          const n = i + 1
          const k = relationGroup.relation.k(n)
          circleGroups[i].setRotation(k * x)
        }
        for (let i = 1; i < N; i++) {
          circleGroups[i].setCenter(circleGroups[i - 1].getAnchorPoint())
        }

        for (let i = 0; i < N; i++) {
          const worldTip = circleGroups[i].getAnchorPoint()
          plotLines[i].addPoint([x, worldTip.y + plotYOffset])

          const p1 = worldTip.clone()
          p1.z = 0
          connectionLines[i].updatePositions(p1, new THREE.Vector3(x, worldTip.y + plotYOffset, 0))
        }

        topGroup.position.x = x
      }

      //scene.camera.position.x = x + startCameraPos.x
      textsGroup.position.x = x

      let targetPosition: THREE.Vector3
      let targetRotation: THREE.Quaternion

      if (mode === 'wide') {
        targetPosition = startCameraPos.clone()
        targetPosition.x = x + startCameraPos.x

        targetRotation = startCameraRot.clone()
      } else if (mode2 === 0) {
        const index = Number(mode)
        const zPos = relationsZ[index] + 18
        targetPosition = new THREE.Vector3(-28.81272 + x, -15.44788, zPos)
        targetRotation = new THREE.Quaternion(0.03540297, -0.4387143, 0.01730056, 0.8977623)
      } else if (mode2 == 1) {
        const index = Number(mode)
        const zPos = relationsZ[index] + 18
        targetPosition = new THREE.Vector3(15.89088 + x, 23.76457, zPos)
        targetRotation = new THREE.Quaternion(-0.3922925, 0.3045554, 0.1394623, 0.8566813)
      } else {
        const index = Number(mode)
        const followGroup = relationGroups[index].circleGroups[1]
        const tip = followGroup.getAnchorPoint()

        // place the camera relative to the circle
        targetPosition = tip.clone().add(new THREE.Vector3(0, 0, 10)) // 30 units “in front”
        targetRotation = new THREE.Quaternion(0, 0, 0, 1)
      }
      const deltaTime = time - lastTransition

      const posLerp = 1 - Math.exp(-deltaTime / POS_SNAP_TIME)
      const rotLerp = 1 - Math.exp(-deltaTime / ROT_SNAP_TIME)

      scene.camera.position.lerp(targetPosition, posLerp)
      scene.camera.quaternion.slerp(targetRotation, rotLerp)
    })

    scene.addWait(75000)
  })
}

class PlotLine {
  private geometry: THREE.BufferGeometry
  private positions: THREE.BufferAttribute
  public line: THREE.Line
  private count: number
  private maxPoints: number
  private needsFullUpdate: boolean

  constructor(
    group: THREE.Scene | THREE.Group,
    color: THREE.ColorRepresentation,
    maxPoints: number
  ) {
    this.maxPoints = maxPoints
    this.count = 0
    this.needsFullUpdate = false

    // Create pre-initialized buffer (xyz coordinates)
    const buffer = new Float32Array(3 * maxPoints)
    this.positions = new THREE.BufferAttribute(buffer, 3)
    this.positions.setUsage(THREE.DynamicDrawUsage)

    // Configure geometry
    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', this.positions)
    this.geometry.setDrawRange(0, 0) // Start with empty draw range

    // Create line material (note: lineWidth might be limited by WebGL implementation)
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true
    })

    this.line = new THREE.Line(this.geometry, material)

    this.line.frustumCulled = false
    group.add(this.line)
  }

  addPoint(point: [number, number]) {
    const [x, y] = point

    if (this.count >= this.maxPoints) {
      // Shift buffer left by one point (optimized)
      this.positions.array.copyWithin(0, 3, 3 * this.maxPoints)
      this.count = this.maxPoints - 1
      this.needsFullUpdate = true
    }

    const index = this.count * 3
    this.positions.array[index] = x
    this.positions.array[index + 1] = y
    this.positions.array[index + 2] = 0
    this.count++

    this.updateGeometry()
  }

  private updateGeometry() {
    if (this.needsFullUpdate) {
      // Update entire buffer
      this.positions.needsUpdate = true
      this.geometry.setDrawRange(0, this.count)
      this.needsFullUpdate = false
    } else {
      // Partial update (only update new points)
      const start = Math.max(0, (this.count - 1) * 3)
      ;(this.positions as any).updateRange = {
        offset: start,
        count: 3 // Only update the last added point
      }
      this.positions.needsUpdate = true
      this.geometry.setDrawRange(0, this.count)
    }
  }

  // Clear/reset the line
  clear() {
    this.count = 0
    this.geometry.setDrawRange(0, 0)
    this.positions.needsUpdate = true
  }
}
/**
 * Creates a 2D axis with evenly spaced ticks and independent arrow size.
 * @param {object} options
 * @param {number} options.xmin         - Minimum x value
 * @param {number} options.xmax         - Maximum x value
 * @param {number} options.ymin         - Minimum y value
 * @param {number} options.ymax         - Maximum y value
 * @param {number} options.tickSpacing  - World‐space distance between ticks
 * @param {number} options.tickLength   - Length of each tick mark
 * @param {number} options.arrowLength  - Length of the axis arrowhead
 * @param {number} options.arrowRadius  - Base radius of the axis arrowhead
 * @param {number} options.axisColor    - Color of axis lines and ticks (hex)
 * @param {number} options.arrowColor   - Color of arrowheads (hex)
 * @returns {THREE.Group} Group containing the axis
 */
export function create2DAxis({
  xmin = -10,
  xmax = 10,
  ymin = -10,
  ymax = 10,
  tickSpacing = 1,
  tickLength = 0.4,
  arrowLength = 0.8,
  arrowRadius = 0.2,
  axisColor = 0xffffff,
  arrowColor = 0xffffff
} = {}) {
  const group = new THREE.Group()
  const lineMat = new THREE.LineBasicMaterial({ color: axisColor, transparent: true })
  const arrowMat = new THREE.MeshBasicMaterial({ color: arrowColor, transparent: true })

  // Helper: create a line between two 2D points
  const makeLine = ([x1, y1], [x2, y2]) => {
    const pts = [new THREE.Vector3(x1, y1, 0), new THREE.Vector3(x2, y2, 0)]
    const geo = new THREE.BufferGeometry().setFromPoints(pts)
    return new THREE.Line(geo, lineMat)
  }

  // Draw main axes
  group.add(makeLine([xmin, 0], [xmax, 0]))
  group.add(makeLine([0, ymin], [0, ymax]))

  // Draw ticks along an axis
  const halfTick = tickLength / 2
  const drawTicks = (start, end, isXAxis = true) => {
    // first multiple of tickSpacing ≥ start
    const first = Math.ceil(start / tickSpacing) * tickSpacing
    for (let v = first; v <= end + 1e-8; v += tickSpacing) {
      if (isXAxis) {
        group.add(makeLine([v, -halfTick], [v, halfTick]))
      } else {
        group.add(makeLine([-halfTick, v], [halfTick, v]))
      }
    }
  }

  drawTicks(xmin, xmax, true) // X ticks
  drawTicks(ymin, ymax, false) // Y ticks

  // Create arrowheads
  const coneGeo = new THREE.ConeGeometry(arrowRadius, arrowLength, 8)

  const arrowX = new THREE.Mesh(coneGeo, arrowMat)
  arrowX.position.set(xmax + arrowLength / 2, 0, 0)
  arrowX.rotation.z = -Math.PI / 2
  group.add(arrowX)

  const arrowY = new THREE.Mesh(coneGeo, arrowMat)
  arrowY.position.set(0, ymax + arrowLength / 2, 0)
  // default orientation points +Y
  group.add(arrowY)

  return group
}

export function interpolateHexColors(color1: string, color2: string, steps: number): string[] {
  if (steps < 2) {
    throw new Error('steps must be at least 2')
  }

  // Strip "#" if present, and expand short form (#abc → aabbcc)
  const normalize = (hex: string): string => {
    hex = hex.replace(/^#/, '')
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('')
    }
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
      throw new Error(`Invalid hex colour: "${hex}"`)
    }
    return hex.toLowerCase()
  }

  const hexToRgb = (hex: string) => {
    const normalized = normalize(hex)
    return {
      r: parseInt(normalized.slice(0, 2), 16),
      g: parseInt(normalized.slice(2, 4), 16),
      b: parseInt(normalized.slice(4, 6), 16)
    }
  }

  const rgbToHex = ({ r, g, b }: { r: number; g: number; b: number }) =>
    '#' +
    [r, g, b]
      .map((v) => {
        const h = v.toString(16)
        return h.length === 1 ? '0' + h : h
      })
      .join('')

  const c1 = hexToRgb(color1)
  const c2 = hexToRgb(color2)
  const result: string[] = []

  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1)
    const r = Math.round(c1.r + (c2.r - c1.r) * t)
    const g = Math.round(c1.g + (c2.g - c1.g) * t)
    const b = Math.round(c1.b + (c2.b - c1.b) * t)
    result.push(rgbToHex({ r, g, b }))
  }

  return result
}
