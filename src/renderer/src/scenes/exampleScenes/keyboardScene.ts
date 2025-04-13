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
import { moveCameraAnimation3D } from '../../lib/animation/animations'
import { createAnim } from '../../lib/animation/protocols'
import { easeLinear } from '../../lib/animation/interpolations'

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
    [-1.65, 0.71, 1.4],
    [2.7, 0.35]
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
    console.log('ADDINT POINTLIGHT')
    pointLight = new THREE.PointLight(strokeColor, 40)
    pointLight.castShadow = true
    scene.add(pointLight)
  }
  position[1] += 2
  pointLight.position.set(...position)

  scene.add(keyStroke)
  lastStroke = keyStroke
  return { keyStroke, pointLight }
}

function updatePlaneSize(geometry: THREE.PlaneGeometry, newWidth: number, newHeight: number) {
  const vertices = geometry.attributes.position.array

  // Loop through vertices and update positions
  for (let i = 0; i < vertices.length; i += 3) {
    vertices[i] *= newWidth / geometry.parameters.width // x-coordinate
    vertices[i + 2] *= newHeight / geometry.parameters.height // z-coordinate
  }

  // Mark the geometry as needing an update
  geometry.attributes.position.needsUpdate = true
  geometry.computeVertexNormals() // Recalculate normals for lighting
}

const bumpMap = createBumpMap({
  width: 4000,
  height: 4000,
  noiseAlgorithm: 'random',
  intensity: 0.7
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
    metalness: 1,
    bumpMap,
    roughness: 0.3
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

const typeAnimation = (scene: THREE.Scene, characters: string) => {
  let lastCharacter = ''
  let keyStroke: THREE.Mesh | undefined
  let pointLight: THREE.PointLight | undefined
  const animation = createAnim(easeLinear(0, 1, characters.length * 100), (value, _, isLast) => {
    const character = characters[Math.round(value * (characters.length - 1))]

    if (character !== lastCharacter) {
      lastCharacter = character
      ;({ keyStroke, pointLight } = setPosition(scene, translateToKey(character)))
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
  })

  return animation
}

export const keyboardScene = (): AnimatedScene => {
  return new AnimatedScene(2000, 2000, true, true, async (scene) => {
    addSceneLighting(scene.scene, { intensity: 1, colorScheme: 'warm' })

    scene.renderer.shadowMap.enabled = true
    /*   await addHDRI({
      scene,
      hdriPath: HDRIs.photoStudio3,
      useAsBackground: true,
      lightingIntensity: 0.7,
      blurAmount: 2
    })*/
    addBackgroundGradient({
      scene,
      topColor: '#ffecd1',
      bottomColor: '#451616',
      backgroundOpacity: 0.8,
      addLighting: true,
      lightingIntensity: 0.5
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
        new THREE.Vector3(-2.151799, 18.90854, 1.769867),
        new THREE.Quaternion(-0.6683053, -0.001480137, -0.001329754, 0.7438844),
        1000
      )
    )

    const lightY = 5
    const lightX = -2
    const pointLight = new THREE.PointLight('#ffecd1', 50) // color, intensity, distance
    pointLight.position.y = lightY
    pointLight.position.x = lightX

    scene.add(pointLight)

    const texturePlane = createPlane(80, 80, bumpMap)
    const largePlane = createPlane(1000, 1000)
    largePlane.position.y = -0.1
    // Add the plane to the scene
    scene.add(texturePlane)
    scene.add(largePlane)
    ;(scene.camera as THREE.PerspectiveCamera).setFocalLength(80)

    //setPosition(scene.scene, translateToKey(' '))

    const strokes = ['Hugo Olsson is swedish @']

    scene.addAnim(
      typeAnimation(
        scene.scene,
        "To complete the number row in the keyboard configuration, each subsequent key is positioned using the nextKeyX function relative to the previous key. Here's the extended configuration:"
      )
    )

    const initialZoom = scene.camera.zoom
    scene.onEachTick((tick, time) => {
      pointLight.position.y = lightY * (1 + Math.sin(time / 500) / 10)
      pointLight.position.x = lightX * (1 + Math.sin(time / 500) / 10)
      scene.camera.zoom = initialZoom * (1 + Math.sin(time / 1000) / 10)
    })
    scene.addWait(6000)
  })
}
