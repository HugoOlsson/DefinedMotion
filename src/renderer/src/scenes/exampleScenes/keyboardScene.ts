import {
  addBackgroundGradient,
  addHDRI,
  addSceneLighting,
  HDRIs
} from '../../lib/rendering/lighting3d'
import { loadGLB } from '../../lib/rendering/objects/import'
import { AnimatedScene } from '../../lib/scene/sceneClass'
import * as THREE from 'three'
import ibmKeyboard from '../../assets/objects/keyboardScene/ibm-keyboard.glb?url'
import { createBumpMap } from '../../lib/rendering/bumpMaps/noise'
import { moveCameraAnimation3D, rotateCamera3D } from '../../lib/animation/animations'
import { createAnim } from '../../lib/animation/protocols'
import { easeLinear } from '../../lib/animation/interpolations'
import { createFastText, createLine, updateText } from '../../lib/rendering/objects2d'
import { COLORS } from '../../lib/rendering/helpers'
import { createText } from 'three/examples/jsm/Addons.js'
import { placeNextTo } from '../../lib/scene/helpers'

const strokeColor = '#ff0000'

const keyPositions: { [key: string]: () => [[number, number, number], [number, number]] } = {
  //Number row
  '1': () => [
    [-3.95, 0.95, -0.07],
    [0.35, 0.35]
  ],
  '2': () => nextKeyX(keyPositions['1']()),
  '3': () => nextKeyX(keyPositions['2']()),
  '4': () => nextKeyX(keyPositions['3']()),
  '5': () => nextKeyX(keyPositions['4']()),
  '6': () => nextKeyX(keyPositions['5']()),
  '7': () => nextKeyX(keyPositions['6']()),
  '8': () => nextKeyX(keyPositions['7']()),
  '9': () => nextKeyX(keyPositions['8']()),
  '0': () => nextKeyX(keyPositions['9']()),
  '-': () => nextKeyX(keyPositions['0']()),
  '=': () => nextKeyX(keyPositions['-']()),

  // First Row (QWERTYUIOP{})
  Q: () => [
    [-3.75, 0.85, 0.3],
    [0.35, 0.35]
  ],
  W: () => nextKeyX(keyPositions['Q']()),
  E: () => nextKeyX(keyPositions['W']()),
  R: () => nextKeyX(keyPositions['E']()),
  T: () => nextKeyX(keyPositions['R']()),
  Y: () => nextKeyX(keyPositions['T']()),
  U: () => nextKeyX(keyPositions['Y']()),
  I: () => nextKeyX(keyPositions['U']()),
  O: () => nextKeyX(keyPositions['I']()),
  P: () => nextKeyX(keyPositions['O']()),
  '{': () => nextKeyX(keyPositions['P']()),
  '}': () => nextKeyX(keyPositions['{']()),

  // Second Row (ASDFGHJKL;')
  A: () => [
    [-3.65, 0.78, 0.7],
    [0.35, 0.35]
  ], // Slightly offset right and lower than Q
  S: () => nextKeyX(keyPositions['A']()),
  D: () => nextKeyX(keyPositions['S']()),
  F: () => nextKeyX(keyPositions['D']()),
  G: () => nextKeyX(keyPositions['F']()),
  H: () => nextKeyX(keyPositions['G']()),
  J: () => nextKeyX(keyPositions['H']()),
  K: () => nextKeyX(keyPositions['J']()),
  L: () => nextKeyX(keyPositions['K']()),
  ';': () => nextKeyX(keyPositions['L']()),
  "'": () => nextKeyX(keyPositions[';']()),

  // Third Row (ZXCVBNM,./)
  Z: () => [
    [-3.45, 0.71, 1.05],
    [0.35, 0.35]
  ], // Further offset right and lower than A
  X: () => nextKeyX(keyPositions['Z']()),
  C: () => nextKeyX(keyPositions['X']()),
  V: () => nextKeyX(keyPositions['C']()),
  B: () => nextKeyX(keyPositions['V']()),
  N: () => nextKeyX(keyPositions['B']()),
  M: () => nextKeyX(keyPositions['N']()),
  ',': () => nextKeyX(keyPositions['M']()),
  '.': () => nextKeyX(keyPositions[',']()),
  '/': () => nextKeyX(keyPositions['.']()), // Last key, no trailing comma

  Space: () => [
    [-1.64, 0.7, 1.4],
    [2.65, 0.35]
  ]
}

