import { setOpacity } from '../../lib/animation/animations'
import { linspace } from '../../lib/mathHelpers/vectors'
import { COLORS } from '../../lib/rendering/helpers'
import {
  addBackgroundGradient,
  addHDRI,
  addSceneLighting,
  HDRIs
} from '../../lib/rendering/lighting3d'
import { createFastText } from '../../lib/rendering/objects2d'
import { AnimatedScene } from '../../lib/scene/sceneClass'
import * as THREE from 'three'

// 1. Define a Vector3 type
export interface Vector3 {
  x: number
  y: number
  z: number
}

// 2. Define a type alias for any 3D vector field: a function that
//    takes a point (x, y, z) and returns a vector at that point.
export type VectorField3D = (x: number, y: number, z: number, time: number) => Vector3

// 3. Example: a simple swirling field around the z‑axis
export const field: VectorField3D = (x, y, z, time) => {
  const scale = 10
  const target = new THREE.Vector3(
    Math.sin(time),
    Math.cos(time),
    Math.sin(time) * Math.cos(time)
  ).multiplyScalar(scale) // the center point to attract objects to
  const position = new THREE.Vector3(x, y, z)
  const direction = target.sub(position).normalize() // calculate the direction towards the target
  const strength = 0.1 // adjust the strength of the attraction

  return {
    x: direction.x * strength,
    y: direction.y * strength,
    z: direction.z * strength
  }
}

export const vectorFieldScene = (): AnimatedScene => {
  return new AnimatedScene(1080, 2160, true, false, async (scene) => {
    addSceneLighting(scene.scene)
    await addHDRI({ scene, hdriPath: HDRIs.outdoor1, useAsBackground: true, blurAmount: 2 })
    addBackgroundGradient({
      scene,
      topColor: '#00639d',
      bottomColor: COLORS.black,
      backgroundOpacity: 0.5
    })
    const max = 30
    const xs = linspace(-max, max, 8)
    const ys = [...xs]
    const zs = [...xs]

    const length = 2 // arrow length units
    const color = 0xffffff // red

    const arrows: (THREE.ArrowHelper | null)[][][] = Array.from({ length: xs.length }, () =>
      Array.from({ length: ys.length }, () => Array.from({ length: zs.length }, () => null))
    )

    for (let i = 0; i < xs.length; i++) {
      for (let j = 0; j < ys.length; j++) {
        for (let k = 0; k < zs.length; k++) {
          const x = xs[i],
            y = ys[j],
            z = zs[k]
          const value = field(x, y, z, 0)
          // 1. define direction, origin, length and color
          const dir = new THREE.Vector3(value.x, value.y, value.z).normalize() // arrow points along +X
          const origin = new THREE.Vector3(x, y, z) // from world‑origin

          // 2. create helper
          const arrowHelper = new THREE.ArrowHelper(dir, origin, length, color, 6, 1)

          // remove the low‑res cone
          arrowHelper.cone.geometry.dispose()

          // create a new high‑res cone: (radiusTop, height, radialSegments, heightSegments)
          const highResSegments = 32
          const highResConeGeo = new THREE.ConeGeometry(0.15, 1, highResSegments, 1)

          arrowHelper.cone.geometry = highResConeGeo

          const coneMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            metalness: 0.5,
            roughness: 0.7,
            transparent: true
          })

          const lineMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            metalness: 0.5,
            roughness: 0.7,
            transparent: true
          })

          arrowHelper.line.material = lineMaterial
          arrowHelper.cone.material = coneMaterial

          arrowHelper.cone.castShadow

          arrows[i][j][k] = arrowHelper
          setOpacity(
            arrows[i][j][k] as any,
            1 - Math.pow(x * x + y * y + z * z, 2) / Math.pow(max * max * 3, 1.95)
          )

          // 3. add to scene
          scene.add(arrowHelper)
        }
      }
    }

    const textNode = await createFastText('Vector Field', 5)
    textNode.position.y = max * 1.5
    scene.add(textNode)

    // const axesHelper = new THREE.AxesHelper(20)
    // scene.add(axesHelper)

    scene.camera.position.set(-116.443, 35.10142, 68.73468)
    scene.camera.quaternion.set(-0.109989, -0.491824, -0.06279674, 0.8614338)

    const geometry = new THREE.SphereGeometry(0.3, 32, 32)
    const material = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: 0xffffff,
      emissiveIntensity: 200.0
    })

    interface GroupData {
      group: THREE.Group
      acceleration: THREE.Vector3
      velocity: THREE.Vector3
    }

    const groups: GroupData[] = []

    Array(100)
      .fill(0)
      .forEach(() => {
        const sphere = new THREE.Mesh(geometry, material)
        const pointLight = new THREE.PointLight(0xffffff, 2000) // color, intensity, distance
        pointLight.position.copy(sphere.position)
        const group = new THREE.Group()
        group.add(sphere, pointLight)

        group.position.y = 8 * (Math.random() - 0.5)
        group.position.z = 8 * (Math.random() - 0.5)

        let velocity = new THREE.Vector3(0, 0, 0) // Initial velocity
        let acceleration = new THREE.Vector3(0, 0, 0) // Initialize acceleration

        groups.push({
          group,
          acceleration,
          velocity
        })

        scene.add(group)
      })

    scene.onEachTick((tick, time) => {
      textNode.lookAt(scene.camera.position)
      const editedTime = time / 200

      for (const groupData of groups) {
        const fieldValue = field(
          groupData.group.position.x,
          groupData.group.position.y,
          groupData.group.position.z,
          editedTime
        )
        groupData.acceleration.set(fieldValue.x, fieldValue.y, fieldValue.z)

        // Update velocity with acceleration (basic kinematic equation)
        groupData.velocity.add(groupData.acceleration.clone().multiplyScalar(1)) // Adjust time factor for smoothness

        // Update position of point light based on velocity
        groupData.group.position.add(groupData.velocity)
      }

      for (let i = 0; i < xs.length; i++) {
        for (let j = 0; j < ys.length; j++) {
          for (let k = 0; k < zs.length; k++) {
            const x = xs[i],
              y = ys[j],
              z = zs[k]
            const v = field(x, y, z, editedTime)
            const dir = new THREE.Vector3(v.x, v.y, v.z).normalize()
            arrows[i][j][k]?.setDirection(dir)
          }
        }
      }
    })

    scene.addWait(20000)
  })
}
