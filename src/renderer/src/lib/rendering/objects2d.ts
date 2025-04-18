import * as THREE from 'three'
import { COLORS } from './helpers'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { FontLoader, LineGeometry, LineMaterial, ThreeMFLoader } from 'three/examples/jsm/Addons.js'
import fontJSON from '../fonts/montserrat.json'
import fontTroika from '../../assets/fonts/Montserrat-Medium.woff'

import { Text } from 'troika-three-text'
import { preloadFont, configureTextBuilder } from 'troika-three-text'
import { Line2 } from 'three/examples/jsm/lines/webgpu/Line2.js'
import { Vector3 } from 'three'

let hasLoadedFonts = false

export const loadFonts = (): Promise<void> => {
  if (hasLoadedFonts) new Promise((resolve) => resolve)
  configureTextBuilder({
    useWorker: false
  })

  return new Promise((resolve) => {
    preloadFont(
      {
        font: fontTroika,
        characters: 'abcdefghijklmnopqrstuvwxyz'
      },
      () => {
        console.log('preload font complete')
        hasLoadedFonts = true
        resolve()
      }
    )
  })
}

export interface ObjectOptions {
  color?: THREE.ColorRepresentation
  material?: THREE.Material
}

let loadedFont: any = null

const loader = new FontLoader()
const loadFont = () => {
  loadedFont = loader.parse(fontJSON as any)
}

interface MeshWithColorMaterial extends THREE.Mesh {
  material: {
    color: THREE.Color
  } & THREE.Material
}

const createMesh = (
  geometry: THREE.BufferGeometry,
  options?: ObjectOptions
): MeshWithColorMaterial => {
  const meshMaterial = options?.material
    ? options.material
    : new THREE.MeshBasicMaterial({
        color: options?.color ? options.color : new THREE.Color(1, 1, 1),
        transparent: true
      })
  const mesh = new THREE.Mesh(geometry, meshMaterial)
  return mesh as any
}

interface RectangleOptions extends ObjectOptions {
  stroke?: {
    color?: THREE.ColorRepresentation
    width?: number
    placement?: 'inside' | 'outside' | 'center'
    visible?: boolean
    resolution?: THREE.Vector2
  }
}

export const createRectangle = (
  width: number = 10,
  height: number = 10,
  options?: RectangleOptions
) => {
  const geometry = new THREE.PlaneGeometry(width, height)
  const mesh = createMesh(geometry, options)

  if (options?.stroke) {
    const strokeParams = options.stroke
    const placement = strokeParams.placement ?? 'outside'
    const strokeWidth = strokeParams.width ?? 0.1

    // Calculate adjusted dimensions
    let strokeWidthAdj = width
    let strokeHeightAdj = height
    switch (placement) {
      case 'inside':
        strokeWidthAdj = width - strokeWidth / 2
        strokeHeightAdj = height - strokeWidth / 2
        break
      case 'outside':
        strokeWidthAdj = width + strokeWidth / 2
        strokeHeightAdj = height + strokeWidth / 2
        break
      case 'center':
        strokeWidthAdj = width
        strokeHeightAdj = height
        break
    }

    // Create rectangle path with adjusted corners
    const halfW = strokeWidthAdj / 2
    const halfH = strokeHeightAdj / 2
    const cornerCut = strokeWidth * 0.2 // Adjust this to control corner shape
    const zValue = 0.001

    const points = [
      // Bottom-left to bottom-right with corner cut
      new THREE.Vector3(-halfW + cornerCut, -halfH, zValue),
      new THREE.Vector3(halfW - cornerCut, -halfH, zValue),

      // Bottom-right to top-right with corner cut
      new THREE.Vector3(halfW, -halfH + cornerCut, zValue),
      new THREE.Vector3(halfW, halfH - cornerCut, zValue),

      // Top-right to top-left with corner cut
      new THREE.Vector3(halfW - cornerCut, halfH, zValue),
      new THREE.Vector3(-halfW + cornerCut, halfH, zValue),

      // Top-left to bottom-left with corner cut
      new THREE.Vector3(-halfW, halfH - cornerCut, zValue),
      new THREE.Vector3(-halfW, -halfH + cornerCut, zValue),

      // Close the loop
      new THREE.Vector3(-halfW + cornerCut, -halfH, zValue)
    ]

    const lineGeometry = new LineGeometry()
    lineGeometry.setPositions(points.flatMap((p) => [p.x, p.y, p.z]))

    const lineMaterial = new LineMaterial({
      color: strokeParams.color ?? 0x000000,
      linewidth: strokeWidth,
      worldUnits: true,
      resolution:
        strokeParams.resolution || new THREE.Vector2(window.innerWidth, window.innerHeight),
      depthTest: false,
      depthWrite: false,
      transparent: true
    } as THREE.LineBasicMaterialParameters) // Type assertion here

    const stroke = new Line2(lineGeometry, lineMaterial as any)
    stroke.renderOrder = 1

    if (mesh.material instanceof THREE.Material) {
      mesh.material.depthWrite = true
    }

    mesh.add(stroke)
    ;(mesh as any).stroke = stroke
  }

  return mesh
}

