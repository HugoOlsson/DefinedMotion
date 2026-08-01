import {
  AnimatedScene,
  SpaceSetting,
  defineScene,
  type ScreenBounds
} from 'definedmotion'
import { fadeIn, moveTo, scaleIn, wait } from 'definedmotion/animation'
import { createLatex } from 'definedmotion/latex'
import { createRectangle, createText, layout } from 'definedmotion/rendering'
import * as THREE from 'three'

export default defineScene({
  id: 'test-layout-animation',
  name: 'Layout Animation and Reflow Contract',
  isTest: true,
  create: testLayoutAnimation
})

export function testLayoutAnimation(): AnimatedScene {
  return new AnimatedScene(
    800,
    400,
    SpaceSetting.TwoDim,
    async (scene) => {
      const panel = createRectangle(72, 34, { color: '#111827' })
      panel.position.z = -1

      const heading = await createText({
        text: 'NESTED LAYOUT + RUNTIME APPEND',
        fontSize: 2.6,
        color: '#38bdf8',
        anchorX: 'left',
        anchorY: 'top'
      })
      const listHeading = await createText({
        text: 'Heating checklist',
        fontSize: 2,
        color: '#f8fafc',
        anchorX: 'left',
        anchorY: 'top'
      })
      const footer = await createText({
        text: 'Footer follows the growing list',
        fontSize: 1.35,
        color: '#94a3b8',
        anchorX: 'left',
        anchorY: 'top'
      })
      const firstItem = await createText({
        text: '1. Rotate the food',
        fontSize: 1.65,
        color: '#fbbf24',
        anchorX: 'left',
        anchorY: 'top'
      })
      const secondItem = await createText({
        text: '2. Let heat spread',
        fontSize: 1.65,
        color: '#fb923c',
        anchorX: 'left',
        anchorY: 'top'
      })

      const dynamicList = layout.flex(
        {
          flexDirection: 'column',
          width: 27,
          gap: 1.2,
          padding: 1.5,
          alignItems: 'flex-start',
          anchorX: 'left',
          anchorY: 'top'
        },
        [listHeading]
      )
      const leftStack = layout.flex(
        {
          flexDirection: 'column',
          gap: 1.5,
          alignItems: 'flex-start',
          anchorX: 'left',
          anchorY: 'top'
        },
        [dynamicList, footer]
      )

      const cells = await Promise.all([
        createCell('POWER', String.raw`P = \frac{E}{t}`, '#4ade80'),
        createCell('ENERGY', String.raw`E = Pt`, '#a78bfa'),
        createCell('TIME', String.raw`t = \frac{E}{P}`, '#f472b6'),
        createCell('AVERAGE', String.raw`\bar{P}`, '#22d3ee')
      ])
      const formulaGrid = layout.grid(
        {
          columns: 2,
          width: 32,
          height: 18,
          columnGap: 2,
          rowGap: 2,
          padding: 1,
          alignItems: 'center',
          justifyItems: 'center',
          anchorX: 'left',
          anchorY: 'top'
        },
        cells
      )
      const body = layout.flex(
        {
          flexDirection: 'row',
          width: 64,
          gap: 5,
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          anchorX: 'left',
          anchorY: 'top'
        },
        [leftStack, formulaGrid]
      )
      const page = layout.flex(
        {
          flexDirection: 'column',
          width: 68,
          height: 30,
          gap: 2.5,
          padding: 2,
          alignItems: 'flex-start',
          anchorX: 'center',
          anchorY: 'middle'
        },
        [heading, body]
      )

      scene.add(panel, page)
      scene.expose('layout-animation-page', page)
      scene.expose('layout-animation-list', dynamicList)
      scene.expose('layout-animation-footer', footer)
      scene.expose('layout-animation-grid', formulaGrid)
      scene.expose('layout-animation-first-item', firstItem)
      scene.expose('layout-animation-second-item', secondItem)

      scene.addAnims(
        fadeIn(page, { duration: 24 / scene.fps }),
        scaleIn(page, { duration: 24 / scene.fps, from: 0.96 }),
        moveTo(formulaGrid, new THREE.Vector3(0, 0, 0), {
          duration: 24 / scene.fps,
          from: new THREE.Vector3(3, 0, 0)
        })
      )

      scene.do(() => dynamicList.append(firstItem))
      scene.addAnims(
        fadeIn(firstItem, { duration: 24 / scene.fps }),
        moveTo(firstItem, new THREE.Vector3(0, 0, 0), {
          duration: 24 / scene.fps,
          from: new THREE.Vector3(3, 0, 0)
        })
      )
      scene.addAnims(wait(6 / scene.fps))

      scene.do(() => dynamicList.append(secondItem))
      scene.addAnims(
        fadeIn(secondItem, { duration: 24 / scene.fps }),
        scaleIn(secondItem, { duration: 24 / scene.fps, from: 0.8 })
      )
      scene.addAnims(wait(12 / scene.fps))

      const end = scene.getTimelinePointer()
      scene.verify(
        'layout-animation-in-panel',
        { frames: { start: 0, end } },
        (context) => {
          const pageBounds = context.screenBounds(page)
          const panelBounds = context.screenBounds(panel)
          context.assert(
            containsWithMargin(panelBounds, pageBounds, 8),
            'Animated layout must remain inside its panel',
            { panelBounds, pageBounds, requiredMargin: 8 }
          )
        }
      )
      scene.verify(
        'layout-animation-columns-separated',
        { frames: { start: 0, end } },
        (context) => {
          const leftBounds = context.screenBounds(leftStack)
          const gridBounds = context.screenBounds(formulaGrid)
          context.assert(
            leftBounds !== null && gridBounds !== null && leftBounds.right <= gridBounds.left,
            'The animated columns must not overlap',
            { leftBounds, gridBounds }
          )
        }
      )
      scene.verify(
        'layout-animation-list-separated',
        { frames: { start: 0, end } },
        (context) => {
          const attachedItems = [listHeading, firstItem, secondItem].filter(
            (item) => item.parent !== null
          )
          const itemBounds = attachedItems.map((item) => context.screenBounds(item))
          const listBounds = context.screenBounds(dynamicList)
          const footerBounds = context.screenBounds(footer)
          const ordered = itemBounds.every(
            (bounds, index) =>
              bounds !== null &&
              (index === 0 ||
                (itemBounds[index - 1] !== null && itemBounds[index - 1]!.bottom <= bounds.top))
          )
          context.assert(ordered, 'Appended list items must not overlap', { itemBounds })
          context.assert(
            listBounds !== null && footerBounds !== null && listBounds.bottom <= footerBounds.top,
            'Nested reflow must move the footer below the growing list',
            { listBounds, footerBounds }
          )
        }
      )
    }
  )
}

const createCell = async (
  labelText: string,
  latexText: string,
  color: THREE.ColorRepresentation
) => {
  const label = await createText({
    text: labelText,
    fontSize: 1.1,
    color: '#94a3b8'
  })
  const value = await createLatex({ latex: latexText, fontSize: 2.4, color })
  return layout.flex(
    {
      flexDirection: 'column',
      width: 13,
      height: 7,
      gap: 0.8,
      alignItems: 'center',
      justifyContent: 'center'
    },
    [label, value]
  )
}

const containsWithMargin = (
  outer: ScreenBounds | null,
  inner: ScreenBounds | null,
  margin: number
): boolean =>
  outer !== null &&
  inner !== null &&
  inner.left >= outer.left + margin &&
  inner.right <= outer.right - margin &&
  inner.top >= outer.top + margin &&
  inner.bottom <= outer.bottom - margin
