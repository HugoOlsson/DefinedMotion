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
import { addSceneLighting } from '../lib/rendering/lighting3d'

export const fps = 120
export const animationFPSThrottle = 1

export const entryScene: () => AnimatedScene = () => threeDimSceneTest()

const white = new THREE.Color(1, 1, 1)
const darkWhite = new THREE.Color(0.2, 0.2, 0.2)

export const manyDependenciesScene = (): AnimatedScene => {
  return new AnimatedScene(1000, 1000, false, undefined, async (scene) => {
    console.log('RUNS FROM BEGINING')

    const num = 20
    const elements = Array(num)
      .fill(0)
      .map(() => ({
        circle: createCircle(1, {
          color: darkWhite,
          stroke: { color: white, width: 0.15 }
        }),
        lines: Array(num - 1)
          .fill(0)
          .map((_) => createLine({ width: 0.15 }))
      }))

    // Insert instruction to add the elements to scene
    scene.do(() => {
      elements.forEach((e) => {
        scene.add(e.circle, ...e.lines)
      })
    })

    scene.onEachTick((tick) => {
      // for every tick (frame), change the position with a random velocity vector to create random movement
      elements.forEach((o) => {
        const randomVelocity = new THREE.Vector3(
          (Math.random() - 0.5) * 1, // x: -1 to 1
          (Math.random() - 0.5) * 1, // y: -1 to 1
          (Math.random() - 0.5) * 1 // z: -1 to 1
        )

        o.circle.position.add(randomVelocity)
      })

      // Add dependency so that each circle is connected to the one before it with the line.
      elements.forEach((o, index) => {
        o.lines.forEach((l, index) => {
          // l.geometry.setFromPoints([o.circle.position, elements[index].circle.position])
          l.updatePositions(o.circle.position, elements[index].circle.position)
        })
      })
    })

    //Make animation roll (so the dependency can tick for every frame and create movement)
    scene.addWait(5000)
  })
}

const sineTimeFunction = (time: number): ((a: number, b: number) => number) => {
  return (a: number, b: number) => Math.sin(a + time) * Math.cos(b + time) + 3
}

export const threeDimSceneTest = (): AnimatedScene => {
  return new AnimatedScene(2000, 2000, true, false, async (scene) => {
    const funcMinMaxes: [number, number, number, number] = [-7, 7, -7, 7]
    addSceneLighting(scene.scene)
    const gridHelper = new THREE.GridHelper(20, 20)

    const axesHelper = new THREE.AxesHelper(20)

    const sineSurface = createSimpleFunctionSurface(sineTimeFunction(0), ...funcMinMaxes)
    sineSurface.material = new THREE.MeshStandardMaterial({
      color: 0x049ef4,
      metalness: 0.5,
      roughness: 0.2,
      side: THREE.DoubleSide
    }) as any

    const geometry = new THREE.SphereGeometry(0.3, 32, 32)
    const material = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: 0xff0000,
      emissiveIntensity: 200.0
    })

    const sphere = new THREE.Mesh(geometry, material)
    const pointLight = new THREE.PointLight(0xff0000, 1000, 100) // color, intensity, distance
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
      const func = sineTimeFunction(tick / 100)
      updateFunctionSurface(sineSurface, func, ...funcMinMaxes)

      group.position.y = func(0, 0) + 2
      /*
      // Increment angle
      angle += 0.005

      // Set camera position in circular orbit
      scene.camera.position.x = (Math.sin(angle) * distance * (Math.sin(tick / 50) + 2)) / 2
      scene.camera.position.z = (Math.cos(angle) * distance * (Math.sin(tick / 50) + 2)) / 2

      */
      // Make camera look at center
      scene.camera.lookAt(centerPoint)
    })

    scene.addWait(10_000)
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
