import { wait } from 'definedmotion/animation'
import * as THREE from 'three'
import { AnimatedScene, Axis, SpaceSetting, defineScene, type ScreenBounds } from 'definedmotion'
import { createText, createRectangle, layout } from 'definedmotion/rendering'

export default defineScene({
  id: 'test-place-once-positioning',
  name: 'Positioning: Persistent Compared with Place Once',
  isTest: true,
  create: placeOncePositioningScene
})

const createLabeledPanel = async (
  label: string,
  panelColor: THREE.ColorRepresentation,
  textColor: number
): Promise<{
  root: ReturnType<typeof layout.flex>
  label: Awaited<ReturnType<typeof createText>>
}> => {
  const text = await createText({ text: label, fontSize: 0.9, color: textColor })
  text.position.z = 0.1
  const root = layout.flex(
    {
      flexDirection: 'row',
      padding: 0.75,
      alignItems: 'center',
      justifyContent: 'center',
      anchorX: 'center',
      anchorY: 'middle',
      background: panelColor,
      border: { color: '#94a3b8', width: 0.12 }
    },
    [text]
  )
  return { root, label: text }
}

export function placeOncePositioningScene(): AnimatedScene {
  return new AnimatedScene(1200, 800, SpaceSetting.TwoDim, async (scene) => {
    scene.scene.background = new THREE.Color('#07111f')

    const background = createRectangle(40, 24, { color: '#0b1729' })
    background.position.z = -5

    const anchorComponent = await createLabeledPanel('MOVING ANCHOR', '#0e7490', 0xecfeff)
    const anchor = anchorComponent.root
    anchor.name = 'place-once-anchor'
    const persistentComponent = await createLabeledPanel('PERSISTENT', '#6d28d9', 0xf5f3ff)
    const persistent = persistentComponent.root
    persistent.name = 'persistent-panel'
    const oneShotComponent = await createLabeledPanel('PLACE ONCE', '#be123c', 0xfff1f2)
    const oneShot = oneShotComponent.root
    oneShot.name = 'one-shot-panel'

    const persistentBadge = new THREE.Mesh(
      new THREE.CircleGeometry(0.65, 28),
      new THREE.MeshBasicMaterial({ color: '#c4b5fd' })
    )
    persistentBadge.name = 'persistent-badge'

    const heading = await createText({
      text: 'Persistent relationship vs initial placement',
      fontSize: 1.25,
      color: 0xf8fafc
    })
    heading.position.set(0, 9, 0)

    scene.add(background, anchor, persistent, oneShot, persistentBadge, heading)
    scene.expose('place-once-anchor', anchor)
    scene.expose('persistent-panel', persistent)
    scene.expose('one-shot-panel', oneShot)
    scene.expose('persistent-badge', persistentBadge)

    const positioning = scene.positioning()
    positioning
      .place(persistentBadge)
      .above(persistent, { gap: 0.9 })
      .centerWith(persistent, { axis: Axis.X })
    positioning.place(persistent).rightOf(anchor, { gap: 1.5 }).centerWith(anchor, { axis: Axis.Y })
    positioning.placeOnce(oneShot).leftOf(anchor, { gap: 1.5 }).centerWith(anchor, { axis: Axis.Y })

    scene.onEachTick((tick) => {
      anchor.position.x = Math.sin(tick * 0.018) * 6
      anchor.position.y = Math.sin(tick * 0.029) * 2.2
      anchor.scale.x = 0.85 + (Math.sin(tick * 0.024) + 1) * 0.2
      anchor.scale.y = 0.92 + Math.cos(tick * 0.021) * 0.12
    })

    scene.addAnims(wait(6))

    const labeledPanels = [anchorComponent, persistentComponent, oneShotComponent]
    scene.verify('positioning-labels-contained', {}, (context) => {
      const measurements = labeledPanels.map(({ root, label }) => ({
        panel: context.screenBounds(root),
        label: context.screenBounds(label)
      }))
      context.assert(
        measurements.every(({ panel, label }) => containsWithMargin(panel, label, 4)),
        'Every positioning label must remain inside its layout-owned panel',
        { measurements, requiredMargin: 4 }
      )
    })
  })
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
