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
const backCharacter = 'Ď'

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
  ],

  [backCharacter]: () => [
    [0.9, 0.93, -0.07],
    [0.7, 0.35]
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

  if (char === backCharacter) return backCharacter

  // Handle letters (convert to uppercase)
  if (/^[a-z]$/i.test(char)) return char.toUpperCase()
  // Handle symbols
  return symbolToKey[char] || char // Fallback to the original char if no mapping
}

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
  // Ensure historyTextStore is initialized
  if (!textNode.historyTextStore) {
    textNode.historyTextStore = ''
  }

  const numberVisible = 28

  // Get visible text (without ellipsis if present)
  const visibleText = textNode.text.startsWith('...') ? textNode.text.slice(3) : textNode.text

  // Reconstruct full text from history and visible portion
  let fullText = textNode.historyTextStore + visibleText

  // Process the input character
  if (addedCharacter === backCharacter) {
    // Handle backspace: remove last character if exists
    if (fullText.length > 0) {
      fullText = fullText.slice(0, -1)
    }
  } else {
    // Append new character normally
    fullText += addedCharacter
  }

  // Update text storage and visible text
  if (fullText.length > numberVisible) {
    // Split into new history and visible portions
    const newVisible = fullText.slice(-numberVisible)
    textNode.historyTextStore = fullText.slice(0, fullText.length - numberVisible)
    textNode.text = '...' + newVisible
  } else {
    // Show full text without ellipsis
    textNode.text = fullText
    textNode.historyTextStore = ''
  }

  // Update the text node
  await updateText(textNode, textNode.text)
}
const typeAnimation = (scene: THREE.Scene, characters: string, textNode: any, speed: number) => {
  let lastIndex = -1
  let keyStroke: THREE.Mesh | undefined
  let pointLight: THREE.PointLight | undefined
  const animation = createAnim(
    easeLinear(0, 1, characters.length * speed),
    async (value, _, isLast) => {
      const index = Math.round(value * (characters.length - 1))
      const character = characters[index]

      if (index !== lastIndex) {
        lastIndex = index
        ;({ keyStroke, pointLight } = setPosition(scene, translateToKey(character)))
        await setText(textNode, character)
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

export const keyboardScene = (): AnimatedScene => {
  return new AnimatedScene(1080, 2160, true, true, async (scene) => {
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

    const typeSpeed = 70
    const deleteSpeed = 30

    const line1 = 'Hello people!'
    scene.addAnim(typeAnimation(scene.scene, line1, text, typeSpeed))
    scene.addWait(1000)
    scene.addAnim(
      typeAnimation(scene.scene, [...line1].map(() => backCharacter).join(''), text, deleteSpeed)
    )
    /*
    scene.addWait(300)
    const line2 = 'I am just testing my programmatic animation library!'
    scene.addAnim(typeAnimation(scene.scene, line2, text, typeSpeed))
    scene.addWait(1000)
    scene.addAnim(
      typeAnimation(scene.scene, [...line2].map(() => backCharacter).join(''), text, deleteSpeed)
    )

    scene.addWait(300)
    const line3 = `It is inspired by 3Blue1Brown's Manim and Motion Canvas. It is meant for technical and mathematical animations!`
    scene.addAnim(typeAnimation(scene.scene, line3, text, typeSpeed))
    scene.addWait(1000)
    scene.addAnim(
      typeAnimation(scene.scene, [...line3].map(() => backCharacter).join(''), text, deleteSpeed)
    )

    scene.addWait(300)
    const line4 =
      'It features: Hot reload, Navigable Viewport, Advanced Rendering Primitives for 2D and 3D, Realtime development playback, Precise Animations, Typed objects and more!'
    scene.addAnim(typeAnimation(scene.scene, line4, text, typeSpeed))
    scene.addWait(1000)
    scene.addAnim(
      typeAnimation(scene.scene, [...line4].map(() => backCharacter).join(''), text, deleteSpeed)
    )

    scene.addWait(300)
    const line5 = `Use the project by visiting "Defined Motion" on GitHub, thanks!`
    scene.addAnim(typeAnimation(scene.scene, line5, text, typeSpeed))
    scene.addWait(1000)
    scene.addAnim(
      typeAnimation(scene.scene, [...line5].map(() => backCharacter).join(''), text, deleteSpeed)
    )

    */

    const initialZoom = scene.camera.zoom
    scene.onEachTick(async (tick, time) => {
      pointLight.position.y = lightY * (1 + Math.sin(time / 500) / 10)
      pointLight.position.x = lightX * (1 + Math.sin(time / 500) / 10)
      scene.camera.zoom = initialZoom * (1.3 + Math.sin(time / 1000) / 20)
      //await barChart.updateData(frequencyMap)
    })
    scene.addWait(3000)
  })
}
