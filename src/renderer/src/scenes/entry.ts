import { Color } from 'three'
import { createCircle, createFastText, createLine, updateText } from '../lib/rendering/objects2d'
import { AnimatedScene } from '../lib/scene/sceneClass'
import * as THREE from 'three'
import { COLORS } from '../lib/rendering/helpers'
import { createText } from 'three/examples/jsm/Addons.js'
import { placeNextTo } from '../lib/scene/helpers'
import {
  fadeIn,
  fadeInTowardsEnd,
  moveCameraAnimation,
  moveToAnimation,
  setOpacity,
  setScale,
  zoomIn
} from '../lib/animation/animations'
import { easeInOutQuad, posXSigmoid } from '../lib/animation/interpolations'
import { createAnim } from '../lib/animation/protocols'
import { createSimpleFunctionSurface, updateFunctionSurface } from '../lib/rendering/objects3d'
import {
  addBackgroundGradient,
  addHDRI,
  addSceneLighting,
  HDRIs
} from '../lib/rendering/lighting3d'

export const screenFps = 120 //Your screen fps
export const renderSkip = 2 //Will divide your screenFps with this for render output fps
export const animationFPSThrottle = 1 // Use to change preview fps, will divide your fps with this value

export const renderOutputFps = () => screenFps / renderSkip
export const entryScene: () => AnimatedScene = () => threeDimSceneTest()

const white = new THREE.Color(1, 1, 1)
const darkWhite = new THREE.Color(0.2, 0.2, 0.2)

export const connectedSpheresWithLine3D = (): AnimatedScene => {
  return new AnimatedScene(1080, 1920, true, false, async (scene) => {
    //addSceneLighting(scene.scene)
    await addHDRI({
      scene,
      hdriPath: HDRIs.photoStudio3,
      lightingIntensity: 0.3,
      useAsBackground: true,
      backgroundOpacity: 0.7,
      blurAmount: 3
    })

    const numberOfSpheres = 50

    const objects = Array(numberOfSpheres)
      .fill(0)
      .map((o) => {
        const geometry = new THREE.SphereGeometry(0.1, 32, 32)
        const material = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: 0.3,
          metalness: 1
        })

        return {
          sphere: new THREE.Mesh(geometry, material),
          lines: Array(numberOfSpheres - 1)
            .fill(0)
            .map((_) => setOpacity(createLine(), 0.1))
        }
      })

    scene.add(...objects.map((o) => o.sphere), ...objects.flatMap((o) => o.lines))

    scene.camera.position.set(3.889329, 7.895859, 10.51772)
    scene.camera.rotation.set(-0.6027059, 0.3079325, 0.2056132)
    // Initial position and target setup
    const centerPoint = new THREE.Vector3(0, 0, 0)
    const distance = scene.camera.position.distanceTo(centerPoint)
    let angle = 0

    objects.forEach((o) => {
      // Add a velocity property to each object
      o['velocity'] = new THREE.Vector3(0, 0, 0)
    })

    scene.onEachTick((tick) => {
      objects.forEach((o) => {
        // Generate small random acceleration
        const randomAcceleration = new THREE.Vector3(
          (Math.random() - 0.5) * 0.05, // smaller values for smoother changes
          (Math.random() - 0.5) * 0.05,
          (Math.random() - 0.5) * 0.05
        )

        // Apply the acceleration to the current velocity (with damping)
        o['velocity'].add(randomAcceleration)

        // Dampen the velocity (important for stability)
        const damping = 0.95 // 0.95 means keep 95% of velocity each frame
        o['velocity'].multiplyScalar(damping)

        // Apply velocity to position
        o.sphere.position.add(o['velocity'])

        // Optional: Add boundaries to keep objects in view
        const boundaryRadius = 10
        if (o.sphere.position.length() > boundaryRadius) {
          // If object is too far from center, gently pull it back
          const pullToCenter = o.sphere.position.clone().negate().normalize().multiplyScalar(0.02)
          o['velocity'].add(pullToCenter)
        }
      })

      // Add dependency so that each circle is connected to the one before it with the line.
      objects.forEach((o, index) => {
        o.lines.forEach((l, index) => {
          // l.geometry.setFromPoints([o.circle.position, elements[index].circle.position])
          l.updatePositions(o.sphere.position, objects[index].sphere.position)
        })
      })

      angle += 0.01

      // Set camera position in circular orbit
      scene.camera.position.x = (Math.sin(angle) * distance * (Math.sin(tick / 50) + 2)) / 2
      scene.camera.position.z = (Math.cos(angle) * distance * (Math.sin(tick / 50) + 2)) / 2

      // Make camera look at center
      scene.camera.lookAt(centerPoint)
    })

    scene.addWait(10_000)
  })
}

const sineTimeFunction = (time: number): ((a: number, b: number) => number) => {
  return (a: number, b: number) =>
    (5 * (Math.sin(a * 2 + time) * Math.cos(b * 2 + time))) /
      (Math.pow(Math.abs(a) + Math.abs(b), 2) + 5) +
    3
}

export const threeDimSceneTest = (): AnimatedScene => {
  return new AnimatedScene(1080, 1080, true, false, async (scene) => {
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

    const sineSurface = createSimpleFunctionSurface(sineTimeFunction(0), ...funcMinMaxes)
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

    scene.addWait(20_000)
  })
}

export const thirdScene = (): AnimatedScene => {
  return new AnimatedScene(1000, 1000, false, undefined, async (scene) => {
    const circles = Array(2)
      .fill(0)
      .map((_) => createCircle(2))

    const distanceText = await createFastText('HEJ', 2)

    circles[1].position.x = -10

    circles.forEach((c) => scene.add(c))
    scene.add(distanceText)

    const anim = moveToAnimation(circles[0], circles[1].position)

    scene.onEachTick(async (_) => {
      let value = circles[1].position.x - circles[0].position.x
      circles[1].material.color.r = posXSigmoid(0.1 * value)
      await updateText(distanceText, (Math.round(value * 100) / 100).toString())
      placeNextTo(distanceText, circles[0], 'Y')
    })

    scene.addAnim(anim)
    scene.addAnim(anim.copy().scaleLength(1.2).reverse())
  })
}

/*
function pointer<T>(initialValue: T): {
  get: () => T
  set: (newValue: T) => void
  value: T
} {
  const ref = {
    value: initialValue,
    get: () => ref.value,
    set: (newValue: T) => {
      ref.value = newValue
    }
  }
  return ref
}

export const testPointerScene = (): AnimatedScene => {
  return new AnimatedScene(1000, 1000, false, async (scene) => {
    const yValueP = pointer(0)

    for (let i = 0; i < 10; i++) {}
  })
}

export const interpolateCircleScene = (): AnimatedScene => {
  return new AnimatedScene(1000, 1000, false, async (scene) => {
    const circle = createCircle(50)

    scene.add(circle)
    scene.onEachTick(() => {
      ;(circle.material as any).color = new THREE.Color().setHSL(
        posXSigmoid(circle.position.x / 400),
        1,
        0.5
      )
    })

    const anim = createAnim(easeInOutQuad(-50, 50, 500), (value) => (circle.position.x = value))
    scene.addAnim(anim)
    scene.addAnim(anim.copy().reverse())
  })
}
*/
