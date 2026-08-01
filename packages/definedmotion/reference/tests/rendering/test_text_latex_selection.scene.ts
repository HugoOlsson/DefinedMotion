import { AnimatedScene, SpaceSetting, defineScene, type ScreenBounds } from 'definedmotion'
import { fadeIn, wait } from 'definedmotion/animation'
import { createLatex, latex, queryLaTeXClass } from 'definedmotion/latex'
import { createText, layout } from 'definedmotion/rendering'
import * as THREE from 'three'

export default defineScene({
  id: 'test-text-latex-selection',
  name: 'Text and LaTeX Selection Contract',
  isTest: true,
  create: testTextLatexSelection
})

export function testTextLatexSelection(): AnimatedScene {
  return new AnimatedScene(800, 400, SpaceSetting.TwoDim, async (scene) => {
    scene.scene.background = new THREE.Color('#050505')

    const title = await createText({
      text: 'Meaning survives the rearrangement.',
      fontSize: 3.2,
      color: '#f3f0e8',
      anchorX: 'left',
      anchorY: 'top'
    })
    const explanation = await createText({
      text: 'Energy, mass, and light speed keep their identity even when the equation changes form.',
      fontSize: 1.3,
      color: '#9c9890',
      maxWidth: 62,
      textAlign: 'left',
      lineHeight: 1.2
    })
    const equation = await createLatex({
      latex: String.raw`\dmClass{energy}{E} = \dmClass{mass}{m}\dmClass{light}{c^2}`,
      fontSize: 6.2,
      color: '#f3f0e8'
    })
    const energy = equation.part('energy')
    const mass = equation.part('mass')
    const light = equation.part('light')
    const equationId = equation.uuid
    const legendItems = await Promise.all([
      createText({ text: 'energy', fontSize: 1.05, color: '#d9825b' }),
      createText({ text: 'mass', fontSize: 1.05, color: '#d4aa55' }),
      createText({ text: 'light speed', fontSize: 1.05, color: '#5aa6c8' })
    ])
    const legend = layout.flex(
      {
        flexDirection: 'row',
        width: 38,
        gap: 4,
        alignItems: 'center',
        justifyContent: 'space-evenly'
      },
      legendItems
    )
    const equationStage = layout.flex(
      {
        flexDirection: 'column',
        width: 64,
        gap: 5,
        alignItems: 'center',
        anchorX: 'left',
        anchorY: 'top'
      },
      [equation, legend]
    )
    const header = layout.flex(
      {
        flexDirection: 'column',
        width: 64,
        gap: 1.5,
        alignItems: 'flex-start',
        anchorX: 'left',
        anchorY: 'top'
      },
      [title, explanation]
    )
    const content = layout.flex(
      {
        flexDirection: 'column',
        width: 72,
        gap: 5,
        padding: 4,
        alignItems: 'flex-start',
        justifyContent: 'center',
        anchorX: 'center',
        anchorY: 'middle',
        background: '#050505'
      },
      [header, equationStage]
    )
    content.scale.setScalar(1.32)

    scene.add(content)
    scene.expose('latex-selection-content', content)
    scene.expose('latex-selection-title', title)
    scene.expose('latex-selection-explanation', explanation)
    scene.expose('latex-selection-equation', equation, {
      data: { rootStable: equation.uuid === equationId }
    })
    scene.expose('latex-selection-legend', legend)

    scene.addAnims(
      fadeIn(title, { duration: 24 / scene.fps }),
      fadeIn(explanation, { duration: 24 / scene.fps }),
      fadeIn(legend, { duration: 24 / scene.fps }),
      latex.write(equation, { duration: 36 / scene.fps })
    )

    const energyStart = scene.getTimelinePointer()
    scene.addAnims(
      latex.mark(energy, {
        duration: 30 / scene.fps,
        color: '#d9825b',
        padding: 0.18,
        pulses: 1,
        scale: 0.06
      })
    )
    const energyEnd = scene.getTimelinePointer()

    const massStart = scene.getTimelinePointer()
    scene.addAnims(
      latex.highlight(mass, {
        duration: 30 / scene.fps,
        color: '#d4aa55',
        pulses: 1
      })
    )
    const massEnd = scene.getTimelinePointer()

    const lightStart = scene.getTimelinePointer()
    scene.addAnims(
      latex.mark(light, {
        duration: 30 / scene.fps,
        color: '#5aa6c8',
        padding: 0.14,
        pulses: 1,
        scale: 0.05
      })
    )
    const lightEnd = scene.getTimelinePointer()

    scene.addAnims(
      await latex.morphTo(equation, {
        latex: String.raw`\frac{\dmClass{energy}{E}}{\dmClass{mass}{m}} = \dmClass{light}{c^2}`,
        duration: 36 / scene.fps,
        particleCount: 2500
      })
    )

    const postMorphStart = scene.getTimelinePointer()
    scene.addAnims(
      latex.highlight(light, {
        duration: 30 / scene.fps,
        color: '#78a878',
        pulses: 1
      })
    )
    const postMorphEnd = scene.getTimelinePointer()
    scene.addAnims(wait(12 / scene.fps))
    const end = scene.getTimelinePointer()

    scene.verify('latex-selection-in-panel', { frames: { start: 0, end } }, (context) => {
      const contentBounds = context.screenBounds(content)
      const rowBounds = [title, explanation, equation, legend].map((item) =>
        context.screenBounds(item)
      )
      context.assert(
        rowBounds.every((bounds) => containsWithMargin(contentBounds, bounds, 8)),
        'The fit-content layout surface must contain text and LaTeX throughout the morph',
        { contentBounds, rowBounds, requiredMargin: 8 }
      )
    })
    scene.verify('latex-selection-rows-separated', { frames: { start: 0, end } }, (context) => {
      const rows = [title, explanation, equation, legend].map((item) => context.screenBounds(item))
      const separated = rows.every(
        (bounds, index) =>
          bounds !== null &&
          (index === 0 || (rows[index - 1] !== null && rows[index - 1]!.bottom <= bounds.top))
      )
      context.assert(separated, 'Text, equation, and legend rows must not overlap', { rows })
    })
    scene.verify('latex-selection-parts-resolve', { frames: { start: 0, end } }, (context) => {
      const resolved = ['energy', 'mass', 'light'].map((id) => queryLaTeXClass(equation, id))
      context.assert(
        resolved.every((part) => part !== null),
        'Every semantic LaTeX part must resolve before and after the morph',
        { resolvedPartCount: resolved.filter((part) => part !== null).length }
      )
      context.assert(equation.uuid === equationId, 'The LaTeX root must remain stable')
    })
    verifyVisibleMark(
      scene,
      'latex-energy-mark-visible',
      equation,
      midpoint(energyStart, energyEnd)
    )
    verifyPartColor(
      scene,
      'latex-mass-highlight-visible',
      equation,
      'mass',
      '#d4aa55',
      midpoint(massStart, massEnd)
    )
    verifyVisibleMark(scene, 'latex-light-mark-visible', equation, midpoint(lightStart, lightEnd))
    verifyPartColor(
      scene,
      'latex-post-morph-highlight-visible',
      equation,
      'light',
      '#78a878',
      midpoint(postMorphStart, postMorphEnd)
    )
    verifyPartColor(scene, 'latex-selection-restores-color', equation, 'light', '#f3f0e8', end - 1)
  })
}