const translateToKey = (char: string): string => {
  const symbolToKey: { [key: string]: string } = {
    '!': '1',
    '@': '2',
    '#': '3',
    $: '4',
    '%': '5',
    '^': '6',
    '&': '7',
    '*': '8',
    '(': '9',
    ')': '0',
    _: '-',
    '+': '=',
    '{': '[',
    '}': ']',
    '|': '\\',
    ':': ';',
    '"': "'",
    '<': ',',
    '>': '.',
    '?': '/',
    '~': '`',
    ' ': 'Space' // Add "Space" to keyPositions if needed
  }

  // Handle letters (convert to uppercase)
  if (/^[a-z]$/i.test(char)) return char.toUpperCase()
  // Handle symbols
  return symbolToKey[char] || char // Fallback to the original char if no mapping
}

// Example frequency map, for instance, representing typed character frequencies.
let frequencyMap: FrequencyMap = {}

const nextKeyX = (
  current: [[number, number, number], [number, number]]
): [[number, number, number], [number, number]] => {
  const newPos: [number, number, number] = [...current[0]]
  newPos[0] += 0.385
  return [newPos, current[1]]
}

let lastStroke: undefined | THREE.Mesh
let pointLight: undefined | THREE.PointLight

const setPosition = (scene: THREE.Scene, letter: string) => {
  if (lastStroke !== undefined) {
    scene.remove(lastStroke)
  }
  const position = keyPositions[letter]()[0]
  const keyStroke = keyStrokePlane(...keyPositions[letter]()[1])
  keyStroke.position.set(...position)

  if (pointLight === undefined || !scene.children.includes(pointLight)) {
    pointLight = new THREE.PointLight(strokeColor, 10)
    pointLight.castShadow = true
    scene.add(pointLight)
  }
  position[1] += 1.5
  pointLight.position.set(...position)

  scene.add(keyStroke)
  lastStroke = keyStroke
  return { keyStroke, pointLight }
}

const bumpMap = createBumpMap({
  width: 5000,
  height: 5000,
  noiseAlgorithm: 'random',
  intensity: 0.1
})

const keyboard = await loadGLB(ibmKeyboard)

const createPlane = (width: number, height: number, bumpMap?: THREE.CanvasTexture) => {
  // Create the plane geometry
  const geometry = new THREE.PlaneGeometry(width, height)

  // Create a basic material
  // Use MeshBasicMaterial if you do not need lighting or effects – this is ideal for 2D shapes
  const material = new THREE.MeshStandardMaterial({
    color: '#ffffff', // Green color
    side: THREE.DoubleSide, // Render both sides
    bumpMap,
    metalness: 0.8,
    roughness: 0.1
  })

  // Combine the geometry and material into a mesh
  const plane = new THREE.Mesh(geometry, material)
  plane.receiveShadow = true
  plane.rotateX(Math.PI / 2)

  return plane
}

const keyStrokePlane = (width: number, height: number, bumpMap?: THREE.CanvasTexture) => {
  // Create the plane geometry
  const geometry = new THREE.PlaneGeometry(width, height)

  // Create a basic material
  // Use MeshBasicMaterial if you do not need lighting or effects – this is ideal for 2D shapes
  const material = new THREE.MeshBasicMaterial({
    color: strokeColor, // Green color
    side: THREE.DoubleSide, // Render both sides
    transparent: true,
    opacity: 0.5
  })

  // Combine the geometry and material into a mesh
  const plane = new THREE.Mesh(geometry, material)
  plane.receiveShadow = true
  plane.rotateX(Math.PI / 2)

  return plane
}

