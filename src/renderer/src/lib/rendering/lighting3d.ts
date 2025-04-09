import * as THREE from 'three'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import _photoStudio1 from '../../assets/hdri/photo-studio1.hdr?url'
import _photoStudio2 from '../../assets/hdri/photo-studio2.hdr?url'
import _photoStudio3 from '../../assets/hdri/photo-studio3.hdr?url'
import { AnimatedScene } from '../scene/sceneClass'
import { COLORS } from './helpers'

/**
 * Configuration options for the scene lighting
 */
interface LightingOptions {
  /** Whether to add ambient light (default: true) */
  addAmbient?: boolean
  /** Whether to add directional lights (default: true) */
  addDirectional?: boolean
  /** Whether to add spot lights (default: true) */
  addSpot?: boolean
  /** Whether to add light helper objects (default: false) */
  addHelpers?: boolean
  /** Preset color scheme (default: 'cool') */
  colorScheme?: 'cool' | 'warm' | 'contrast' | 'studio' | 'dramatic'
  /** Base intensity multiplier for all lights (default: 1.0) */
  intensity?: number
}

/**
 * Collection of lights created by the lighting function
 */
interface LightCollection {
  ambient: THREE.AmbientLight | null
  directional: THREE.DirectionalLight[]
  spot: THREE.SpotLight[]
  helpers: THREE.Object3D[]
}

/**
 * Color scheme definition
 */
interface ColorScheme {
  ambient: number
  key: number
  fill: number
  rim: number
}

/**
 * Adds multiple light sources to create a visually appealing lighting setup
 * Scaled appropriately for a standard THREE.GridHelper scene
 *
 * @param scene - The Three.js scene to add lights to
 * @param options - Optional configuration settings
 * @returns Collection of created lights for further manipulation
 */
export function addSceneLighting(
  scene: THREE.Scene,
  options: LightingOptions = {}
): LightCollection {
  // Set default options
  const config: Required<LightingOptions> = {
    addAmbient: true,
    addDirectional: true,
    addSpot: true,
    addHelpers: false,
    colorScheme: 'cool',
    intensity: 1.0,
    ...options
  }

  // Store all created lights for reference
  const lights: LightCollection = {
    ambient: null,
    directional: [],
    spot: [],
    helpers: []
  }

  // Define color schemes
  const colorSchemes: Record<Required<LightingOptions>['colorScheme'], ColorScheme> = {
    cool: {
      ambient: 0x445570,
      key: 0xffffff,
      fill: 0x6495ed, // cornflower blue
      rim: 0x00ffff // cyan
    },
    warm: {
      ambient: 0x553322,
      key: 0xffcc88,
      fill: 0xff8844,
      rim: 0xff3333
    },
    contrast: {
      ambient: 0x222222,
      key: 0xffffff,
      fill: 0x00aaff,
      rim: 0xff0088
    },
    studio: {
      ambient: 0xaaaaaa,
      key: 0xffffff,
      fill: 0xdddddd,
      rim: 0x8888ff
    },
    dramatic: {
      ambient: 0x111122,
      key: 0xffffaa,
      fill: 0x2222ff,
      rim: 0xff00ff
    }
  }

  // Get the selected color scheme
  const colors = colorSchemes[config.colorScheme]

  // Add ambient light
  if (config.addAmbient) {
    const ambient = new THREE.AmbientLight(colors.ambient, 0.5 * config.intensity)
    scene.add(ambient)
    lights.ambient = ambient
  }

  // Add directional lights (key, fill, rim setup)
  if (config.addDirectional) {
    // Key light (main light)
    const keyLight = new THREE.DirectionalLight(colors.key, 1.0 * config.intensity)
    // Position scaled for standard grid (10x10)
    keyLight.position.set(5, 7, 5)
    keyLight.castShadow = true

    // Configure shadows for better quality
    keyLight.shadow.mapSize.width = 2048
    keyLight.shadow.mapSize.height = 2048
    keyLight.shadow.camera.near = 0.5
    keyLight.shadow.camera.far = 30
    keyLight.shadow.camera.left = -10
    keyLight.shadow.camera.right = 10
    keyLight.shadow.camera.top = 10
    keyLight.shadow.camera.bottom = -10
    keyLight.shadow.bias = -0.0001

    scene.add(keyLight)
    lights.directional.push(keyLight)

    // Fill light (secondary light to fill shadows)
    const fillLight = new THREE.DirectionalLight(colors.fill, 0.6 * config.intensity)
    fillLight.position.set(-5, 4, -3)
    scene.add(fillLight)
    lights.directional.push(fillLight)

    // Rim light (edge highlighting from behind)
    const rimLight = new THREE.DirectionalLight(colors.rim, 0.8 * config.intensity)
    rimLight.position.set(2, 3, -8)
    scene.add(rimLight)
    lights.directional.push(rimLight)

    // Add helpers if requested
    if (config.addHelpers) {
      const keyHelper = new THREE.DirectionalLightHelper(keyLight, 1)
      const fillHelper = new THREE.DirectionalLightHelper(fillLight, 1)
      const rimHelper = new THREE.DirectionalLightHelper(rimLight, 1)

      scene.add(keyHelper)
      scene.add(fillHelper)
      scene.add(rimHelper)

      lights.helpers.push(keyHelper, fillHelper, rimHelper)
    }
  }

  // Add spot lights for additional emphasis
  if (config.addSpot) {
    // Spot from above
    const topSpot = new THREE.SpotLight(
      colors.key,
      0.8 * config.intensity,
      30, // distance
      Math.PI / 6, // angle
      0.5, // penumbra
      1 // decay
    )
    topSpot.position.set(0, 15, 0)
    topSpot.castShadow = true

    // Configure spotlight shadows
    topSpot.shadow.mapSize.width = 1024
    topSpot.shadow.mapSize.height = 1024
    topSpot.shadow.camera.near = 1
    topSpot.shadow.camera.far = 30

    scene.add(topSpot)
    lights.spot.push(topSpot)

    // Accent spot
    const accentSpot = new THREE.SpotLight(
      colors.rim,
      0.7 * config.intensity,
      20,
      Math.PI / 8,
      0.6,
      1.5
    )
    accentSpot.position.set(-7, 4, -7)
    scene.add(accentSpot)
    lights.spot.push(accentSpot)

    // Add helpers if requested
    if (config.addHelpers) {
      const topSpotHelper = new THREE.SpotLightHelper(topSpot)
      const accentSpotHelper = new THREE.SpotLightHelper(accentSpot)

      scene.add(topSpotHelper)
      scene.add(accentSpotHelper)

      lights.helpers.push(topSpotHelper, accentSpotHelper)
    }
  }

  // Return all created lights for further manipulation
  return lights
}