// Define interface extending Line with your custom method
export interface PaddedLine extends THREE.Line {
  updatePositions: (
    newPoint1?: THREE.Vector3,
    newPoint2?: THREE.Vector3,
    newPadding?: number
  ) => void
  userData: {
    point1: THREE.Vector3
    point2: THREE.Vector3
    padding: number
  }
}

export const createLine = ({
  point1 = new THREE.Vector3(0, 0, 0),
  point2 = new THREE.Vector3(0, 0, 0),
  color = new THREE.Color(1, 1, 1),
  width = 1,
  padding = 0
}: {
  point1?: THREE.Vector3
  point2?: THREE.Vector3
  color?: THREE.ColorRepresentation
  width?: number
  padding?: number
} = {}): PaddedLine => {
  // Create the line geometry
  const geometry = new THREE.BufferGeometry()

  // Set initial positions (will be updated immediately)
  const positions = new Float32Array(6)
  const posAttribute = new THREE.BufferAttribute(positions, 3)
  geometry.setAttribute('position', posAttribute)

  // Create the line material
  const material = new THREE.LineBasicMaterial({
    color: color,
    linewidth: width,
    transparent: true // Note: line width only works in WebGLRenderer with GL_LINES (limited browser support)
  })

  // Create the line
  const line = new THREE.Line(geometry, material as any) as PaddedLine

  // Store the original points and padding as properties
  line.userData = {
    point1: point1.clone(),
    point2: point2.clone(),
    padding: padding
  }

  // Initial position update
  updateLinePositions(line)

  // Add update method to the line
  line.updatePositions = function (
    newPoint1?: THREE.Vector3,
    newPoint2?: THREE.Vector3,
    newPadding?: number
  ) {
    // Update stored values if provided
    if (newPoint1) this.userData.point1.copy(newPoint1)
    if (newPoint2) this.userData.point2.copy(newPoint2)
    if (newPadding !== undefined) this.userData.padding = newPadding

    // Update the line geometry
    updateLinePositions(this)
  }

  return line
}

// Reusable vectors to avoid creating objects each time
const tempDir = new THREE.Vector3()
const tempAdjusted1 = new THREE.Vector3()
const tempAdjusted2 = new THREE.Vector3()
const tempMidPoint = new THREE.Vector3()

function updateLinePositions(line: PaddedLine) {
  const { point1, point2, padding } = line.userData
  const positions = line.geometry.attributes.position.array as Float32Array

  // Don't apply padding if points are too close
  const distance = point1.distanceTo(point2)

  if (distance <= padding * 2) {
    // Points are too close for padding, use midpoint
    tempMidPoint.addVectors(point1, point2).multiplyScalar(0.5)

    positions[0] = positions[3] = tempMidPoint.x
    positions[1] = positions[4] = tempMidPoint.y
    positions[2] = positions[5] = tempMidPoint.z
  } else {
    // Calculate direction vector
    tempDir.subVectors(point2, point1).normalize()

    // Create adjusted points with padding
    tempAdjusted1.copy(point1).addScaledVector(tempDir, padding)
    tempAdjusted2.copy(point2).addScaledVector(tempDir, -padding)

    // Update the positions array
    positions[0] = tempAdjusted1.x
    positions[1] = tempAdjusted1.y
    positions[2] = tempAdjusted1.z
    positions[3] = tempAdjusted2.x
    positions[4] = tempAdjusted2.y
    positions[5] = tempAdjusted2.z
  }

  // Mark the attribute as needing update
  line.geometry.attributes.position.needsUpdate = true
}

type StrokePlacement = 'inside' | 'outside' | 'center'

interface CircleOptions extends ObjectOptions {
  stroke?: {
    color?: THREE.ColorRepresentation
    width?: number
    placement?: StrokePlacement
    visible?: boolean
    resolution?: THREE.Vector2
  }
}

