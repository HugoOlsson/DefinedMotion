import { wait } from 'definedmotion/animation'
import * as THREE from 'three'
import { AnimatedScene, Axis, SpaceSetting, defineScene } from 'definedmotion'
import { createText, createRectangle } from 'definedmotion/rendering'

export default defineScene({
  id: 'test-product-layout-positioning',
  name: 'Positioning: 3D Product Layout',
  isTest: true,
  create: productLayoutPositioningScene
})

export function productLayoutPositioningScene(): AnimatedScene {
  return new AnimatedScene(
    1200,
    800,
    SpaceSetting.ThreeDim,
    async (scene) => {
      scene.scene.background = new THREE.Color('#080d18')

      const product = new THREE.Group()
      product.name = 'product-model'
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(5.2, 8.4, 1.8),
        new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.3, metalness: 0.65 })
      )
      const screen = createRectangle(4.45, 7.5, { color: '#102a43' })
      screen.position.z = 0.92
      const screenGlow = createRectangle(3.7, 5.8, { color: '#0ea5e9' })
      screenGlow.position.z = 0.94
      const cameraLens = new THREE.Mesh(
        new THREE.CircleGeometry(0.24, 24),
        new THREE.MeshBasicMaterial({ color: '#111827' })
      )
      cameraLens.position.set(0, 3.55, 0.96)
      product.add(body, screen, screenGlow, cameraLens)

      const productName = await createText({ text: 'Defined Phone', fontSize: 1.55, color: 0xf8fafc })
      productName.name = 'product-name'

      const specPanel = new THREE.Group()
      specPanel.name = 'spec-panel'
      const panelBackground = createRectangle(7.4, 5.4, {
        color: '#142033',
        stroke: { color: '#2f4664', width: 0.16, placement: 'inside' }
      })
      panelBackground.position.z = -0.1
      const specTitle = await createText({ text: 'Highlights', fontSize: 1.15, color: 0xe2e8f0 })
      specTitle.position.set(0, 1.55, 0)
      const specOne = await createText({ text: '120 Hz display', fontSize: 0.82, color: 0x7dd3fc })
      specOne.position.set(0, 0.2, 0)
      const specTwo = await createText({ text: '48 MP camera', fontSize: 0.82, color: 0xc4b5fd })
      specTwo.position.set(0, -1.1, 0)
      specPanel.add(panelBackground, specTitle, specOne, specTwo)

      const price = await createText({ text: '9 995 SEK', fontSize: 1.25, color: 0x86efac })
      price.name = 'product-price'

      const depthBadge = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 1.2, 0.45),
        new THREE.MeshBasicMaterial({ color: '#f59e0b' })
      )
      depthBadge.name = 'depth-badge'

      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(34, 24),
        new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.85, metalness: 0.05 })
      )
      floor.rotation.x = -Math.PI / 2
      floor.position.y = -6.5

      const keyLight = new THREE.DirectionalLight('#c7d2fe', 3.2)
      keyLight.position.set(8, 12, 14)
      const fillLight = new THREE.DirectionalLight('#38bdf8', 1.2)
      fillLight.position.set(-10, 4, 8)
      const ambientLight = new THREE.AmbientLight('#94a3b8', 0.7)

      scene.add(
        product,
        productName,
        specPanel,
        price,
        depthBadge,
        floor,
        keyLight,
        fillLight,
        ambientLight
      )
      scene.expose('product-model', product)
      scene.expose('product-name', productName)
      scene.expose('spec-panel', specPanel)
      scene.expose('product-price', price)
      scene.expose('depth-badge', depthBadge)

      const positioning = scene.positioning()
      positioning
        .place(productName)
        .above(product, { gap: { initial: 1.6, range: [1.1, 2.1] } })
        .centerWith(product, { axis: Axis.X })
        .centerWith(product, { axis: Axis.Z })
      positioning
        .place(specPanel)
        .rightOf(product, { gap: 2 })
        .centerWith(product, { axis: Axis.Y })
        .centerWith(product, { axis: Axis.Z })
      positioning
        .place(price)
        .below(specPanel, { gap: 1.1 })
        .centerWith(specPanel, { axis: Axis.X })
        .centerWith(specPanel, { axis: Axis.Z })
      positioning
        .place(depthBadge)
        .positiveZOf(product, { gap: 1 })
        .centerWith(product, { axis: Axis.X })
        .centerWith(product, { axis: Axis.Y })

      scene.onEachTick((tick) => {
        product.rotation.y = Math.sin(tick * 0.018) * 0.42
        product.rotation.x = Math.sin(tick * 0.013) * 0.08
        product.position.y = Math.sin(tick * 0.025) * 0.65
        screenGlow.scale.y = 0.9 + Math.sin(tick * 0.04) * 0.1
      })

      scene.camera.position.set(4, 4, 26)
      scene.camera.lookAt(1, 0, 0)
      scene.addAnims(wait((5_000) / 1000))
    }
  )
}