/**
 * Creates a scene with standard grid, axes, and lighting
 *
 * @param scene - The Three.js scene to set up
 * @param lightingOptions - Optional lighting configuration
 * @returns The created lights collection
 */
export function setupStandardScene(
  scene: THREE.Scene,
  lightingOptions: LightingOptions = {}
): LightCollection {
  // Add grid
  const gridHelper = new THREE.GridHelper(10, 10)
  scene.add(gridHelper)

  // Add axes
  const axesHelper = new THREE.AxesHelper(5)
  scene.add(axesHelper)

  // Add lights and return them
  return addSceneLighting(scene, lightingOptions)
}

export enum HDRIs {
  photoStudio1 = _photoStudio1 as any,
  photoStudio2 = _photoStudio2 as any,
  photoStudio3 = _photoStudio3 as any
}

export async function addHDRI({
  scene,
  hdriPath,
  lightingIntensity = 1.0,
  useAsBackground = true,
  backgroundOpacity = 1,
  blurAmount = 0
}: {
  scene: AnimatedScene
  hdriPath: HDRIs | string
  lightingIntensity?: number
  useAsBackground?: boolean
  backgroundOpacity?: number
  blurAmount?: number
}): Promise<void> {
  // Create PMREM Generator for converting equirectangular HDRI to cubemap
  const pmremGenerator: THREE.PMREMGenerator = new THREE.PMREMGenerator(scene.renderer)
  pmremGenerator.compileEquirectangularShader()

  // Load the HDRI using RGBELoader
  const rgbeLoader: RGBELoader = new RGBELoader()

  return new Promise((resolve, reject) => {
    rgbeLoader.setDataType(THREE.FloatType).load(
      hdriPath as any,
      (texture: THREE.DataTexture): void => {
        // Process the HDRI texture
        const envMap: THREE.Texture = pmremGenerator.fromEquirectangular(texture).texture

        if (useAsBackground) {
          // Create background sphere
          const geometry = new THREE.SphereGeometry(400, 32, 32)
          const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }
`

          const fragmentShader = `
varying vec2 vUv;
uniform sampler2D uTexture;
uniform float uBlurAmount;
uniform vec2 uTextureSize;
uniform float sigma; // Missing uniform declaration
uniform float opacity;

// Add these at the top before calculateWeight()
const float PI = 3.141592653589793;


float calculateWeight(float x) {
  return exp(-(x*x) / (2.0*sigma*sigma)) / (sqrt(2.0*PI)*sigma);
}

void main() {
  vec2 texelSize = (1.0 / uTextureSize) * uBlurAmount;
  vec4 totalColor = vec4(0.0);
  


    // Generate weights
    float weights[11];
    float weightSum = 0.0;
    
    // Calculate raw weights
    for(int i = 0; i < 11; i++) {
        float x = float(i - 5);
        weights[i] = calculateWeight(x);
        weightSum += weights[i];
    }
    
    // Normalize 1D weights
    for(int i = 0; i < 11; i++) {
        weights[i] /= weightSum;
    }

  for(int x = -5; x <= 5; x++) {
  for(int y = -5; y <= 5; y++) {
    vec2 offset = vec2(float(x), float(y)) * texelSize;
    float weight = weights[x + 5] * weights[y + 5];
    totalColor += texture2D(uTexture, vUv + offset) * weight;
  }
}

  gl_FragColor = totalColor* opacity;
}
`

          const blurredMaterial = new THREE.ShaderMaterial({
            uniforms: {
              uTexture: { value: texture },
              uBlurAmount: { value: blurAmount }, // Increase for more blur
              uTextureSize: {
                value: new THREE.Vector2(texture.image.width, texture.image.height)
              },
              sigma: { value: 3.0 }, // Add this uniform
              opacity: { value: backgroundOpacity }
            },
            vertexShader,
            fragmentShader,
            side: THREE.BackSide,
            transparent: true
          })
          const backgroundSphere = new THREE.Mesh(geometry, blurredMaterial)
          backgroundSphere.renderOrder = -1 // Render before other objects

          // Attach to camera
          scene.scene.add(backgroundSphere)
        }

        // Apply to scene environment (for reflections)
        scene.scene.environment = envMap

        scene.scene.environmentIntensity = lightingIntensity

        // Clean up resources
        // texture.dispose()
        pmremGenerator.dispose()
        resolve()
      },
      // Optional progress callback
      (xhr: ProgressEvent<EventTarget>): void => {
        // You could implement loading progress here
      },
      // Optional error callback
      (error): void => {
        console.error('Error loading HDRI:', error)
        reject(error)
      }
    )
  })
}
