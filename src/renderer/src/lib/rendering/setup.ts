import * as THREE from 'three'
import type { SceneComponents } from './protocols'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export const createScene = (
  container: HTMLElement,
  pixelsWidth: number,
  pixelsHeight: number,
  threeDim: boolean,
  zoom: number
): SceneComponents => {
  // Create the scene
  const scene: THREE.Scene = new THREE.Scene()

  // Get the container dimensions
  const width: number = container.clientWidth
  const height: number = container.clientHeight
  // Use the provided dimensions for aspect ratio calculation
  const aspect: number = pixelsWidth / pixelsHeight

  // Camera setup
  let camera: THREE.PerspectiveCamera | THREE.OrthographicCamera
  let controls: OrbitControls | null = null

  if (threeDim) {
    // 3D configuration
    camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000)
    camera.position.set(0, 0, zoom)
  } else {
    // 2D configuration
    camera = new THREE.OrthographicCamera(-zoom * aspect, zoom * aspect, zoom, -zoom, 1, 1000)
    camera.position.set(0, 0, zoom)
  }

  // Add orbit controls
  controls = new OrbitControls(camera, container)
  controls.enableDamping = true
  controls.dampingFactor = 0.3

  if (!threeDim) {
    // Custom 2D controls behavior
    controls.enableRotate = false // Disable rotation for 2D
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN, // Only allow panning with left mouse
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    }
    controls.touches = {
      ONE: THREE.TOUCH.PAN,
      TWO: THREE.TOUCH.DOLLY_PAN
    }
    controls.maxZoom = 10 // Limit zoom for 2D view
    controls.minZoom = 0.1
  }

  // Create the renderer with antialiasing enabled and set its internal resolution
  const renderer: THREE.WebGLRenderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setViewport(0, 0, pixelsWidth, pixelsHeight)
  renderer.setClearColor(0x000000)

  // Append the renderer's canvas element to the provided container
  container.appendChild(renderer.domElement)

  renderer.render(scene, camera)

  // Return the created objects for further manipulation if needed
  return { scene, camera, renderer, controls }
}