const setText = async (textNode: any, addedCharacter: string) => {
  // Ensure historyTextStore is initialized.
  if (!textNode.historyTextStore) {
    textNode.historyTextStore = ''
  }

  const numberVisible = 28

  // If textNode.text starts with an ellipsis, remove it to recover the previously visible text.
  // (This assumes that all truncated texts are prefixed with "...")
  const visibleText = textNode.text.startsWith('...') ? textNode.text.slice(3) : textNode.text

  // Reconstruct the full text using the stored history and the current visible text.
  let fullText = textNode.historyTextStore + visibleText

  // Append the new character.
  fullText += addedCharacter

  if (fullText.length > numberVisible) {
    // Calculate new visible portion:
    const newVisible = fullText.slice(-numberVisible)
    // The removed part forms the new history.
    textNode.historyTextStore = fullText.slice(0, fullText.length - numberVisible)
    // Set displayed text with an ellipsis to indicate there is more history.
    textNode.text = '...' + newVisible
  } else {
    // If the text is not longer than numberVisible characters, update the text and clear the history.
    textNode.text = fullText
    textNode.historyTextStore = ''
  }

  // Call updateText with the new text value.
  await updateText(textNode, textNode.text)
}
const typeAnimation = (scene: THREE.Scene, characters: string, textNode: any) => {
  let lastCharacter = ''
  let keyStroke: THREE.Mesh | undefined
  let pointLight: THREE.PointLight | undefined
  const animation = createAnim(
    easeLinear(0, 1, characters.length * 50),
    async (value, _, isLast) => {
      const character = characters[Math.round(value * (characters.length - 1))]

      if (character !== lastCharacter) {
        lastCharacter = character
        ;({ keyStroke, pointLight } = setPosition(scene, translateToKey(character)))
        await setText(textNode, character)
        if (frequencyMap[character] === undefined) {
          frequencyMap[character] = 1
        } else {
          frequencyMap[character] += 1
        }
      }

      if (isLast) {
        setTimeout(() => {
          if (keyStroke) {
            scene.remove(keyStroke)
          }
          if (pointLight) {
            scene.remove(pointLight)
          }
        }, 500)
      }
    }
  )

  return animation
}

function prettyPrintWithBreaks(obj, lineLength = 40) {
  const sortedFrequencyMap = Object.keys(frequencyMap)
    .sort((a, b) => frequencyMap[b] - frequencyMap[a])
    .reduce((acc, key) => {
      acc[key] = frequencyMap[key]
      return acc
    }, {})

  // First, pretty-print the JSON normally with indentation.
  const jsonStr = JSON.stringify(sortedFrequencyMap)

  // Then, process the string to insert a line break every lineLength characters.
  // This approach splits the entire string, which may break in the middle of tokens.
  let result = ''
  for (let i = 0; i < jsonStr.length; i += lineLength) {
    result += jsonStr.slice(i, i + lineLength) + '\n'
  }
  return result
}

