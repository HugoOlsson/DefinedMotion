import { AnimatedScene, SpaceSetting, defineScene, type ScreenBounds } from 'definedmotion'
import { fadeIn, moveTo, scaleIn, wait } from 'definedmotion/animation'
import { createLatex } from 'definedmotion/latex'
import { createText, layout } from 'definedmotion/rendering'
import * as THREE from 'three'

export default defineScene({
  id: 'test-layout-animation',
  name: 'Layout Animation and Reflow Contract',
  isTest: true,
  create: testLayoutAnimation
})

export function testLayoutAnimation(): AnimatedScene {
  return new AnimatedScene(800, 400, SpaceSetting.TwoDim, async (scene) => {
    scene.scene.background = new THREE.Color('#050505')

    const heading = await createText({
      text: 'A list should make room for itself.',
      fontSize: 3.4,
      color: '#f3f0e8',
      anchorX: 'left',
      anchorY: 'top'
    })
    const listHeading = await createText({
      text: 'For more even heating',
      fontSize: 1.75,
      color: '#f3f0e8',
      anchorX: 'left',
      anchorY: 'top'
    })
    const footer = await createText({
      text: 'This note moves down as the list grows.',
      fontSize: 1.15,
      color: '#8f8b84',
      anchorX: 'left',
      anchorY: 'top'
    })
    const firstItem = await createText({
      text: '01   Rotate the food',
      fontSize: 1.55,
      color: '#d4aa55',
      anchorX: 'left',
      anchorY: 'top'
    })
    const secondItem = await createText({
      text: '02   Let heat spread',
      fontSize: 1.55,
      color: '#d9825b',
      anchorX: 'left',
      anchorY: 'top'
    })

    const dynamicList = layout.flex(
      {
        flexDirection: 'column',
        width: 29,
        gap: 1.35,
        padding: 1.2,
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
      createCell('power', String.raw`P = \frac{E}{t}`, '#f3f0e8'),
      createCell('energy', String.raw`E = Pt`, '#f3f0e8'),
      createCell('time', String.raw`t = \frac{E}{P}`, '#f3f0e8'),
      createCell('average', String.raw`\bar{P}`, '#d4aa55')
    ])
    const formulaGrid = layout.grid(
      {
        columns: 2,
        width: 32,
        height: 19,
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
        gap: 3,
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
        width: 70,
        height: 32,
        gap: 2.5,
        padding: 2,
        alignItems: 'flex-start',
        anchorX: 'center',
        anchorY: 'middle',
        background: '#050505'
      },
      [heading, body]
    )
    page.scale.setScalar(1.42)

    scene.add(page)
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
    scene.verify('layout-animation-in-panel', { frames: { start: 0, end } }, (context) => {
      const pageBounds = context.screenBounds(page)
      const headingBounds = context.screenBounds(heading)
      const bodyBounds = context.screenBounds(body)
      context.assert(
        containsWithMargin(pageBounds, headingBounds, 8) &&
          containsWithMargin(pageBounds, bodyBounds, 8),
        'The layout-owned panel must contain its animated content',
        { pageBounds, headingBounds, bodyBounds, requiredMargin: 8 }
      )
    })
    scene.verify('layout-animation-columns-separated', { frames: { start: 0, end } }, (context) => {
      const leftBounds = context.screenBounds(leftStack)
      const gridBounds = context.screenBounds(formulaGrid)
      context.assert(
        leftBounds !== null && gridBounds !== null && leftBounds.right <= gridBounds.left,
        'The animated columns must not overlap',
        { leftBounds, gridBounds }
      )
    })
    scene.verify('layout-animation-list-separated', { frames: { start: 0, end } }, (context) => {
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
    })
  })
}

const createCell = async (
  labelText: string,
  latexText: string,
  color: THREE.ColorRepresentation
) => {
  const label = await createText({
    text: labelText,
    fontSize: 1.1,
    color: '#8f8b84'
  })
  const value = await createLatex({ latex: latexText, fontSize: 2.4, color })
  return layout.flex(
    {
      flexDirection: 'column',
      width: 13,
      height: 7.5,
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
