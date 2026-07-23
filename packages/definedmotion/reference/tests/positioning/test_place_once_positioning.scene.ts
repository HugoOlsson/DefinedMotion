import * as THREE from 'three'
import { AnimatedScene, Axis, HotReloadSetting, SpaceSetting, defineScene } from 'definedmotion'
import { createFastText, createRectangle } from 'definedmotion/rendering'

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
): Promise<THREE.Group> => {
  const group = new THREE.Group()
  const panel = createRectangle(7, 3.5, {
    color: panelColor,
    stroke: { color: '#94a3b8', width: 0.12, placement: 'inside' }
  })
  const text = await createFastText(label, 0.9, textColor)
  text.position.z = 0.1
  group.add(panel, text)
  return group
}

export function placeOncePositioningScene(): AnimatedScene {
  return new AnimatedScene(
    1200,
    800,
    SpaceSetting.TwoDim,
    HotReloadSetting.TraceFromStart,
    async (scene) => {
      scene.scene.background = new THREE.Color('#07111f')

      const background = createRectangle(40, 24, { color: '#0b1729' })
      background.position.z = -5

      const anchor = await createLabeledPanel('MOVING ANCHOR', '#0e7490', 0xecfeff)
      anchor.name = 'place-once-anchor'
      const persistent = await createLabeledPanel('PERSISTENT', '#6d28d9', 0xf5f3ff)
      persistent.name = 'persistent-panel'
      const oneShot = await createLabeledPanel('PLACE ONCE', '#be123c', 0xfff1f2)
      oneShot.name = 'one-shot-panel'

      const persistentBadge = new THREE.Mesh(
        new THREE.CircleGeometry(0.65, 28),
        new THREE.MeshBasicMaterial({ color: '#c4b5fd' })
      )
      persistentBadge.name = 'persistent-badge'

      const heading = await createFastText(
        'Persistent relationship vs initial placement',
        1.25,
        0xf8fafc
      )
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
      positioning
        .place(persistent)
        .rightOf(anchor, { gap: 1.5 })
        .centerWith(anchor, { axis: Axis.Y })
      positioning
        .placeOnce(oneShot)
        .leftOf(anchor, { gap: 1.5 })
        .centerWith(anchor, { axis: Axis.Y })

      scene.onEachTick((tick) => {
        anchor.position.x = Math.sin(tick * 0.018) * 6
        anchor.position.y = Math.sin(tick * 0.029) * 2.2
        anchor.scale.x = 0.85 + (Math.sin(tick * 0.024) + 1) * 0.2
        anchor.scale.y = 0.92 + Math.cos(tick * 0.021) * 0.12
      })

      scene.addWait(6_000)
    }
  )
}