export const keyboardScene = (): AnimatedScene => {
  return new AnimatedScene(1080, 2160, true, true, async (scene) => {
    frequencyMap = {}
    addSceneLighting(scene.scene, { intensity: 1, colorScheme: 'cool' })

    scene.renderer.shadowMap.enabled = true
    await addHDRI({
      scene,
      hdriPath: HDRIs.photoStudio1,
      useAsBackground: true,
      lightingIntensity: 0.5,
      blurAmount: 2
    })
    addBackgroundGradient({
      scene,
      topColor: COLORS.blue,
      bottomColor: COLORS.black,
      lightingIntensity: 10
    })
    keyboard.scale.set(20, 20, 20)
    scene.add(keyboard)

    scene.do(() => {
      scene.camera.position.set(-2.264274, 2.223899, 25.48552)
      scene.camera.quaternion.set(-0.0590337, -0.005013175, -0.0002964671, 0.9982434)
    })

    scene.addAnim(
      moveCameraAnimation3D(
        scene.camera,
        new THREE.Vector3(-2.151799 - 1, 22.90854, 1.769867 + 1).multiplyScalar(0.65),
        new THREE.Quaternion(-0.6683053, -0.001480137, -0.001329754, 0.7438844),
        1000
      )
    )

    const rotateAnim = moveCameraAnimation3D(
      scene.camera,
      new THREE.Vector3(-2.196693 - 1, 20.67784, 9.621079 + 1).multiplyScalar(0.65),
      new THREE.Quaternion(-0.5668163, -0.003930429, -0.002704235, 0.8238304),
      4000
    )

    scene.addSequentialBackgroundAnims(
      ...Array(10)
        .fill(0)
        .flatMap(() => [rotateAnim, rotateAnim.copy().reverse()])
    )

    const lightY = 5
    const lightX = -2
    const pointLight = new THREE.PointLight('#ffffff', 40) // color, intensity, distance
    pointLight.position.y = lightY
    pointLight.position.x = lightX
    pointLight.position.z = -0.5
    //pointLight.castShadow = true

    // scene.add(pointLight)

    const texturePlane = createPlane(80, 80, bumpMap)
    const largePlane = createPlane(1000, 1000)
    largePlane.position.y = -0.1
    // Add the plane to the scene
    scene.add(texturePlane)
    scene.add(largePlane)
    ;(scene.camera as THREE.PerspectiveCamera).setFocalLength(27)

    //setPosition(scene.scene, translateToKey(' '))

    const text = await createFastText('', 0.4)
    text.rotateX(-Math.PI / 2)
    text.position.y = 0.02

    text.position.z = -3.5
    text.position.x = -5

    text.anchorX = 'left'
    text.anchorY = 'bottom'
    text.material.opacity = 0.8
    scene.add(text)

    const point1 = new THREE.Vector3(-5, 0.05, -3.4)
    const line = createLine({ point1, point2: point1.clone().add(new THREE.Vector3(6, 0, 0)) })
    scene.add(line)
    /*
    const barChart = new BarChart(scene.scene, {
      maxDisplayHeight: 2,
      barWidth: 0.3,
      spacing: 0.4,
      textSize: 0.3,
      position: new THREE.Vector3(-4, 0, 5)
    })
      */

    const geometryBarsPlane = new THREE.PlaneGeometry(10, 3)

    // Create a basic material
    // Use MeshBasicMaterial if you do not need lighting or effects – this is ideal for 2D shapes
    const materialBars = new THREE.MeshStandardMaterial({
      color: '#ffffff', // Green color
      side: THREE.DoubleSide, // Render both sides
      bumpMap,
      metalness: 0.8,
      roughness: 0.1
    })

    // Combine the geometry and material into a mesh
    const barsPlane = new THREE.Mesh(geometryBarsPlane, materialBars)
    barsPlane.receiveShadow = true
    barsPlane.rotateX(Math.PI / 2)
    barsPlane.position.z = 4
    barsPlane.position.y = 0.01
    scene.add(barsPlane)

    const frequencyText = await createFastText('10', 0.25)
    frequencyText.rotateX(-Math.PI / 2)
    frequencyText.position.z = 3
    frequencyText.position.x = -4.5
    frequencyText.position.y = 0.02
    frequencyText.anchorX = 'left'
    frequencyText.anchorY = 'top'
    frequencyText.outlineColor = '#19006a'
    frequencyText.outlineWidth = 0.01
    frequencyText.letterSpacing = 0.1
    scene.add(frequencyText)

    scene.addAnim(typeAnimation(scene.scene, entireProgram, text))

    const initialZoom = scene.camera.zoom
    scene.onEachTick(async (tick, time) => {
      pointLight.position.y = lightY * (1 + Math.sin(time / 500) / 10)
      pointLight.position.x = lightX * (1 + Math.sin(time / 500) / 10)
      scene.camera.zoom = initialZoom * (1.3 + Math.sin(time / 1000) / 20)
      //await barChart.updateData(frequencyMap)
      updateText(frequencyText, prettyPrintWithBreaks(frequencyMap))
    })
    scene.addWait(6000)
  })
}

// Type for the frequency map where each key is a character and each value is its frequency count.
type FrequencyMap = { [char: string]: number }

// Interface for a text mesh that is created by your text helper functions.
interface FastTextMesh extends THREE.Mesh {
  text: string
  outlineColor?: string
  outlineWidth?: number
}

