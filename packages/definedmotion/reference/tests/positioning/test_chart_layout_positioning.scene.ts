import { wait } from 'definedmotion/animation'
import * as THREE from 'three'
import { AnimatedScene, Axis, SpaceSetting, defineScene } from 'definedmotion'
import { createText, createLine, createRectangle } from 'definedmotion/rendering'

export default defineScene({
  id: 'test-chart-layout-positioning',
  name: 'Positioning: Responsive Chart Layout',
  isTest: true,
  create: chartLayoutPositioningScene
})

export function chartLayoutPositioningScene(): AnimatedScene {
  return new AnimatedScene(
    1200,
    800,
    SpaceSetting.TwoDim,
    async (scene) => {
      scene.scene.background = new THREE.Color('#07111f')

      const dashboard = createRectangle(72, 44, { color: '#0b1729' })
      dashboard.position.z = -4

      const plotContent = new THREE.Group()
      plotContent.name = 'chart-plot-content'
      const plotPanel = createRectangle(34, 20, {
        color: '#12243b',
        stroke: { color: '#294767', width: 0.18, placement: 'inside' }
      })
      plotPanel.position.z = -1
      plotContent.add(plotPanel)

      const axisColor = new THREE.Color('#5f7898')
      const horizontalAxis = createLine({
        point1: new THREE.Vector3(-14.5, -7.2, 0),
        point2: new THREE.Vector3(14.5, -7.2, 0),
        color: axisColor
      })
      const verticalAxis = createLine({
        point1: new THREE.Vector3(-14.5, -7.2, 0),
        point2: new THREE.Vector3(-14.5, 7.2, 0),
        color: axisColor
      })
      plotContent.add(horizontalAxis, verticalAxis)

      const barHeights = [6, 9, 12, 8, 14]
      const bars = barHeights.map((height, index) => {
        const bar = createRectangle(3.3, height, {
          color: index % 2 === 0 ? '#38bdf8' : '#a78bfa'
        })
        bar.position.set(-10.8 + index * 5.4, -7.2 + height / 2, 0.5)
        plotContent.add(bar)
        return bar
      })

      const title = await createText({ text: 'Quarterly revenue', fontSize: 2.2, color: 0xf8fafc })
      title.name = 'chart-title'
      const xLabel = await createText({ text: 'Quarter', fontSize: 1.2, color: 0x94a3b8 })
      xLabel.name = 'chart-x-label'
      const yLabel = await createText({ text: 'Revenue (MSEK)', fontSize: 1.2, color: 0x94a3b8 })
      yLabel.name = 'chart-y-label'
      yLabel.rotation.z = Math.PI / 2

      const legend = new THREE.Group()
      legend.name = 'chart-legend'
      const actualSwatch = createRectangle(1.6, 1.1, { color: '#38bdf8' })
      actualSwatch.position.set(-2.6, 1.25, 0)
      const actualLabel = await createText({ text: 'Actual', fontSize: 1.05, color: 0xcbd5e1 })
      actualLabel.position.set(0.5, 1.25, 0)
      const forecastSwatch = createRectangle(1.6, 1.1, { color: '#a78bfa' })
      forecastSwatch.position.set(-2.6, -1.25, 0)
      const forecastLabel = await createText({ text: 'Forecast', fontSize: 1.05, color: 0xcbd5e1 })
      forecastLabel.position.set(0.8, -1.25, 0)
      legend.add(actualSwatch, actualLabel, forecastSwatch, forecastLabel)

      const legendNote = await createText({ text: 'Updated live', fontSize: 0.85, color: 0x64748b })
      legendNote.name = 'chart-legend-note'

      scene.add(dashboard, plotContent, title, xLabel, yLabel, legend, legendNote)
      scene.expose('chart-plot', plotContent)
      scene.expose('chart-title', title)
      scene.expose('chart-x-label', xLabel)
      scene.expose('chart-y-label', yLabel)
      scene.expose('chart-legend', legend)
      scene.expose('chart-legend-note', legendNote)

      const positioning = scene.positioning()
      positioning
        .place(title)
        .above(plotContent, { gap: { initial: 2.4, range: [1.6, 3.2] } })
        .centerWith(plotContent, { axis: Axis.X })
      positioning
        .place(xLabel)
        .below(plotContent, { gap: 1.8 })
        .centerWith(plotContent, { axis: Axis.X })
      positioning
        .place(yLabel)
        .leftOf(plotContent, { gap: 1.8 })
        .centerWith(plotContent, { axis: Axis.Y })
      positioning
        .place(legend)
        .rightOf(plotContent, { gap: { initial: 2.2, range: [1.5, 3] } })
        .centerWith(plotContent, { axis: Axis.Y })
      positioning.place(legendNote).below(legend, { gap: 1.2 }).centerWith(legend, { axis: Axis.X })

      scene.onEachTick((tick) => {
        plotContent.position.x = Math.sin(tick * 0.022) * 2.4
        plotContent.position.y = Math.sin(tick * 0.017) * 1.2
        plotContent.scale.x = 1 + Math.sin(tick * 0.031) * 0.08
        plotContent.scale.y = 1 + Math.cos(tick * 0.027) * 0.06

        bars.forEach((bar, index) => {
          bar.scale.y = 0.82 + Math.sin(tick * 0.045 + index * 0.65) * 0.18
        })
      })

      scene.addAnims(wait((5_000) / 1000))
    }
  )
}
