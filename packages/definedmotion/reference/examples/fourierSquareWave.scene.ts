import { wait } from 'definedmotion/animation'
import * as THREE from 'three'
import { defineScene } from 'definedmotion'
import { createLine, createFastText } from 'definedmotion/rendering'
import { createSVGShape } from 'definedmotion/latex'
import { latexToSVG } from 'definedmotion/latex'
import { AnimatedScene, SpaceSetting } from 'definedmotion'

export default defineScene({
  id: 'fourier-square-wave',
  name: 'Fourier Square Wave',
  create: fourierSquareWaveScene
})

const TERM_COUNT = 9
const DURATION_MS = 12_000
const BASE_CENTER = new THREE.Vector3(-34, -4, 0)
const PLOT_START_X = -7
const PLOT_END_X = 48
const WAVE_AMPLITUDE = 9
const PLOT_SAMPLES = 360
const COLORS = [
  '#22d3ee',
  '#38bdf8',
  '#818cf8',
  '#a78bfa',
  '#e879f9',
  '#fb7185',
  '#fb923c',
  '#facc15',
  '#a3e635'
]

interface DynamicLine extends THREE.Line {
  updatePoints(points: THREE.Vector3[]): void
}

interface EpicycleVisual {
  circle: THREE.LineLoop
  radius: ReturnType<typeof createLine>
  material: THREE.LineBasicMaterial
}

export function fourierSquareWaveScene(): AnimatedScene {
  return new AnimatedScene(
    1600,
    900,
    SpaceSetting.TwoDim,
    async (scene) => {
      scene.scene.background = new THREE.Color('#070a18')

      const title = await createFastText('Building a Square Wave', 3.2, 0xf8fafc)
      title.position.set(0, 27, 1)
      scene.add(title)

      const subtitle = await createFastText('Odd harmonics become geometry', 1.25, 0x94a3b8)
      subtitle.position.set(0, 23.5, 1)
      scene.add(subtitle)

      const formula = scene.expose(
        'fourier-formula',
        createSVGShape(
          latexToSVG(
            String.raw`f_N(t)=\frac{4}{\pi}\sum_{k=0}^{N-1}\frac{\sin\!\left((2k+1)t\right)}{2k+1}`
          ),
          31
        ),
        {
          description: 'Finite odd-harmonic Fourier series used by the animation',
          tags: ['latex', 'formula', 'fourier-series']
        }
      )
      formula.position.set(0, 17.5, 1)
      scene.add(formula)

      const divider = createLine({
        point1: new THREE.Vector3(-49, 12.5, 0),
        point2: new THREE.Vector3(49, 12.5, 0),
        color: '#26324f'
      })
      scene.add(divider)

      const epicycleCaption = await createFastText('EPICYCLES', 1.05, 0x64748b)
      epicycleCaption.position.set(-34, 9.5, 1)
      scene.add(epicycleCaption)

      const waveCaption = await createFastText('PARTIAL SUM', 1.05, 0x64748b)
      waveCaption.position.set(20, 9.5, 1)
      scene.add(waveCaption)

      addPlotGuides(scene)

      const epicycleGroup = scene.expose('epicycle-chain', new THREE.Group(), {
        description: 'Odd-harmonic rotating circles whose vector sum drives the waveform',
        tags: ['epicycles', 'harmonics', 'dynamic']
      })
      const epicycles: EpicycleVisual[] = []
      for (let index = 0; index < TERM_COUNT; index++) {
        const material = new THREE.LineBasicMaterial({
          color: COLORS[index],
          transparent: true,
          opacity: 0.8,
          depthTest: false
        })
        const circle = new THREE.LineLoop(unitCircleGeometry(96), material)
        circle.frustumCulled = false
        const radius = createLine({ color: COLORS[index] })
        radius.frustumCulled = false
        epicycleGroup.add(circle, radius)
        epicycles.push({ circle, radius, material })
      }
      scene.add(epicycleGroup)

      const targetWave = scene.expose(
        'target-square-wave',
        createDynamicLine(PLOT_SAMPLES, '#334155', 0.72),
        {
          description: 'Ideal square wave approached by the Fourier partial sum',
          tags: ['target', 'square-wave']
        }
      )
      const reconstructedWave = scene.expose(
        'fourier-reconstruction',
        createDynamicLine(PLOT_SAMPLES, '#67e8f9', 1),
        {
          description: 'Animated partial sum of the currently revealed odd harmonics',
          tags: ['waveform', 'partial-sum', 'dynamic']
        }
      )
      scene.add(targetWave, reconstructedWave)

      const connector = createLine({ color: '#f8fafc' })
      connector.frustumCulled = false
      scene.add(connector)

      const tip = scene.expose(
        'vector-tip',
        new THREE.Mesh(
          new THREE.CircleGeometry(0.48, 32),
          new THREE.MeshBasicMaterial({ color: '#ffffff', depthTest: false })
        ),
        {
          description: 'Current endpoint of the harmonic vector chain',
          tags: ['tip', 'dynamic']
        }
      )
      tip.position.z = 1
      scene.add(tip)

      const harmonicCount = scene.expose(
        'harmonic-count',
        Object.assign(new THREE.Group(), { text: 'N = 1' }),
        {
          description: 'Number of Fourier terms currently contributing to the reconstruction',
          tags: ['text', 'counter', 'dynamic']
        }
      )
      const harmonicLabels = await Promise.all(
        Array.from({ length: TERM_COUNT }, (_, index) =>
          createFastText(`N = ${index + 1}`, 1.35, 0xe2e8f0)
        )
      )
      harmonicLabels.forEach((label, index) => {
        label.visible = index === 0
        harmonicCount.add(label)
      })
      harmonicCount.position.set(-34, -22.5, 1)
      scene.add(harmonicCount)

      const convergence = await createFastText('more circles  →  sharper edges', 1.15, 0x94a3b8)
      convergence.position.set(22, -22.5, 1)
      scene.add(convergence)

      const epicycleCamera = scene.exposeCamera(
        'epicycles',
        new THREE.OrthographicCamera(-20, 20, 15, -15, 1, 100),
        {
          description: 'Close view of the rotating harmonic vector chain',
          tags: ['detail', 'epicycles']
        }
      )
      epicycleCamera.position.set(-32, -4, 30)
      epicycleCamera.lookAt(-32, -4, 0)

      const waveformCamera = scene.exposeCamera(
        'waveform',
        new THREE.OrthographicCamera(-31, 31, 15, -15, 1, 100),
        {
          description: 'Wide detail of the ideal square wave and its partial sum',
          tags: ['detail', 'waveform']
        }
      )
      waveformCamera.position.set(20, -4, 30)
      waveformCamera.lookAt(20, -4, 0)

      const tipCamera = scene.exposeCamera(
        'tip-follow',
        new THREE.OrthographicCamera(-10, 10, 7, -7, 1, 100),
        {
          description: 'Dynamic close-up centered on the summed harmonic vector',
          tags: ['dynamic', 'follow', 'tip']
        }
      )

      let displayedTerms = 1
      scene.onEachTick((frame) => {
        const phase = frame / 42
        const weights = Array.from({ length: TERM_COUNT }, (_, index) => revealWeight(frame, index))
        let center = BASE_CENTER.clone()

        for (let index = 0; index < TERM_COUNT; index++) {
          const odd = 2 * index + 1
          const radius = ((4 / Math.PI) * WAVE_AMPLITUDE * weights[index]) / odd
          const angle = odd * phase
          const next = center
            .clone()
            .add(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0))
          const visual = epicycles[index]
          visual.circle.visible = weights[index] > 0.002
          visual.radius.visible = weights[index] > 0.002
          visual.circle.position.copy(center)
          visual.circle.scale.setScalar(radius)
          visual.material.opacity = 0.18 + weights[index] * 0.72
          visual.radius.updatePositions(center, next)
          center = next
        }

        tip.position.copy(center)
        tip.position.z = 1
        connector.updatePositions(center, new THREE.Vector3(PLOT_START_X, center.y, 0))
        reconstructedWave.updatePoints(wavePoints(phase, weights, false))
        targetWave.updatePoints(wavePoints(phase, weights, true))

        const activeTerms = Math.max(
          1,
          weights.reduce((count, weight) => count + (weight > 0.5 ? 1 : 0), 0)
        )
        if (activeTerms !== displayedTerms) {
          displayedTerms = activeTerms
          harmonicCount.text = `N = ${displayedTerms}`
          harmonicLabels.forEach((label, index) => {
            label.visible = index === displayedTerms - 1
          })
        }

        tipCamera.position.set(center.x, center.y, 30)
        tipCamera.lookAt(center.x, center.y, 0)
      })

      scene.addAnims(wait((DURATION_MS) / 1000))
    }
  )
}

