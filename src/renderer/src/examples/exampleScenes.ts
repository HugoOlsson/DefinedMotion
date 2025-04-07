import * as THREE from 'three'

import {
  createCircle,
  createMeshText,
  createFastText,
  updateText,
  createLine,
  createRectangle
} from '../lib/rendering/objects2d'
import { fadeIn, fadeOut, moveTo, zoomIn, zoomOut } from '../lib/animation/animations'
import { concatInterpols, easeInOutQuad, posXSigmoid } from '../lib/animation/interpolations'
import { AnimatedScene } from '../lib/scene/sceneClass'
import { createAnim, UserAnimation } from '../lib/animation/protocols'
import { placeNextTo } from '../lib/scene/helpers'
import { createText } from 'three/examples/jsm/Addons.js'
import { COLORS } from '../lib/rendering/helpers'

/*
export const firstScene = (): AnimatedScene => {
  const scene = new AnimatedScene(1920, 1080, false)
  const build = () => {
    const squares = new Array(100).fill(0).map((_) =>
      createSquare(Math.random() * 10, {
        color: new THREE.Color(Math.random(), Math.random(), Math.random())
      })
    )
    const circle = createCircle(20)
    const text = createMeshText('Hello TikTok', 10)

    squares.forEach((square) => {
      square.position.y = 0 //(Math.random() - 0.5) * 200
    })

    scene.addInstruction((tick) => {
      scene.add(text)
    })

    //Premade animations, since in parallel, they can be combined on an object
    scene.addAnimations(fadeIn(text), zoomIn(text))

    // Adding instructions in a function to support hot reload to a certain frame in the display
    scene.addInstruction((tick) => {
      squares.forEach((square) => scene.add(square))
      scene.add(circle)
    })

    // Will make sure this makes the element updated relative to others for every frame
    scene.addDependency((tick) => {
      circle.position.copy(squares[5].position)
      text.position.copy(squares[5].position)
      text.rotation.copy(squares[5].rotation)
    })

    // Parallel animations
    scene.addAnimations(
      {
        interpolation: easeInOutQuad(-100, 100, 2000),
        updater: (value, sceneTick) => {
          squares.forEach((square, index) => {
            square.position.x = value
            let scale = Math.pow(Math.abs(value / 100), 2) + 1
            square.scale.set(scale, scale, scale)
            square.rotation.z = (value / 100) * Math.PI
          })
        }
      },
      {
        //Interpolations can be added for summed movements
        interpolation: concatInterpols(easeInOutQuad(1, 3, 1000), easeInOutQuad(3, 1, 1000)),
        updater: (value, _) => {
          circle.scale.set(value, value, value)
          // @ts-ignore
          circle.material.color.set(new THREE.Color(0.2, 0.2, value / 3))
        }
      },
      ...squares.map((square) => fadeIn(square)).concat(fadeIn(circle))
    )

    scene.addAnimations({
      interpolation: easeInOutQuad(100, -100, 2000),
      updater: (value, sceneTick) => {
        squares.forEach((square) => {
          square.position.x = value
          let scale = Math.pow(Math.abs(value / 100), 2) + 1
          square.scale.set(scale, scale, scale)
          square.rotation.z = (value / 100) * Math.PI
        })
      }
    })
    scene.end()
  }
  scene.addSceneConstructor(build)
  return scene
} */
/*
export const secondScene = (): AnimatedScene => {
  const texts = Array(50)
    .fill(0)
    .map((t, index) => createMeshText(index.toString(), 20))

  const pivot = new THREE.Object3D()

  const scene = new AnimatedScene(1920, 1080, false, async () => {
    scene.addInstruction(() => {
      texts.forEach((t) => (t.position.y = (Math.random() - 0.5) * 200))
      texts.forEach((t) => pivot.add(t))
      scene.add(pivot)
    })

    scene.addDependency(() => {
      texts.forEach((t) => t.translateY((Math.random() - 0.5) * 5))
    })

    const rotationAnimation: UserAnimation = createAnim(
      easeInOutQuad(0, Math.PI / 2, 1000),
      (value) => {
        pivot.rotation.z = value
      }
    )

    //Will remain original length
    rotationAnimation.scaleLength(0.5).scaleLength(2)

    scene.addAnimations(
      ...texts.map((t) => fadeIn(t, 2000)),
      ...texts.map((t) => zoomIn(t, 2000)),
      rotationAnimation
    )

    scene.addAnimations(
      ...texts.map((t) => fadeOut(t, 2000)),
      ...texts.map((t) => zoomOut(t, 2000)),
      rotationAnimation.copy().reverse()
    )

    scene.end()
  })

  return scene
}*/

