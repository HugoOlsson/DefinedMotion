import * as THREE from 'three'

import { defineScene } from 'definedmotion'
import { easeLinear } from 'definedmotion/animation'
import { createAnim } from 'definedmotion/animation'
import { addHDRI, HDRIs, loadHDRIData } from 'definedmotion/rendering'
import { loadGLB } from 'definedmotion/rendering'
import { createVideoPlane } from 'definedmotion/media'
import { AnimatedScene, HotReloadSetting, SpaceSetting } from 'definedmotion'

const DURATION_MS = 11_325
const SCREEN_WIDTH = 15.55
const SCREEN_HEIGHT = 33.8
const SCREEN_FRONT_Z = -0.9

export default defineScene({
  id: 'test-iphone-screen-recording',
  name: 'iPhone Screen Recording',
  isTest: true,
  create: createIphoneScreenRecordingScene
})

function createIphoneScreenRecordingScene(): AnimatedScene {
  return new AnimatedScene(
    1080,
    1920,
    SpaceSetting.ThreeDim,
    HotReloadSetting.TraceFromStart,
    async (scene) => {
      scene.renderer.setClearColor(0x202738)
      scene.renderer.shadowMap.enabled = true
      scene.renderer.toneMappingExposure = 1.15

      const phoneModel = await loadGLB(scene.asset('models/iphone_14_pro.glb'))
      // The Sketchfab export contains a 0.01 import scale in its internal node
      // hierarchy. Restore the model to the coordinate size of its mesh data,
      // while keeping the independently authored screen surface unscaled.
      // Correct the export's slightly wide/short silhouette while restoring
      // its import scale. Depth stays unchanged so the glass alignment holds.
      phoneModel.scale.set(200, 203, 180)
      enhancePhoneMaterials(phoneModel)

      const phone = scene.expose('iphone', new THREE.Group(), {
        description: 'The iPhone model carrying the synchronized screen recording',
        tags: ['phone', 'model', 'primary-subject']
      })
      phone.add(
        scene.expose('phone-body', phoneModel, {
          description: 'The scaled metallic GLB body beneath the custom screen surface',
          tags: ['phone', 'model', 'chassis']
        })
      )

      // The source model faces local -Z. Turning the model around presents its
      // display to the default +Z audience camera.
      phone.rotation.y = Math.PI

      const screen = scene.expose(
        'screen-recording',
        createVideoPlane(
          scene,
          scene.asset('video/ScreenRecording_07-12-2026 20-12-04_1.MP4'),
          {
            id: 'iphone-screen-recording',
            width: SCREEN_WIDTH,
            height: SCREEN_HEIGHT,
            fit: 'cover'
          }
        ),
        {
          description: 'Timeline-synchronized recording fitted over the phone display',
          tags: ['video', 'screen', 'dynamic']
        }
      )
      screen.name = 'iphone-screen-recording'
      screen.position.set(0, 0, SCREEN_FRONT_Z)
      screen.rotation.y = Math.PI
      screen.material.alphaMap = createRoundedScreenMask()
      screen.material.alphaTest = 0.5
      screen.material.depthWrite = false
      screen.renderOrder = 1

      const island = scene.expose('dynamic-island', createDynamicIsland(), {
        description: 'A clean black overlay that covers the recording indicator in the source video',
        tags: ['screen', 'overlay', 'dynamic-island']
      })
      island.position.set(0, SCREEN_HEIGHT / 2 - 1.25, 0.015)
      island.renderOrder = 2
      screen.add(island)
      phone.add(screen)
      scene.add(phone)

      const studioEnvironment = await loadHDRIData(HDRIs.photoStudio1, 3)
      await addHDRI(scene, studioEnvironment, 3.5, 0.4)
      addStudioLighting(scene.scene)

      const camera = scene.camera as THREE.PerspectiveCamera
      camera.fov = 30
      camera.near = 0.1
      camera.far = 500
      camera.position.set(0, 0, 70)
      camera.lookAt(0, 0, 0)
      camera.updateProjectionMatrix()

      const detailCamera = scene.exposeCamera(
        'screen-detail',
        new THREE.PerspectiveCamera(24, scene.width / scene.height, 0.1, 500),
        {
          description: 'Close frontal view for checking the screen mask and Dynamic Island',
          tags: ['detail', 'screen']
        }
      )
      detailCamera.position.set(0, 11.5, 52)
      detailCamera.lookAt(0, 11.5, 0)

      const sideCamera = scene.exposeCamera(
        'three-quarter',
        new THREE.PerspectiveCamera(34, scene.width / scene.height, 0.1, 500),
        {
          description: 'Three-quarter view for checking that the video sits on the phone surface',
          tags: ['overview', 'geometry']
        }
      )
      sideCamera.position.set(32, 2, 62)
      sideCamera.lookAt(0, 0, 0)

      const rearCamera = scene.exposeCamera(
        'rear-three-quarter',
        new THREE.PerspectiveCamera(34, scene.width / scene.height, 0.1, 500),
        {
          description: 'Rear view for checking chassis depth and transparent-surface artifacts',
          tags: ['rear', 'geometry', 'material-check']
        }
      )
      rearCamera.position.set(32, 2, -62)
      rearCamera.lookAt(0, 0, 0)

      const orbit = createAnim(easeLinear(0, 1, DURATION_MS), (progress) => {
        phone.rotation.y = Math.PI + Math.sin(progress * Math.PI * 2) * 0.32
        phone.rotation.z = Math.sin(progress * Math.PI * 2) * 0.025
      })

      scene.addAnims(await screen.playWithAudio(), orbit)
    }
  )
}

function createRoundedScreenMask(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 1024

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not create the iPhone screen mask')

  const radius =70
  context.fillStyle = '#ffffff'
  context.beginPath()
  context.roundRect(0, 0, canvas.width, canvas.height, radius)
  context.fill()

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.NoColorSpace
  texture.needsUpdate = true
  return texture
}

function createDynamicIsland(): THREE.Mesh<THREE.ShapeGeometry, THREE.MeshBasicMaterial> {
  const width = 6.95
  const height = 1.42
  const radius = height / 2
  const shape = new THREE.Shape()

  shape.moveTo(-width / 2 + radius, -height / 2)
  shape.lineTo(width / 2 - radius, -height / 2)
  shape.absarc(width / 2 - radius, 0, radius, -Math.PI / 2, Math.PI / 2, false)
  shape.lineTo(-width / 2 + radius, height / 2)
  shape.absarc(-width / 2 + radius, 0, radius, Math.PI / 2, (Math.PI * 3) / 2, false)

  return new THREE.Mesh(
    new THREE.ShapeGeometry(shape, 32),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      toneMapped: false,
      transparent: true,
      depthTest: false,
      depthWrite: false
    })
  )
}

function addStudioLighting(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight(0xffffff, 0x35405c, 4))

  const key = new THREE.DirectionalLight(0xffffff, 8)
  key.position.set(-12, 18, 24)
  scene.add(key)

  const fill = new THREE.DirectionalLight(0xbfd5ff, 5)
  fill.position.set(16, -4, 18)
  scene.add(fill)

  const rim = new THREE.DirectionalLight(0x9bb7ff, 12)
  rim.position.set(18, 4, -18)
  scene.add(rim)
}

function enhancePhoneMaterials(phone: THREE.Object3D): void {
  phone.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return

    const materials = Array.isArray(child.material) ? child.material : [child.material]
    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue
      material.envMapIntensity = 3.5
      material.transparent = false
      material.opacity = 1
      material.depthWrite = true
      material.side = THREE.FrontSide
      material.needsUpdate = true
    }
  })
}
