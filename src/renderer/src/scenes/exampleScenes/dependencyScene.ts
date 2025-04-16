import { setOpacity } from '../../lib/animation/animations'
import { hexColor } from '../../lib/rendering/helpers'
import { addBackgroundGradient, addHDRI, HDRIs } from '../../lib/rendering/lighting3d'
import { createLine } from '../../lib/rendering/objects2d'
import { AnimatedScene } from '../../lib/scene/sceneClass'
import * as THREE from 'three'

export const dependencyScene = (): AnimatedScene => {
  return new AnimatedScene(1080, 1920, true, false, async (scene) => {
    //addSceneLighting(scene.scene)
    await addHDRI({
      scene,
      hdriPath: HDRIs.photoStudio1,
      lightingIntensity: 0.3,
      useAsBackground: true,
      backgroundOpacity: 0.7,
      blurAmount: 3
    })

    addBackgroundGradient({
      scene,
      bottomColor: hexColor('#483924'),
      topColor: hexColor('#aa9775'),
      backgroundOpacity: 0.7
    })

    const numberOfSpheres = 20

    const objects = Array(numberOfSpheres)
      .fill(0)
      .map((o) => {
        const geometry = new THREE.SphereGeometry(0.15, 32, 32)
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

    scene.camera.position.set(30, 0, 0)

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
      scene.camera.position.x = Math.sin(angle) * distance
      scene.camera.position.z = Math.cos(angle) * distance

      // Make camera look at center
      scene.camera.lookAt(centerPoint)
    })

    scene.addWait(20_000)
  })
}
