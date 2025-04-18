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
import { fadeIn, setOpacity } from '../../lib/animation/animations'
import tickSound from '../../assets/audio/tick_sound.mp3'

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
  '#FF0000',
  '#FF0F00',
  '#FF1E00',
  '#FF2D00',
  '#FF3D00',
  '#FF4C00',
  '#FF5B00',
  '#FF6B00',
  '#FF7A00',
  '#FF8900',
  '#FF9900',
  '#FFA800',
  '#FFB700',
  '#FFC600',
  '#FFD600',
  '#FFE500',
  '#FFF400',
  '#F9FF00',
  '#EAFF00',
  '#DBFF00',
  '#CBFF00',
  '#BCFF00',
  '#ADFF00',
  '#9EFF00',
  '#8EFF00',
  '#7FFF00',
  '#70FF00',
  '#60FF00',
  '#51FF00',
  '#42FF00',
  '#32FF00',
  '#23FF00',
  '#14FF00',
  '#05FF00',
  '#00FF0A',
  '#00FF19',
  '#00FF28',
  '#00FF38',
  '#00FF47',
  '#00FF56',
  '#00FF66',
  '#00FF75',
  '#00FF84',
  '#00FF93',
  '#00FFA3',
  '#00FFB2',
  '#00FFC1',
  '#00FFD1',
  '#00FFE0',
  '#00FFEF',
  '#00FEFF',
  '#00EFFF',
  '#00E0FF',
  '#00D1FF',
  '#00C1FF',
  '#00B2FF',
  '#00A3FF',
  '#0093FF',
  '#0084FF',
  '#0075FF',
  '#0065FF',
  '#0056FF',
  '#0047FF',
  '#0038FF',
  '#0028FF',
  '#0019FF',
  '#000AFF',
  '#0500FF',
  '#1400FF',
  '#2300FF',
  '#3200FF',
  '#4200FF',
  '#5100FF',
  '#6000FF',
  '#7000FF',
  '#7F00FF',
  '#8E00FF',
  '#9E00FF',
  '#AD00FF',
  '#BC00FF',
  '#CB00FF',
  '#DB00FF',
  '#EA00FF',
  '#F900FF',
  '#FF00F4',
  '#FF00E5',
  '#FF00D6',
  '#FF00C6',
  '#FF00B7',
  '#FF00A8',
  '#FF0098',
  '#FF0089',
  '#FF007A',
  '#FF006B',
  '#FF005B',
  '#FF004C',
  '#FF003D',
  '#FF002D',
  '#FF001E',
  '#FF000F'
]

export function shuffleArray<T>(array: T[]): T[] {
  // make a shallow copy if you don't want to mutate the original
  const a = array.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

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

  setCenter(position: THREE.Vector3) {
    this.group.position.copy(position)
  }

  setRotation(angle: number) {
    this.rotationAngle = angle
    this.group.setRotationFromAxisAngle(this.rotationAxis, angle)
  }

  getAnchorPoint(): THREE.Vector3 {
    // 1) rotate the local offset
    const local = this.anchorVector.clone().applyAxisAngle(this.rotationAxis, this.rotationAngle)
    // 2) move it into world-space

    return local.add(this.group.position)
  }
}

