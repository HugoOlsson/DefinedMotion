import { createLine } from '../../lib/rendering/objects2d'
import { createSVGShape } from '../../lib/rendering/svg/parsing'
import { AnimatedScene } from '../../lib/scene/sceneClass'
import * as THREE from 'three'

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
const getCircleSVG = (color: string, percentageStrokeWidth: number = 4) => `
<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
  <circle
    cx="0" cy="0" r="100"
    stroke="${color}"
    stroke-width="${percentageStrokeWidth}"
    fill="none" />
</svg>
`

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

  // Should return world position for the anchor point
  getAnchorPoint(): THREE.Vector3 {
    // ensure matrices are up to date
    this.group.updateMatrixWorld(true)
    // clone your local anchor vector so you don’t mutate the original
    const localAnchor = this.anchorVector.clone()
    // transform it through the group's world matrix
    return this.group.localToWorld(localAnchor)
  }
}

interface FunctionData {
  name: string
  radius: (n: number) => number
  k: (n: number) => number
}

const N = 10
const colors = ['#FFFFFF', neonColors] //interpolateHexColors('#0062ff', '#ff0000', N)
const plotYOffset = -21
const baseRadius = 5

const relations: FunctionData[] = [
  {
    name: 'Sawtooth',
    radius: (n) => ((2 / Math.PI) * baseRadius) / n,
    k: (n) => n
  }
]

export const fourierSeriesScene2 = (): AnimatedScene => {
  return new AnimatedScene(1080, 2160, false, true, async (scene) => {
    scene.onEachTick((tick, time) => {
      const x = time / 700
    })

    scene.addWait(10000)
  })
}