export const thirdScene = (): AnimatedScene => {
  return new AnimatedScene(1000, 1000, false, async (scene) => {
    const circles = Array(2)
      .fill(0)
      .map((_) => createCircle(10))

    const distanceText = await createFastText('HEJ', 20)

    circles[1].position.x = -40

    circles.forEach((c) => scene.add(c))
    scene.add(distanceText)

    const anim = moveTo(circles[0], circles[1])

    scene.addDependency(async (_) => {
      let value = circles[1].position.x - circles[0].position.x
      circles[1].material.color.r = posXSigmoid(0.1 * value)
      await updateText(distanceText, (Math.round(value * 100) / 100).toString())
      placeNextTo(circles[0], distanceText, 'Y')
    })

    scene.addAnimations(anim)
    scene.addAnimations(anim.copy().reverse())
  })
}

export const forthScene = (): AnimatedScene => {
  return new AnimatedScene(2000, 2000, false, async (scene) => {
    const yStarts = Array(10)
      .fill(0)
      .map((_, index) => -100 + index * 20)

    for (let i = 0; i < yStarts.length; i++) {
      const circle1 = createCircle(5, {
        color: new THREE.Color(0.4, 0.4, 0.4),
        stroke: {
          color: 0xffffff,
          width: 1,
          placement: 'center'
        }
      })
      const circle2 = createRectangle(10, 10, {
        color: new THREE.Color(0.4, 0.4, 0.4),
        stroke: {
          color: 0xffffff,
          width: 0.5,
          placement: 'inside'
        }
      })

      circle1.position.x = -30
      circle2.position.x = 30

      circle1.position.y = yStarts[i]
      circle2.position.y = yStarts[i]

      const line = createLine(circle1.position, circle2.position, new THREE.Color(0.2, 0.2, 0.2), 2)

      const distanceText = await createFastText('Value', 5)

      scene.addInstruction(() => {
        console.log('INSTRUCTION DID RUN')
        scene.add(circle1)
        scene.add(circle2)
        scene.add(line)

        scene.add(distanceText)
      })

      scene.addDependency(async (tick) => {
        if (tick !== 0) {
          if (tick > scene.totalSceneTicks / 2) {
            circle1.translateY(0.03 * 1)
            circle2.translateY(0.03 * -1)
            circle1.translateX(0.03 * 1)
            circle2.translateX(0.03 * -1)
          } else {
            circle1.translateY(0.03 * -1)
            circle2.translateY(0.03 * 1)
            circle1.translateX(0.03 * -1)
            circle2.translateX(0.03 * 1)
          }
        }

        line.geometry.setFromPoints([circle1.position, circle2.position])

        //await updateText(distanceText, circle1.position.distanceTo(circle2.position).toPrecision(5))
        positionAndRotateTextOnLine(distanceText, circle1.position, circle2.position)
      })
    }

    scene.addWait(30000)
  })
}

// Helper function to position and rotate text along a line
function positionAndRotateTextOnLine(textMesh, point1, point2) {
  // Calculate midpoint
  const midpoint = new THREE.Vector3()
  midpoint.addVectors(point1, point2).multiplyScalar(0.5)

  // Set text position to midpoint
  textMesh.position.copy(midpoint)

  // Calculate angle between the two points
  const angle = Math.atan2(point2.y - point1.y, point2.x - point1.x)

  // Apply rotation to the text (assuming Z is your "up" axis in 2D)
  textMesh.rotation.z = angle

  // Optional: Offset the text perpendicular to the line
  // This moves the text slightly above the line based on its current angle
  const perpOffset = -5 // Adjust this value as needed
  textMesh.position.x += Math.sin(angle) * perpOffset
  textMesh.position.y -= Math.cos(angle) * perpOffset
}
/*
export const basicScene = (container: HTMLElement): AnimatedScene => {
  const scene = new AnimatedScene(container, 1080, 1080, false)

  const name = createText('Your name', 100)

  scene.addInstruction(() => {
    scene.add(name)
  })

  scene.addAnimations(fadeIn(name, 1500), zoomIn(name, 1500))

  scene.end()
  return scene
}
*/