class BarChart {
  private scene: THREE.Scene
  private maxDisplayHeight: number
  private barWidth: number
  private spacing: number
  private textSize: number
  private position: THREE.Vector3
  private chartGroup: THREE.Group
  private material: THREE.MeshStandardMaterial
  private barMeshes: THREE.Mesh[] = []
  private textMeshes: FastTextMesh[] = []

  /**
   * Creates an instance of BarChart.
   *
   * @param scene - The Three.js scene to which the chart will be added.
   * @param options - Configuration options for the chart.
   */
  constructor(
    scene: THREE.Scene,
    options?: {
      maxDisplayHeight?: number
      barWidth?: number
      spacing?: number
      textSize?: number
      position?: THREE.Vector3
    }
  ) {
    this.scene = scene
    this.maxDisplayHeight = options?.maxDisplayHeight ?? 2
    this.barWidth = options?.barWidth ?? 0.3
    this.spacing = options?.spacing ?? 0.4
    this.textSize = options?.textSize ?? 0.3
    this.position = options?.position ?? new THREE.Vector3(0, 0, 0)

    // Create a group to contain all the bars; position and rotate it as needed.
    this.chartGroup = new THREE.Group()

    // Rotate so that the chart lays flat (optional based on your scene).
    this.chartGroup.rotateX(-Math.PI / 2)
    this.chartGroup.position.copy(this.position)
    this.scene.add(this.chartGroup)

    // Set up the material for the bars.
    this.material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.8,
      roughness: 0.2
    })
  }

  /**
   * Updates the bar chart with new data from a frequency map.
   *
   * @param frequencyMap - An object mapping characters to frequency counts.
   */
  async updateData(frequencyMap: FrequencyMap): Promise<void> {
    // Remove previous bar meshes from the group.
    this.barMeshes.forEach((bar) => this.chartGroup.remove(bar))
    // Remove previous text meshes from the scene.
    this.textMeshes.forEach((textMesh) => this.scene.remove(textMesh))
    this.barMeshes = []
    this.textMeshes = []

    // Loop through each character in the map and create a corresponding bar and text label.
    // 1. Sort keys in decreasing order based on frequency.
    const keys = Object.keys(frequencyMap)
      .filter((key) => key.trim() !== '')
      .sort((a, b) => frequencyMap[b] - frequencyMap[a])
    // Prepare an array of frequencies for later scaling.
    const frequencies = keys.map((key) => frequencyMap[key])
    // Ensure the maximum value is at least 1 to avoid division by zero.
    const maxValue = Math.max(...frequencies, 1)

    for (let index = 0; index < keys.length; index++) {
      const char = keys[index]
      const value = frequencyMap[char]

      // Scale the bar height relative to maxDisplayHeight.
      const scaledValue = (value / maxValue) * this.maxDisplayHeight

      // Create the bar geometry and mesh.
      const geometry = new THREE.BoxGeometry(this.barWidth, scaledValue, 0.5)
      const bar = new THREE.Mesh(geometry, this.material)
      bar.castShadow = true

      // Begin building from the left, placing the first bar at x = 0.
      bar.position.x = index * this.spacing
      // Position y so the bar's base sits at 0.
      bar.position.y = scaledValue / 2
      this.chartGroup.add(bar)
      this.barMeshes.push(bar)

      // Create the text mesh for the character.
      // Now the text displays the character instead of the frequency value.
      const textMesh = await createFastText(char, this.textSize)
      textMesh.outlineColor = '#012665'
      textMesh.outlineWidth = 0.01
      // Rotate text to match scene orientation.
      textMesh.rotateX(-Math.PI / 2)
      // Align the text with the bar and offset slightly.
      textMesh.position.x = -4 + index * this.spacing
      textMesh.position.y = 0.1
      textMesh.position.z = this.chartGroup.position.z + 0.2
      this.scene.add(textMesh)
      this.textMeshes.push(textMesh)

      // Update the text mesh using the provided asynchronous update function.
      await updateText(textMesh, char)
    }
  }
}

const entireProgram = `At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga. Et harum quidem rerum facilis est et expedita distinctio. Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus, omnis voluptas assumenda est, omnis dolor repellendus. Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates repudiandae sint et molestiae non recusandae. Itaque earum rerum hic tenetur a sapiente delectus, ut aut reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat.`