const addPlotGuides = (scene: AnimatedScene): void => {
  const horizontal = createLine({
    point1: new THREE.Vector3(PLOT_START_X, BASE_CENTER.y, -1),
    point2: new THREE.Vector3(PLOT_END_X, BASE_CENTER.y, -1),
    color: '#1e293b'
  })
  scene.add(horizontal)

  for (const amplitude of [-WAVE_AMPLITUDE, WAVE_AMPLITUDE]) {
    const guide = createLine({
      point1: new THREE.Vector3(PLOT_START_X, BASE_CENTER.y + amplitude, -1),
      point2: new THREE.Vector3(PLOT_END_X, BASE_CENTER.y + amplitude, -1),
      color: '#172033'
    })
    scene.add(guide)
  }
}

const unitCircleGeometry = (segments: number): THREE.BufferGeometry => {
  const points = Array.from({ length: segments }, (_, index) => {
    const angle = (index / segments) * Math.PI * 2
    return new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0)
  })
  return new THREE.BufferGeometry().setFromPoints(points)
}

const createDynamicLine = (
  pointCount: number,
  color: THREE.ColorRepresentation,
  opacity: number
): DynamicLine => {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pointCount * 3), 3))
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthTest: false
  })
  const line = new THREE.Line(geometry, material) as DynamicLine
  line.frustumCulled = false
  line.updatePoints = (points): void => {
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute
    for (let index = 0; index < pointCount; index++) {
      const point = points[index]
      positions.setXYZ(index, point.x, point.y, point.z)
    }
    positions.needsUpdate = true
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
  }
  return line
}

const wavePoints = (phase: number, weights: number[], ideal: boolean): THREE.Vector3[] =>
  Array.from({ length: PLOT_SAMPLES }, (_, index) => {
    const progress = index / (PLOT_SAMPLES - 1)
    const x = THREE.MathUtils.lerp(PLOT_START_X, PLOT_END_X, progress)
    const theta = phase - progress * Math.PI * 3.5
    const normalized = ideal
      ? Math.sign(Math.sin(theta))
      : weights.reduce((sum, weight, harmonicIndex) => {
          const odd = 2 * harmonicIndex + 1
          return sum + (weight * (4 / Math.PI) * Math.sin(odd * theta)) / odd
        }, 0)
    return new THREE.Vector3(x, BASE_CENTER.y + normalized * WAVE_AMPLITUDE, 0)
  })

const revealWeight = (frame: number, index: number): number => {
  if (index === 0) return 1
  const progress = THREE.MathUtils.clamp((frame - (45 + index * 58)) / 42, 0, 1)
  return progress * progress * (3 - 2 * progress)
}
