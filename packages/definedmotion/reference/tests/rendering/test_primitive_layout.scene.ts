import { AnimatedScene, SpaceSetting, defineScene } from 'definedmotion'
import { fadeIn, wait } from 'definedmotion/animation'
import { createLatex } from 'definedmotion/latex'
import { createRectangle, createText, layout } from 'definedmotion/rendering'
import * as THREE from 'three'

export default defineScene({
  id: 'test-primitive-layout',
  name: 'Primitive Layout Contract',
  isTest: true,
  create: testPrimitiveLayout
})

export function testPrimitiveLayout(): AnimatedScene {
  return new AnimatedScene(800, 400, SpaceSetting.TwoDim, async (scene) => {
    const title = await createText({
      text: 'Predictable layout',
      fontSize: 3,
      color: '#38bdf8',
      anchorX: 'left',
      anchorY: 'top'
    })
    const explanation = await createText({
      text: 'Slots own layout positions.\nVisuals keep their transforms.',
      fontSize: 1.8,
      maxWidth: 24,
      textAlign: 'left',
      color: '#c4b5fd',
      anchorX: 'left',
      anchorY: 'top'
    })
    const equation = await createLatex({
      latex: String.raw`P = \frac{E}{t}`,
      fontSize: 3,
      color: '#4ade80'
    })
    const diagram = new THREE.Group()
    diagram.name = 'OrdinaryThreeDiagram'
    const diagramBase = createRectangle(12, 0.25, { color: '#475569' })
    diagramBase.position.y = -2.5
    const diagramBarA = createRectangle(2.2, 4, { color: '#38bdf8' })
    diagramBarA.position.set(-3, -0.5, 0.1)
    const diagramBarB = createRectangle(2.2, 5, { color: '#a78bfa' })
    diagramBarB.position.set(3, 0, 0.1)
    diagram.add(diagramBase, diagramBarA, diagramBarB)
    const column = layout.flex(
      {
        name: 'Static explanation column',
        flexDirection: 'column',
        width: 34,
        gap: 2,
        padding: 2,
        alignItems: 'center',
        anchorX: 'left',
        anchorY: 'top'
      },
      [title, explanation, diagram, equation]
    )
    column.position.set(-26, 12, 0)
    scene.add(column)
    scene.expose('layout-static-column', column)
    scene.expose('layout-ordinary-object', diagram)

    const dynamicList = layout.flex({
      name: 'Dynamic instruction list',
      flexDirection: 'column',
      gap: 1.5,
      alignItems: 'flex-start',
      anchorX: 'left',
      anchorY: 'top'
    })
    dynamicList.position.set(12, 9, 0)
    scene.add(dynamicList)
    scene.expose('layout-dynamic-list', dynamicList)

    const firstBullet = await createText({
      text: '• Rotate the food',
      fontSize: 2,
      color: '#f8fafc',
      anchorX: 'left',
      anchorY: 'top'
    })
    const secondBullet = await createText({
      text: '• Let the heat spread',
      fontSize: 2,
      color: '#f8fafc',
      anchorX: 'left',
      anchorY: 'top'
    })
    scene.expose('layout-first-appended', firstBullet)
    scene.expose('layout-second-appended', secondBullet)

    scene.addAnims(wait(1 / scene.fps))
    scene.do(() => dynamicList.append(firstBullet))
    scene.addAnims(fadeIn(firstBullet, { duration: 2 / scene.fps }))
    scene.do(() => dynamicList.append(secondBullet))
    scene.addAnims(fadeIn(secondBullet, { duration: 2 / scene.fps }))

    const end = scene.getTimelinePointer()
    scene.verify('layout-ordinary-object-measurement', { frames: { start: 0, end } }, (context) => {
      const bounds = column.getLocalBounds()
      const finite = [...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)
      context.assert(
        column.name === 'Static explanation column' &&
          column.items.includes(diagram) &&
          diagram.parent?.name === 'DefinedMotionLayoutSlot' &&
          typeof (diagram as THREE.Object3D & { getLocalBounds?: unknown }).getLocalBounds ===
            'undefined' &&
          finite,
        'An ordinary Object3D must remain unmodified while the named layout measures it internally',
        {
          layoutName: column.name,
          itemNames: column.items.map((item) => item.name),
          diagramParent: diagram.parent?.name,
          bounds
        }
      )
    })
  })
}