const midpoint = (start: number, end: number): number => start + Math.floor((end - start - 1) / 2)

const verifyVisibleMark = (
  scene: AnimatedScene,
  id: string,
  equation: THREE.Object3D,
  frame: number
): void => {
  scene.verify(id, { frames: { start: frame, end: frame + 1 } }, (context) => {
    let visibleLine = false
    equation.traverse((object) => {
      const line = object as THREE.LineSegments<THREE.BufferGeometry, THREE.Material>
      if (!line.isLineSegments) return
      const materials = Array.isArray(line.material) ? line.material : [line.material]
      visibleLine ||= materials.some((material) => material.opacity > 0.8)
    })
    context.assert(visibleLine, 'The semantic LaTeX mark must be visible at its midpoint', {
      frame: context.globalFrame
    })
  })
}

const verifyPartColor = (
  scene: AnimatedScene,
  id: string,
  equation: THREE.Object3D,
  partId: string,
  expectedColor: THREE.ColorRepresentation,
  frame: number
): void => {
  scene.verify(id, { frames: { start: frame, end: frame + 1 } }, (context) => {
    const part = queryLaTeXClass(equation, partId)
    const expected = new THREE.Color(expectedColor)
    const hasExpectedColor =
      part?.meshes.some((mesh) => {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        return materials.some((material) => {
          const color = (material as THREE.Material & { color?: THREE.Color }).color
          return (
            color !== undefined &&
            Math.hypot(color.r - expected.r, color.g - expected.g, color.b - expected.b) < 0.08
          )
        })
      }) ?? false
    context.assert(hasExpectedColor, `LaTeX part "${partId}" must use its selection color`, {
      frame: context.globalFrame,
      partId
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
