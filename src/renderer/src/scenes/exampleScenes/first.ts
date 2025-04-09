import { Color } from 'three'
import { createCircle, createFastText, createLine, updateText } from '../../lib/rendering/objects2d'
import { AnimatedScene } from '../../lib/scene/sceneClass'
import * as THREE from 'three'
import { COLORS } from '../../lib/rendering/helpers'
import { createText } from 'three/examples/jsm/Addons.js'
import { placeNextTo } from '../../lib/scene/helpers'
import {
  fadeIn,
  fadeInTowardsEnd,
  moveCameraAnimation,
  moveToAnimation,
  setOpacity,
  setScale,
  zoomIn
} from '../../lib/animation/animations'
import { easeInOutQuad, posXSigmoid } from '../../lib/animation/interpolations'
import { createAnim } from '../../lib/animation/protocols'

const white = new THREE.Color(1, 1, 1)
const darkWhite = new THREE.Color(0.2, 0.2, 0.2)

export const interpolateCircleScene = (): AnimatedScene => {
  return new AnimatedScene(1000, 1000, false, undefined, async (scene) => {
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

export const manyDependenciesScene = (): AnimatedScene => {
  return new AnimatedScene(1000, 1000, false, undefined, async (scene) => {
    const num = 2
    const elements = Array(num)
      .fill(0)
      .map(() => ({
        circle: createCircle(1, {
          color: darkWhite,
          stroke: { color: white, width: 0.15 }
        }),
        lines: Array(num - 1)
          .fill(0)
          .map((_) => createLine({ width: 0.15, padding: 0 }))
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
          (Math.random() - 0.5) * 2, // x: -1 to 1
          (Math.random() - 0.5) * 2, // y: -1 to 1
          (Math.random() - 0.5) * 2 // z: -1 to 1
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

export const thirdScene = (): AnimatedScene => {
  return new AnimatedScene(1000, 1000, false, undefined, async (scene) => {
    const circles = Array(2)
      .fill(0)
      .map((_) => createCircle(10))

    const distanceText = await createFastText('HEJ', 20)

    circles[1].position.x = -40

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
    scene.addAnim(anim.copy().scaleLength(1.2).reverse().addNoise())
  })
}

export const myScene = (): AnimatedScene => {
  return new AnimatedScene(1080, 1920, false, undefined, (scene) => {
    let currentY = 0
    const spacing = 100

    for (let i = 0; i < 10; i++) {
      buildGroup(scene, currentY)
      currentY += spacing
    }
  })
}

const buildGroup = (scene: AnimatedScene, currentY: number) => {
  const itemGroup = new THREE.Group()
  itemGroup.position.set(0, currentY, 0)

  const circle = setOpacity(
    createCircle(10, {
      color: new THREE.Color(0.2, 0.2, 0.2),
      stroke: {
        color: COLORS.white,
        width: 0.8,
        placement: 'inside'
      }
    }),
    0
  )

  circle.scale.set(0.8, 0.8, 0.8)

  const text = setOpacity(createText('Name to Show', 4), 0)

  scene.do(() => {
    scene.add(itemGroup)
    itemGroup.add(circle)
    itemGroup.add(text)
  })

  const circlesAround = Array(7)
    .fill(0)
    .map((_) => {
      return {
        circle: createCircle(6, {
          color: new THREE.Color(0.2, 0.2, 0.2),
          stroke: {
            color: COLORS.white,
            width: 0.4,
            placement: 'inside'
          }
        }),
        text: createText('Name to Show', 3),
        line: createLine({ width: 0.5, color: new THREE.Color(0.1, 0.1, 0.1) })
      }
    })

  const radius = 40

  circlesAround.forEach((o) => setOpacity(o.circle, 0))
  circlesAround.forEach((o) => setOpacity(o.text, 0))

  const positions = circlesAround.map((_, index) => {
    // Calculate position on a circle
    const angle = (index / circlesAround.length) * Math.PI * 2
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius

    return new THREE.Vector3(x, y + circle.position.y, 0)
  })

  scene.do(() => {
    itemGroup.add(circle)
    placeNextTo(text, circle, 'Y', 5)
    itemGroup.add(text)
    circlesAround.map((o) => {
      itemGroup.add(o.circle)
      itemGroup.add(o.text)
      itemGroup.add(o.line)
    })

    console.log(positions)
  })

  scene.onEachTick(() => {
    circlesAround.map((o) => {
      o.line.updatePositions(o.circle.position, circle.position, 5)
    })
  })

  scene.addAnim(moveCameraAnimation(scene.camera, itemGroup.position.clone()))
  scene.addAnim(fadeIn(circle, 300), zoomIn(circle, 300))
  scene.addAnim(fadeIn(text, 300), zoomIn(text, 300))
  circlesAround.forEach((o, index) => {
    const textPos = positions[index].clone().add(new THREE.Vector3(0, 6, 0))
    scene.addAnim(
      moveToAnimation(o.circle, positions[index], 200),
      fadeInTowardsEnd(o.circle, 300),
      zoomIn(o.circle, 300, 0.5),
      moveToAnimation(o.text, textPos, 200),
      fadeInTowardsEnd(o.text, 300),
      zoomIn(o.text, 300, 1)
    )
  })
}