export const createCircle = (radius: number = 10, options?: CircleOptions) => {
  const geometry = new THREE.CircleGeometry(radius, 100)
  const mesh = createMesh(geometry, options)

  if (options?.stroke) {
    const strokeParams = options.stroke
    const placement = strokeParams.placement ?? 'center'
    const strokeWidth = strokeParams.width ?? 0.1

    let strokeRadius = radius
    switch (placement) {
      case 'inside':
        strokeRadius = radius - strokeWidth / 2
        break
      case 'outside':
        strokeRadius = radius + strokeWidth / 2
        break
      case 'center':
        strokeRadius = radius
        break
    }

    const path = new THREE.Path()
    path.absarc(0, 0, strokeRadius, 0, Math.PI * 2)
    const points = path.getPoints(100).map((p) => new THREE.Vector3(p.x, p.y, 0.001))

    const lineGeometry = new LineGeometry()
    lineGeometry.setPositions(points.flatMap((p) => [p.x, p.y, p.z]))

    const lineMaterial = new LineMaterial({
      color: strokeParams.color ?? 0x000000,
      linewidth: strokeWidth,
      worldUnits: true,
      resolution:
        strokeParams.resolution || new THREE.Vector2(window.innerWidth, window.innerHeight),
      depthTest: false, // Disable depth checking
      depthWrite: false, // Don't affect depth buffer
      transparent: true // Allow overdraw
    })

    const stroke = new Line2(lineGeometry, lineMaterial as any)
    stroke.renderOrder = 1 // Higher than default 0

    // Make parent mesh's material depthWrite: true
    if (mesh.material instanceof THREE.Material) {
      mesh.material.depthWrite = true
    }

    mesh.add(stroke)
    ;(mesh as any).stroke = stroke
  }

  return mesh
}

export const updateText = async (text: any, newText: string) => {
  if (text.text === newText) return
  text.text = newText

  await new Promise<void>((resolve) => {
    text.sync(() => {
      resolve()
    })
  })

  return
}

export const createFastText = async (text: string, size: number = 10, color: number = 0xffffff) => {
  // Create a Troika Text instance
  const textMesh = new Text()

  // Set basic properties
  textMesh.text = text
  textMesh.fontSize = size
  textMesh.color = color
  textMesh.font = fontTroika

  // Center the text
  textMesh.anchorX = 'center'
  textMesh.anchorY = 'middle'

  // Create a wrapper object to maintain compatibility with your existing code

  // Sync any changes and make text visible
  await new Promise<void>((resolve) => {
    textMesh.sync(() => {
      resolve()
    })
  })

  return textMesh
}

export const createMeshText = (text: string, size: number = 10, options?: ObjectOptions) => {
  if (!loadedFont) {
    loadFont()
  }

  const textOptions = {
    font: loadedFont,
    size: size,
    depth: size / 10,
    curveSegments: 12,
    bevelEnabled: true,
    bevelThickness: 0,
    bevelSize: 1,
    bevelOffset: 0,
    bevelSegments: 5
  }

  const geometry = new TextGeometry(text, textOptions)

  // Compute the bounding box
  geometry.computeBoundingBox()

  // Calculate the center offset based on the bounding box
  const centerX = -0.5 * (geometry.boundingBox!.max.x + geometry.boundingBox!.min.x)
  const centerY = -0.5 * (geometry.boundingBox!.max.y + geometry.boundingBox!.min.y)

  // Apply the translation to center the text
  geometry.translate(centerX, centerY, 0)

  return createMesh(geometry, options)
}

export const createChars = (text: string, size: number = 10, options?: ObjectOptions) => {
  if (!loadedFont) {
    loadFont()
  }

  console.log('Font loaded:', loadedFont)

  const letterSpacing = 0.1 * size // Default spacing is 5% of character size
  const centerText = true

  // Create a group to hold all character meshes
  const textGroup = new THREE.Group()

  // Track the total width to position characters correctly
  let currentPosition = 0

  // Create individual characters
  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    // Skip if it's a space, but add spacing
    if (char === ' ') {
      currentPosition += size * 0.5 // Space width is half the character size
      continue
    }

    const textOptions = {
      font: loadedFont,
      size: size,
      depth: 3,
      curveSegments: 12,
      bevelEnabled: true,
      bevelThickness: 10,
      bevelSize: 1,
      bevelOffset: 0,
      bevelSegments: 5
    }

    // Create geometry for this character
    const geometry = new TextGeometry(char, textOptions)

    // Compute bounding box for positioning
    geometry.computeBoundingBox()

    // Center the character vertically
    const centerY = -0.5 * (geometry.boundingBox!.max.y + geometry.boundingBox!.min.y)

    // We don't center horizontally - we'll position each character sequentially
    geometry.translate(0, centerY, 0)

    // Create mesh for this character
    const charMesh = createMesh(geometry, options)

    // Position character at the current offset
    charMesh.position.x = currentPosition

    // Add to group
    textGroup.add(charMesh)

    // Update position for next character
    const charWidth = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
    currentPosition += charWidth + letterSpacing
  }

  // Calculate total width (minus the last letter spacing)
  const totalWidth = currentPosition - letterSpacing

  // Center the entire text group if requested
  if (centerText) {
    textGroup.position.x = -totalWidth / 2
  }

  return textGroup
}
