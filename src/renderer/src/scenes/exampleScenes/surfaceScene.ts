import { COLORS } from '../../lib/rendering/helpers'
import { addBackgroundGradient } from '../../lib/rendering/lighting3d'
import { createFunctionSurface, updateFunctionSurface } from '../../lib/rendering/objects3d'
import { AnimatedScene } from '../../lib/scene/sceneClass'
import * as THREE from 'three'

const sineTimeFunction = (time: number): ((a: number, b: number) => number) => {
  return (a: number, b: number) =>
    (5 * (Math.sin(a * 2 + time) * Math.cos(b * 2 + time))) /
      (Math.pow(Math.abs(a) + Math.abs(b), 2) + 5) +
    3
}

export const surfaceScene = (): AnimatedScene => {
  return new AnimatedScene(1500, 1500, true, false, async (scene) => {
    const funcMinMaxes: [number, number, number, number] = [-7, 7, -7, 7]
    //addSceneLighting(scene.scene)

    addBackgroundGradient({
      scene,
      topColor: COLORS.blue,
      bottomColor: COLORS.black,
      lightingIntensity: 10
    })
    /*await addHDRI({
        scene,
        hdriPath: HDRIs.photoStudio3,
        lightingIntensity: 0.5,
        useAsBackground: true,
        backgroundOpacity: 1,
        blurAmount: 2
      })*/

    const gridHelper = new THREE.GridHelper(20, 20)

    const axesHelper = new THREE.AxesHelper(20)

    const sineSurface = createFunctionSurface(sineTimeFunction(0), ...funcMinMaxes)
    sineSurface.material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.8,
      roughness: 0.1,
      side: THREE.DoubleSide
    }) as any

    const geometry = new THREE.SphereGeometry(0.3, 32, 32)
    const material = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: 0xffffff,
      emissiveIntensity: 200.0
    })

    const sphere = new THREE.Mesh(geometry, material)
    const pointLight = new THREE.PointLight(0xffffff, 50) // color, intensity, distance
    pointLight.position.copy(sphere.position)
    const group = new THREE.Group()
    group.add(sphere, pointLight)

    scene.add(gridHelper, axesHelper, sineSurface, group)

    scene.camera.position.set(3.889329, 7.895859, 10.51772)
    scene.camera.rotation.set(-0.6027059, 0.3079325, 0.2056132)
    // Initial position and target setup
    const centerPoint = new THREE.Vector3(0, 0, 0)
    const distance = scene.camera.position.distanceTo(centerPoint)
    let angle = 0

    scene.onEachTick((tick) => {
      const func = sineTimeFunction(tick / 20)
      updateFunctionSurface(sineSurface, func, ...funcMinMaxes)

      group.position.y = 6 //func(0, 0)

      angle += 0.005

      // Set camera position in circular orbit
      scene.camera.position.x = (Math.sin(angle) * distance * (Math.sin(tick / 50) + 2)) / 2
      scene.camera.position.z = (Math.cos(angle) * distance * (Math.sin(tick / 50) + 2)) / 2

      // Make camera look at center
      scene.camera.lookAt(centerPoint)
    })

    scene.addWait(10_000)
  })
}
