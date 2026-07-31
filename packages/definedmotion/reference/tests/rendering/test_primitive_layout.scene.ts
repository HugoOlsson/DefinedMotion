import { AnimatedScene, HotReloadSetting, SpaceSetting, defineScene } from 'definedmotion'
import { fadeIn, wait } from 'definedmotion/animation'
import { createLatex } from 'definedmotion/latex'
import { createText, layout } from 'definedmotion/rendering'

export default defineScene({
  id: 'test-primitive-layout',
  name: 'Primitive Layout Contract',
  isTest: true,
  create: testPrimitiveLayout
})

export function testPrimitiveLayout(): AnimatedScene {
  return new AnimatedScene(
    800,
    400,
    SpaceSetting.TwoDim,
    HotReloadSetting.TraceFromStart,
    async (scene) => {
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
      const column = layout.flex(
        {
          flexDirection: 'column',
          width: 34,
          gap: 2,
          padding: 2,
          alignItems: 'center',
          anchorX: 'left',
          anchorY: 'top'
        },
        [title, explanation, equation]
      )
      column.position.set(-26, 12, 0)
      scene.add(column)
      scene.expose('layout-static-column', column)

      const dynamicList = layout.flex({
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
    }
  )
}
