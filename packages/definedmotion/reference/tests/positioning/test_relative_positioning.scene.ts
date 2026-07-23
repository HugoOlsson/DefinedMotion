import * as THREE from 'three'
import { AnimatedScene, Axis, HotReloadSetting, SpaceSetting, defineScene } from 'definedmotion'

export default defineScene({
  id: 'test-relative-positioning',
  name: 'Relative Positioning',
  isTest: true,
  create: relativePositioningScene
})

export function relativePositioningScene(): AnimatedScene {
  return new AnimatedScene(
    1000,
    1000,
    SpaceSetting.ThreeDim,
    HotReloadSetting.TraceFromStart,
    async (scene) => {
      const plotContent = new THREE.Mesh(
        new THREE.BoxGeometry(7, 4, 1),
        new THREE.MeshNormalMaterial()
      )
      plotContent.name = 'plot-content'

      const title = new THREE.Mesh(
        new THREE.BoxGeometry(4, 0.8, 0.6),
        new THREE.MeshNormalMaterial()
      )
      title.name = 'title'

      const badge = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshNormalMaterial())
      badge.name = 'badge'

      const oneShotMarker = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.65),
        new THREE.MeshNormalMaterial()
      )
      oneShotMarker.name = 'one-shot-marker'

      scene.add(plotContent, title, badge, oneShotMarker)
      scene.expose('plot-content', plotContent)
      scene.expose('title', title)
      scene.expose('badge', badge)
      scene.expose('one-shot-marker', oneShotMarker)

      const positioning = scene.positioning()
      positioning
        .place(title)
        .above(plotContent, { gap: { initial: 1.5, range: [1, 2] } })
        .centerWith(plotContent, { axis: Axis.X })
      positioning.place(badge).rightOf(title, { gap: 0.75 }).centerWith(title, { axis: Axis.Y })
      positioning
        .placeOnce(oneShotMarker)
        .leftOf(plotContent, { gap: 1 })
        .centerWith(plotContent, { axis: Axis.Y })

      scene.onEachTick((tick) => {
        plotContent.position.x = Math.sin(tick * 0.04) * 2
        plotContent.position.y = Math.sin(tick * 0.025) * 1.5
        plotContent.scale.y = 1 + Math.sin(tick * 0.2) * 0.08
      })

      scene.camera.position.set(0, 0, 20)
      scene.camera.lookAt(0, 0, 0)
      scene.addWait(4_000)
    }
  )
}