export const fourierSeriesScene = (): AnimatedScene => {
  return new AnimatedScene(1080, 2160, true, true, async (scene) => {
    scene.registerAudio(tickSound)
    await addHDRI({ scene, hdriPath: HDRIs.outdoor1, useAsBackground: true, blurAmount: 2 })
    addBackgroundGradient({
      scene,
      topColor: '#00639d',
      bottomColor: COLORS.black,
      backgroundOpacity: 0.5
    })
    const baseRadius = 5

    const topGroup = new THREE.Group()
    const circlesAxes = create2DAxis({ tickSpacing: baseRadius })

    topGroup.add(circlesAxes)

    const N = neonColors.length
    const colors = ['#0065FF', ...shuffleArray(neonColors)] //interpolateHexColors('#0062ff', '#ff0000', N)

    const circleGroups: CircleGroup[] = []
    for (let i = 0; i < N; i++) {
      const n = i + 1
      const circleGroup = new CircleGroup(
        new THREE.Vector3(0, 0, 0),
        ((4 / Math.PI) * baseRadius) / (2 * n - 1),
        5 + i * 1,
        colors[i]
      )
      topGroup.add(circleGroup.group)
      circleGroups.push(circleGroup)
      setOpacity(circleGroup.group, 0)
    }

    scene.add(topGroup)

    const plotYOffset = -21

    const plotAxes = create2DAxis({
      ymin: -baseRadius * 1.5,
      ymax: baseRadius * 1.5,
      xmax: Math.PI * 20,
      tickSpacing: Math.PI / 2
    })
    plotAxes.position.y = plotYOffset
    scene.add(plotAxes)

    const startCameraPos = new THREE.Vector3(-16.76293, -2.427226, 42.38217)
    const startCameraRot = new THREE.Quaternion(-0.05154293, -0.1812397, -0.009512457, 0.9820412)
    scene.camera.position.copy(startCameraPos)
    scene.camera.quaternion.copy(startCameraRot)

    const plotLines: PlotLine[] = []
    const connectionLines: PaddedLine[] = []

    for (let i = 0; i < N; i++) {
      const plotLine = new PlotLine(scene.scene, colors[i], 100_000)
      setOpacity(plotLine.line, 0)
      plotLines.push(plotLine)
      const line = createLine({ color: colors[i], width: 1 })
      setOpacity(line, 0)
      line.frustumCulled = false
      scene.add(line)
      connectionLines.push(line)
    }

    const fourierTextNode = await createFastText('Fourier Series', 2)
    fourierTextNode.position.y = 17

    scene.add(fourierTextNode)

    const textNode = await createFastText('Step Function', 1.2)
    textNode.position.y = 15.2
    setOpacity(textNode, 0.4)
    scene.add(textNode)
    const NTextNode = await createFastText('N = 0', 1.5)
    NTextNode.position.y = 13

    scene.add(NTextNode)

    let mode: 'wide' | 'close' = 'wide'

    let linesFromIndex = 0
    scene.onEachTick((tick, time) => {
      const x = time / 700

      if (tick % 60 === 0 && tick > 400) {
        linesFromIndex++
      }

      if (tick === 1300) {
        mode = mode === 'close' ? 'wide' : 'close'
      }

      if (tick === 1900) {
        mode = mode === 'close' ? 'wide' : 'close'
      }

      for (let i = 0; i < N; i++) {
        const n = i + 1
        const k = 2 * n - 1
        circleGroups[i].setRotation(k * x)
      }
      for (let i = 1; i < N; i++) {
        circleGroups[i].setCenter(circleGroups[i - 1].getAnchorPoint())
      }

      for (let i = 0; i < N; i++) {
        const tip = circleGroups[i].getAnchorPoint()
        const worldTip = tip.clone().add(topGroup.position) // Convert to world space
        if (i >= linesFromIndex) {
          plotLines[i].addPoint([x, tip.y + plotYOffset])
        }

        connectionLines[i].updatePositions(
          worldTip,
          new THREE.Vector3(x, worldTip.y + plotYOffset, 0)
        )
      }

      //scene.camera.position.x = x + startCameraPos.x
      topGroup.position.x = x
      fourierTextNode.position.x = x
      textNode.position.x = x
      NTextNode.position.x = x

      let targetPosition: THREE.Vector3
      let targetRotation: THREE.Quaternion

      if (mode === 'wide') {
        targetPosition = startCameraPos.clone()
        targetPosition.x = x + startCameraPos.x

        targetRotation = startCameraRot.clone()
      } else {
        const followGroup = circleGroups[1]
        // put the camera inside that circle group

        const tip = followGroup.getAnchorPoint()
        const followPos = tip.clone().add(topGroup.position)
        // place the camera relative to the circle
        targetPosition = followPos.clone().add(new THREE.Vector3(0, 0, 10)) // 30 units “in front”
        targetRotation = new THREE.Quaternion(0, 0, 0, 1)
      }

      const diff = targetPosition.clone().sub(scene.camera.position)

      // 2) measure the distance
      const d = diff.length()

      // 3) pick a proximity‐based scaler f(d):
      //    e.g. f(d) = 1 / (d+1) makes it *slower* when far, *faster* when close
      const f = 1 / (d + 1)

      // 4) combine with your base α
      const baseAlpha = 0.5
      const alpha = baseAlpha * f

      // compute the remaining vector
      const deltaPos = targetPosition.clone().sub(scene.camera.position).multiplyScalar(alpha)

      // move just that bit
      scene.camera.position.add(deltaPos)

      // for rotation, do the same with slerp:
      scene.camera.quaternion.slerp(targetRotation, alpha)

      //Needs to decide of how to reset lambda and stuff?
    })

    let currentN = 0
    scene.addWait(100)
    for (let i = 0; i < N; i++) {
      scene.playAudio(tickSound, Math.max(1 / (i + 1), 0.15))
      scene.do(() => {
        currentN++
        updateText(NTextNode, 'N = ' + currentN.toString())
      })

      scene.addAnim(
        fadeIn(circleGroups[i].group, 50),
        fadeIn(plotLines[i].line, 50),
        fadeIn(connectionLines[i], 50)
      )

      const history = 5
      if (i >= history) {
        scene.do(() => {
          for (let a = 0; a < i; a++) {
            setOpacity(plotLines[a].line, Math.pow(a / i, 0.5))
            setOpacity(connectionLines[a], Math.pow(a / i, 0.5))
          }
        })
      }

      scene.addWait(800 / Math.pow(i + 1, 0.5))
    }
  })
}

class PlotLine {
  private geometry: THREE.BufferGeometry
  private positions: THREE.BufferAttribute
  public line: THREE.Line
  private count: number
  private maxPoints: number
  private needsFullUpdate: boolean

  constructor(scene: THREE.Scene, color: THREE.ColorRepresentation, maxPoints: number) {
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
      color
    })

    this.line = new THREE.Line(this.geometry, material)

    this.line.frustumCulled = false
    scene.add(this.line)
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
    console.log('DOES THIS SASDFSDF', this.count)
    if (this.needsFullUpdate) {
      // Update entire buffer
      this.positions.needsUpdate = true
      this.geometry.setDrawRange(0, this.count)
      this.needsFullUpdate = false
    } else {
      // Partial update (only update new points)
      const start = Math.max(0, (this.count - 1) * 3)
      this.positions.updateRange = {
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
  const lineMat = new THREE.LineBasicMaterial({ color: axisColor })
  const arrowMat = new THREE.MeshBasicMaterial({ color: arrowColor })

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
