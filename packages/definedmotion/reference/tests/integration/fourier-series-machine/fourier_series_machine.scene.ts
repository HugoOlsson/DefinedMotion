import { AnimatedScene, SpaceSetting, defineScene, type ScreenBounds } from 'definedmotion'
import { camera, createAnimation, fadeIn, moveTo, scaleIn, wait } from 'definedmotion/animation'
import { createLatex, latex, queryLaTeXClass, type LatexVisual } from 'definedmotion/latex'
import {
  createCircle,
  createRectangle,
  createText,
  layout,
  type LayoutVisual,
  type TextVisual
} from 'definedmotion/rendering'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { MeshLine, MeshLineMaterial } from 'three.meshline'

export default defineScene({
  id: 'test-fourier-series-machine',
  name: 'Fourier Series Machine Integration Contract',
  isTest: true,
  create: testFourierSeriesMachine
})

const TERM_COUNT = 5
const HARMONICS = [1, 3, 5, 7, 9] as const
const BASE_RADIUS = 4.05
const MACHINE_CENTER = new THREE.Vector3(-7.45, 9, 0.62)
const ROTOR_DEPTH_STEP = 0.52
const WAVE_START_X = 1.15
const WAVE_END_X = 13.7
const WAVE_SAMPLES = 260
const TAU = Math.PI * 2

const COLORS = {
  background: '#070a0b',
  graphite: '#151a1b',
  graphiteLight: '#242b2c',
  ivory: '#eee9de',
  muted: '#9b9a92',
  bronze: '#aa6940',
  brass: '#c7a45c',
  steel: '#899493',
  green: '#829a76',
  trace: '#e3b95f'
} as const

const CAMERA_TARGET = new THREE.Vector3(0, 8.55, 0.45)
const CAMERA_POSES = {
  opening: pose(new THREE.Vector3(22, 17, 48), CAMERA_TARGET),
  overview: pose(new THREE.Vector3(15, 14, 42), CAMERA_TARGET),
  fundamental: pose(new THREE.Vector3(-1, 12, 30), new THREE.Vector3(-5.2, 9, 0.65)),
  harmonics: pose(new THREE.Vector3(4, 13, 38), new THREE.Vector3(-2.5, 9, 0.8)),
  synthesis: pose(new THREE.Vector3(15, 12, 36), new THREE.Vector3(2.2, 8.7, 0.7)),
  convergence: pose(new THREE.Vector3(8, 15, 42), new THREE.Vector3(2, 8.8, 0.7)),
  final: pose(new THREE.Vector3(18, 15.5, 46), new THREE.Vector3(0.8, 8.8, 0.7))
} as const

interface MaterialState {
  readonly material: THREE.Material
  readonly opacity: number
  readonly transparent: boolean
}

interface RotorAssembly {
  readonly root: THREE.Group
  readonly rotor: THREE.Group
  readonly tip: THREE.Mesh
  readonly radius: number
  readonly harmonic: number
  readonly materials: readonly MaterialState[]
}

interface RotorSpacer {
  readonly mesh: THREE.Mesh
  readonly material: MaterialState
}

interface MachineState {
  termReveal: number
  timelineProgress: number
  activeTerms: number
  jointError: number
  waveEndpointError: number
  waveFinite: boolean
  beatName: string
  beatProgress: number
}

interface WaveTrace {
  readonly root: THREE.Group
  readonly samples: Float32Array
  setPoints(points: readonly THREE.Vector3[]): void
}

interface FourierMachine {
  readonly root: THREE.Group
  readonly rotors: readonly RotorAssembly[]
  readonly rotorSpacers: readonly RotorSpacer[]
  readonly connector: THREE.Mesh
  readonly waveform: WaveTrace
  readonly state: MachineState
  readonly stateProbe: THREE.Group & { text: string }
}

interface CameraUi {
  readonly root: LayoutVisual
  readonly title: TextVisual
  readonly description: TextVisual
  readonly meterTrack: ReturnType<typeof createRectangle>
  readonly meterFill: ReturnType<typeof createRectangle>
  readonly fundamentalNote: TextVisual
  readonly convergenceNote: TextVisual
  readonly statusChip: LayoutVisual
  readonly statusDot: ReturnType<typeof createCircle>
  readonly statusLabel: TextVisual
}

interface WorldLabels {
  readonly titlePlaque: LayoutVisual
  readonly title: TextVisual
  readonly subtitle: TextVisual
  readonly formulaPlaque: LayoutVisual
  readonly formula: LatexVisual
  readonly drivePlaque: LayoutVisual
  readonly driveLabel: TextVisual
  readonly outputLabel: TextVisual
}

interface BeatFrames {
  readonly start: number
  readonly fundamental: number
  readonly harmonics: number
  readonly synthesis: number
  readonly convergence: number
  readonly resolve: number
  readonly end: number
}

export function testFourierSeriesMachine(): AnimatedScene {
  return new AnimatedScene(1280, 720, SpaceSetting.ThreeDim, async (scene) => {
    configureRenderer(scene)

    const studio = createStudio()
    const machine = createMachine()
    const labels = await createWorldLabels()
    const cameraUi = await createCameraUi()

    labels.titlePlaque.position.set(-7.8, 15.15, 0.52)
    labels.formulaPlaque.position.set(6.35, 15.15, 0.54)
    labels.drivePlaque.position.set(7.25, 1.58, 1.55)
    labels.outputLabel.position.set(7.4, 13.55, 0.7)

    cameraUi.root.position.set(-12.05, -1.85, -18)
    cameraUi.statusChip.position.set(9.5, -6.05, -18)
    makeCameraAttachedUi(cameraUi.root)
    makeCameraAttachedUi(cameraUi.statusChip)

    scene.add(studio.root, machine.root, labels.titlePlaque, labels.formulaPlaque)
    scene.add(labels.drivePlaque, labels.outputLabel)
    scene.camera.add(cameraUi.root, cameraUi.statusChip)
    scene.add(scene.camera)

    scene.camera.position.copy(CAMERA_POSES.opening.position)
    scene.camera.quaternion.copy(CAMERA_POSES.opening.rotation)
    if (scene.camera instanceof THREE.PerspectiveCamera) {
      scene.camera.fov = 43
      scene.camera.near = 0.1
      scene.camera.far = 250
      scene.camera.updateProjectionMatrix()
    }

    labels.formulaPlaque.visible = false
    cameraUi.fundamentalNote.visible = false
    cameraUi.convergenceNote.visible = false

    const frames: BeatFrames = {
      start: 0,
      fundamental: scene.secondsToFrames(5),
      harmonics: scene.secondsToFrames(10),
      synthesis: scene.secondsToFrames(17),
      convergence: scene.secondsToFrames(23),
      resolve: scene.secondsToFrames(27),
      end: scene.secondsToFrames(30)
    }

    scene.timeline.defineBeats({
      establish: { start: frames.start, end: frames.fundamental },
      fundamental: { start: frames.fundamental, end: frames.harmonics },
      harmonics: { start: frames.harmonics, end: frames.synthesis },
      synthesis: { start: frames.synthesis, end: frames.convergence },
      convergence: { start: frames.convergence, end: frames.resolve },
      resolve: { start: frames.resolve, end: frames.end }
    })

    const expandedFormula = String.raw`f(t)=\sum_{\dmClass{odd}{n=1,3,5,\ldots}}\dmClass{coefficient}{\frac{4}{\pi n}}\sin(\dmClass{frequency}{n\omega t})`
    const finalFormula = String.raw`\dmClass{result}{f_5(t)}=\frac{4}{\pi}\left(\sin t+\frac{\sin 3t}{3}+\cdots+\frac{\sin 9t}{9}\right)`
    const expandFormula = await latex.morphTo(labels.formula, {
      latex: expandedFormula,
      duration: 1.8,
      particleCount: 2500,
      easing: 'ease-in-out'
    })
    const resolveFormula = await latex.morphTo(labels.formula, {
      latex: finalFormula,
      duration: 1.8,
      particleCount: 2500,
      easing: 'ease-in-out'
    })

    // This full-duration plan is deliberately scheduled in the background by restoring the
    // global pointer. It drives the camera-attached progress rail without affecting narration.
    const narrativePointer = scene.getTimelinePointer()
    scene.addAnims(
      createAnimation({
        duration: 30,
        easing: 'linear',
        bind() {
          return {
            update({ linearProgress }) {
              machine.state.timelineProgress = linearProgress
            }
          }
        }
      })
    )
    scene.setTimelinePointer(narrativePointer)

    scene.timeline.beat('establish', (beat) => {
      scene.addAnims(
        camera.moveToPose(scene.camera, CAMERA_POSES.overview, {
          duration: 3.2,
          easing: 'ease-in-out',
          space: 'world'
        }),
        fadeIn(cameraUi.root, { duration: 0.75, easing: 'ease-out' }),
        fadeIn(cameraUi.statusChip, { duration: 0.55, easing: 'ease-out' }),
        scaleIn(labels.titlePlaque, { duration: 1, from: 0.94, easing: 'ease-out' })
      )
      scene.addAnims(wait(1.8))
      beat.onEachTick(({ beatProgress }) => {
        setBeatState(machine.state, 'establish', beatProgress)
        machine.state.termReveal = 1
      })
    })

    scene.timeline.beat('fundamental', (beat) => {
      scene.do(() => {
        labels.formulaPlaque.visible = true
        cameraUi.root.append(cameraUi.fundamentalNote)
        makeCameraAttachedUi(cameraUi.fundamentalNote)
      })
      scene.addAnims(
        camera.moveToPose(scene.camera, CAMERA_POSES.fundamental, {
          duration: 2.2,
          easing: 'ease-in-out',
          space: 'world'
        }),
        fadeIn(labels.formulaPlaque, { duration: 0.55, easing: 'ease-out' }),
        fadeIn(cameraUi.fundamentalNote, { duration: 0.45, easing: 'ease-out' })
      )
      scene.addAnims(latex.write(labels.formula, { duration: 1.2, easing: 'linear' }))
      scene.addAnims(
        latex.mark(labels.formula.part('amplitude'), {
          duration: 1,
          color: COLORS.bronze,
          pulses: 1,
          padding: 0.12
        })
      )
      scene.addAnims(wait(0.6))
      beat.onEachTick(({ beatProgress }) => {
        setBeatState(machine.state, 'fundamental', beatProgress)
        machine.state.termReveal = 1
      })
    })

    scene.timeline.beat('harmonics', (beat) => {
      scene.addAnims(
        camera.moveToPose(scene.camera, CAMERA_POSES.harmonics, {
          duration: 2.4,
          easing: 'ease-in-out',
          space: 'world'
        }),
        expandFormula,
        createAnimation({
          duration: 4.8,
          easing: 'ease-in-out',
          bind() {
            const from = machine.state.termReveal
            return {
              update({ easedProgress }) {
                machine.state.termReveal = THREE.MathUtils.lerp(from, TERM_COUNT, easedProgress)
              }
            }
          }
        })
      )
      scene.addAnims(
        latex.highlight(labels.formula.part('coefficient'), {
          duration: 1,
          color: COLORS.brass,
          pulses: 1
        })
      )
      scene.addAnims(wait(1.2))
      beat.onEachTick(({ beatProgress }) => {
        setBeatState(machine.state, 'harmonics', beatProgress)
      })
    })

    scene.timeline.beat('synthesis', (beat) => {
      scene.addAnims(
        camera.moveToPose(scene.camera, CAMERA_POSES.synthesis, {
          duration: 3,
          easing: 'ease-in-out',
          space: 'world'
        }),
        moveTo(labels.outputLabel, new THREE.Vector3(7.4, 13.55, 0.7), {
          from: new THREE.Vector3(8.4, 13.55, 0.7),
          duration: 1.1,
          easing: 'ease-out'
        }),
        fadeIn(labels.outputLabel, { duration: 0.55, easing: 'ease-out' })
      )
      scene.addAnims(
        latex.mark(labels.formula.part('odd'), {
          duration: 1,
          color: COLORS.green,
          pulses: 1,
          padding: 0.1
        })
      )
      scene.addAnims(wait(2))
      beat.onEachTick(({ beatProgress }) => {
        setBeatState(machine.state, 'synthesis', beatProgress)
        machine.state.termReveal = TERM_COUNT
      })
    })

    scene.timeline.beat('convergence', (beat) => {
      scene.do(() => {
        cameraUi.root.append(cameraUi.convergenceNote)
        makeCameraAttachedUi(cameraUi.convergenceNote)
      })
      scene.addAnims(
        camera.moveToPose(scene.camera, CAMERA_POSES.convergence, {
          duration: 3.4,
          easing: 'ease-in-out',
          space: 'world'
        }),
        fadeIn(cameraUi.convergenceNote, { duration: 0.45, easing: 'ease-out' })
      )
      scene.addAnims(wait(0.6))
      beat.onEachTick(({ beatProgress }) => {
        setBeatState(machine.state, 'convergence', beatProgress)
        machine.state.termReveal = Math.min(TERM_COUNT, 1 + Math.floor(beatProgress * TERM_COUNT))
      })
    })

    scene.timeline.beat('resolve', (beat) => {
      scene.addAnims(
        camera.moveToPose(scene.camera, CAMERA_POSES.final, {
          duration: 2.1,
          easing: 'ease-in-out',
          space: 'world'
        }),
        resolveFormula
      )
      scene.addAnims(
        latex.highlight(labels.formula.part('result'), {
          duration: 0.6,
          color: COLORS.trace,
          pulses: 1
        })
      )
      scene.addAnims(wait(0.3))
      beat.onEachTick(({ beatProgress }) => {
        setBeatState(machine.state, 'resolve', beatProgress)
        machine.state.termReveal = TERM_COUNT
      })
    })

    scene.onEachTick((globalFrame) => {
      updateMachine(machine, globalFrame, scene.fps)
      setMeterProgress(cameraUi, machine.state.timelineProgress)
    })

    exposeScene(scene, machine, labels, cameraUi, studio.root)
    addInspectionCameras(scene)
    registerVerifications(scene, frames, machine, labels, cameraUi, studio)
  })
}

const configureRenderer = (scene: AnimatedScene): void => {
  scene.scene.background = new THREE.Color(COLORS.background)
  scene.scene.fog = new THREE.Fog(COLORS.background, 48, 95)
  scene.renderer.shadowMap.enabled = true
  scene.renderer.shadowMap.type = THREE.PCFSoftShadowMap
  scene.renderer.toneMapping = THREE.ACESFilmicToneMapping
  scene.renderer.toneMappingExposure = 1.08
}

const createStudio = (): { root: THREE.Group; floor: THREE.Mesh; stage: THREE.Mesh } => {
  const root = new THREE.Group()
  root.name = 'FourierStudio'

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(78, 52),
    new THREE.MeshStandardMaterial({
      color: '#101415',
      roughness: 0.78,
      metalness: 0.12
    })
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.set(0, 0, -1.5)
  floor.receiveShadow = true

  const stage = new THREE.Mesh(
    new RoundedBoxGeometry(32.5, 0.78, 8.4, 8, 0.18),
    new THREE.MeshPhysicalMaterial({
      color: COLORS.graphite,
      roughness: 0.31,
      metalness: 0.58,
      clearcoat: 0.28,
      clearcoatRoughness: 0.34
    })
  )
  stage.position.set(0, 0.42, 0)
  stage.castShadow = true
  stage.receiveShadow = true

  const trim = new THREE.Mesh(
    new RoundedBoxGeometry(32.75, 0.08, 8.62, 5, 0.03),
    new THREE.MeshStandardMaterial({
      color: '#7f6547',
      roughness: 0.28,
      metalness: 0.88
    })
  )
  trim.position.set(0, 0.85, 0)
  trim.castShadow = true

  const backplate = new THREE.Mesh(
    new RoundedBoxGeometry(31.2, 16.6, 0.5, 8, 0.16),
    new THREE.MeshPhysicalMaterial({
      color: '#111617',
      roughness: 0.43,
      metalness: 0.34,
      clearcoat: 0.18,
      clearcoatRoughness: 0.42
    })
  )
  backplate.position.set(0, 8.65, -0.7)
  backplate.castShadow = true
  backplate.receiveShadow = true

  const inset = new THREE.Mesh(
    new RoundedBoxGeometry(30.65, 16, 0.14, 7, 0.12),
    new THREE.MeshStandardMaterial({
      color: '#0b0f10',
      roughness: 0.55,
      metalness: 0.22
    })
  )
  inset.position.set(0, 8.65, -0.39)
  inset.receiveShadow = true

  const key = new THREE.SpotLight('#fff0d7', 720, 100, Math.PI / 4.7, 0.55, 1.3)
  key.position.set(-14, 27, 25)
  key.target.position.set(-1, 8.5, 0)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.bias = -0.0002

  const rim = new THREE.DirectionalLight('#9ed3d3', 2.15)
  rim.position.set(22, 20, -16)
  rim.target.position.set(2, 9, 0)

  const warm = new THREE.PointLight('#d4854f', 32, 34, 2)
  warm.position.set(-8, 11, 8)
  const fill = new THREE.HemisphereLight('#ded9cc', '#0d1112', 0.78)

  root.add(floor, stage, trim, backplate, inset, key, key.target, rim, rim.target, warm, fill)
  return { root, floor, stage }
}

const createMachine = (): FourierMachine => {
  const root = new THREE.Group()
  root.name = 'FourierSeriesMachine'

  const supportMaterial = new THREE.MeshStandardMaterial({
    color: '#303738',
    roughness: 0.42,
    metalness: 0.72
  })
  const railMaterial = new THREE.MeshStandardMaterial({
    color: '#756448',
    roughness: 0.32,
    metalness: 0.82
  })

  const supportHeight = MACHINE_CENTER.y - 1.15
  const supportPost = new THREE.Mesh(
    new RoundedBoxGeometry(0.58, supportHeight, 0.72, 5, 0.09),
    supportMaterial
  )
  supportPost.name = 'RotorSupportPost'
  supportPost.position.set(MACHINE_CENTER.x, 1.15 + supportHeight / 2, -0.12)
  supportPost.castShadow = true

  const cantilever = new THREE.Mesh(
    new RoundedBoxGeometry(0.58, 0.58, 1.85, 5, 0.08),
    supportMaterial
  )
  cantilever.name = 'RotorCantileverArm'
  cantilever.position.set(MACHINE_CENTER.x, MACHINE_CENTER.y, -0.12)
  cantilever.castShadow = true

  const bearingHousing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.47, 0.47, 1.65, 36),
    railMaterial
  )
  bearingHousing.name = 'RotorBearingHousing'
  bearingHousing.rotation.x = Math.PI / 2
  bearingHousing.position.set(MACHINE_CENTER.x, MACHINE_CENTER.y, -0.12)
  bearingHousing.castShadow = true

  const verticalRail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 15.2, 0.18), railMaterial)
  verticalRail.position.set(MACHINE_CENTER.x, 8.7, -0.02)
  const horizontalRail = new THREE.Mesh(new THREE.BoxGeometry(13.15, 0.12, 0.18), railMaterial)
  horizontalRail.position.set((WAVE_START_X + WAVE_END_X) / 2, MACHINE_CENTER.y, -0.02)
  const leftFoot = new THREE.Mesh(new RoundedBoxGeometry(2.2, 0.38, 2.2, 5, 0.08), supportMaterial)
  leftFoot.position.set(MACHINE_CENTER.x, 1.12, 0)
  leftFoot.castShadow = true
  const outputFoot = new THREE.Mesh(
    new RoundedBoxGeometry(13.6, 0.32, 2.1, 5, 0.07),
    supportMaterial
  )
  outputFoot.position.set(7.35, 1.1, 0)
  outputFoot.castShadow = true

  const recorderPostGeometry = new RoundedBoxGeometry(0.18, MACHINE_CENTER.y - 1.22, 0.3, 4, 0.04)
  const recorderPosts = [WAVE_START_X, WAVE_END_X].map((x, index) => {
    const post = new THREE.Mesh(recorderPostGeometry, supportMaterial)
    post.name = `RecorderSupportPost${index + 1}`
    post.position.set(x, 1.22 + (MACHINE_CENTER.y - 1.22) / 2, -0.08)
    post.castShadow = true
    return post
  })

  const plaquePostGeometry = new RoundedBoxGeometry(0.13, 0.72, 0.16, 3, 0.025)
  const plaquePosts = [5.65, 8.85].map((x, index) => {
    const post = new THREE.Mesh(plaquePostGeometry, railMaterial)
    post.name = `DrivePlaqueSupport${index + 1}`
    post.position.set(x, 1.22, 1.28)
    post.castShadow = true
    return post
  })

  root.add(
    supportPost,
    cantilever,
    bearingHousing,
    verticalRail,
    horizontalRail,
    leftFoot,
    outputFoot,
    ...recorderPosts,
    ...plaquePosts
  )

  const colors = [COLORS.bronze, COLORS.brass, COLORS.steel, '#9b7657', '#c4b58e']
  const rotors = HARMONICS.map((harmonic, index) =>
    createRotor(BASE_RADIUS / harmonic, harmonic, colors[index], index)
  )
  root.add(...rotors.map((rotor) => rotor.root))

  const rotorSpacers = HARMONICS.slice(1).map((harmonic) => {
    const material = new THREE.MeshStandardMaterial({
      color: '#b8b6aa',
      roughness: 0.24,
      metalness: 0.9
    })
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1, 20), material)
    mesh.name = `RotorAxleSpacer${harmonic}`
    mesh.castShadow = true
    root.add(mesh)
    return {
      mesh,
      material: { material, opacity: material.opacity, transparent: material.transparent }
    }
  })

  const connector = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.075, 0.075),
    new THREE.MeshStandardMaterial({
      color: COLORS.trace,
      roughness: 0.28,
      metalness: 0.74,
      emissive: new THREE.Color(COLORS.trace).multiplyScalar(0.07)
    })
  )
  connector.castShadow = true
  root.add(connector)

  const waveform = createWaveTrace()
  root.add(waveform.root)

  const state: MachineState = {
    termReveal: 1,
    timelineProgress: 0,
    activeTerms: 1,
    jointError: 0,
    waveEndpointError: 0,
    waveFinite: true,
    beatName: 'establish',
    beatProgress: 0
  }
  const stateProbe = new THREE.Group() as THREE.Group & { text: string }
  stateProbe.name = 'FourierMachineState'
  stateProbe.text = ''
  root.add(stateProbe)
  return { root, rotors, rotorSpacers, connector, waveform, state, stateProbe }
}

const createRotor = (
  radius: number,
  harmonic: number,
  color: THREE.ColorRepresentation,
  index: number
): RotorAssembly => {
  const root = new THREE.Group()
  root.name = `HarmonicRotor${harmonic}`
  const rotor = new THREE.Group()
  root.add(rotor)

  const metal = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.27 + index * 0.025,
    metalness: 0.82,
    clearcoat: 0.24,
    clearcoatRoughness: 0.3
  })
  const darkMetal = new THREE.MeshStandardMaterial({
    color: index % 2 === 0 ? '#343a39' : '#2b302f',
    roughness: 0.36,
    metalness: 0.76
  })
  const bearingMaterial = new THREE.MeshStandardMaterial({
    color: '#b8b6aa',
    roughness: 0.24,
    metalness: 0.9
  })

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, Math.max(0.055, Math.min(0.105, radius * 0.055)), 14, 128),
    metal
  )
  ring.castShadow = true
  ring.receiveShadow = true

  const innerRing = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.92, Math.max(0.022, radius * 0.016), 10, 96),
    darkMetal
  )
  innerRing.position.z = -0.035

  const arm = new THREE.Mesh(
    new RoundedBoxGeometry(radius, Math.max(0.1, radius * 0.055), 0.14, 4, 0.035),
    metal
  )
  arm.position.x = radius / 2
  arm.castShadow = true

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(
      Math.max(0.13, radius * 0.075),
      Math.max(0.13, radius * 0.075),
      0.38,
      28
    ),
    bearingMaterial
  )
  hub.rotation.x = Math.PI / 2
  hub.position.z = 0.02
  hub.castShadow = true

  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(Math.max(0.1, radius * 0.065), 22, 16),
    bearingMaterial
  )
  tip.position.set(radius, 0, 0.04)
  tip.castShadow = true

  const toothGeometry = new THREE.BoxGeometry(
    Math.max(0.08, radius * 0.045),
    Math.max(0.035, radius * 0.022),
    0.09
  )
  const toothCount = Math.max(16, Math.round(radius * 11))
  const teeth = new THREE.InstancedMesh(toothGeometry, darkMetal, toothCount)
  const transform = new THREE.Matrix4()
  const quaternion = new THREE.Quaternion()
  for (let toothIndex = 0; toothIndex < toothCount; toothIndex++) {
    const angle = (toothIndex / toothCount) * TAU
    quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle)
    transform.compose(
      new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, -0.015),
      quaternion,
      new THREE.Vector3(1, 1, 1)
    )
    teeth.setMatrixAt(toothIndex, transform)
  }
  teeth.instanceMatrix.needsUpdate = true
  teeth.castShadow = true

  rotor.add(ring, innerRing, arm, hub, tip, teeth)
  return {
    root,
    rotor,
    tip,
    radius,
    harmonic,
    materials: collectMaterialStates(root)
  }
}

const createWaveTrace = (): WaveTrace => {
  const root = new THREE.Group()
  root.name = 'FourierWaveTrace'
  const line = new MeshLine()
  const glowLine = new MeshLine()
  const initial = [WAVE_START_X, MACHINE_CENTER.y, 0.72, WAVE_END_X, MACHINE_CENTER.y, 0.72]
  line.setPoints(initial, false)
  glowLine.setPoints(initial, false)
  const material = new MeshLineMaterial({
    color: COLORS.trace,
    lineWidth: 0.085,
    transparent: true,
    opacity: 0.98,
    depthTest: true,
    sizeAttenuation: 1
  })
  const glowMaterial = new MeshLineMaterial({
    color: COLORS.trace,
    lineWidth: 0.19,
    transparent: true,
    opacity: 0.13,
    depthTest: true,
    depthWrite: false,
    sizeAttenuation: 1
  })
  const glow = new THREE.Mesh(glowLine.geometry, glowMaterial)
  glow.position.z = -0.01
  const trace = new THREE.Mesh(line.geometry, material)
  trace.castShadow = true

  const paper = new THREE.Mesh(
    new RoundedBoxGeometry(WAVE_END_X - WAVE_START_X + 0.7, 8.8, 0.18, 6, 0.11),
    new THREE.MeshPhysicalMaterial({
      color: '#171c1d',
      roughness: 0.48,
      metalness: 0.24,
      clearcoat: 0.16,
      clearcoatRoughness: 0.44
    })
  )
  paper.position.set((WAVE_START_X + WAVE_END_X) / 2, MACHINE_CENTER.y, -0.18)
  paper.receiveShadow = true

  const gridMaterial = new THREE.LineBasicMaterial({
    color: '#4a5352',
    transparent: true,
    opacity: 0.32
  })
  const grid = new THREE.Group()
  for (let index = 0; index <= 8; index++) {
    const y = MACHINE_CENTER.y - 4 + index
    grid.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(WAVE_START_X, y, 0.68),
          new THREE.Vector3(WAVE_END_X, y, 0.68)
        ]),
        gridMaterial
      )
    )
  }
  for (let index = 0; index <= 8; index++) {
    const x = THREE.MathUtils.lerp(WAVE_START_X, WAVE_END_X, index / 8)
    grid.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, MACHINE_CENTER.y - 4, 0.68),
          new THREE.Vector3(x, MACHINE_CENTER.y + 4, 0.68)
        ]),
        gridMaterial
      )
    )
  }
  root.add(paper, grid, glow, trace)

  const samples = new Float32Array(WAVE_SAMPLES * 3)
  return {
    root,
    samples,
    setPoints(points) {
      const flattened: number[] = []
      points.forEach((point, index) => {
        samples.set([point.x, point.y, point.z], index * 3)
        flattened.push(point.x, point.y, point.z)
      })
      line.setPoints(flattened, false)
      glowLine.setPoints(flattened, false)
      root.userData.sampleCount = points.length
    }
  }
}

const createWorldLabels = async (): Promise<WorldLabels> => {
  const title = await createText({
    text: 'FOURIER SERIES MACHINE',
    fontSize: 0.72,
    color: COLORS.ivory,
    anchorX: 'left',
    anchorY: 'top'
  })
  const subtitle = await createText({
    text: 'ROTATION IN  •  PERIODIC SHAPE OUT',
    fontSize: 0.24,
    color: COLORS.muted,
    anchorX: 'left',
    anchorY: 'top'
  })
  const titlePlaque = layout.flex(
    {
      flexDirection: 'column',
      width: 12.2,
      height: 2.5,
      gap: 0.22,
      padding: 0.48,
      alignItems: 'flex-start',
      justifyContent: 'center',
      anchorX: 'center',
      anchorY: 'middle',
      background: '#111515',
      border: { color: '#6e5c43', width: 0.045 }
    },
    [title, subtitle]
  )
  titlePlaque.name = 'FourierMachineTitlePlaque'

  const formula = await createLatex({
    latex: String.raw`f(t)=\dmClass{amplitude}{a_1}\sin(\dmClass{frequency}{\omega t})`,
    fontSize: 0.76,
    color: COLORS.ivory
  })
  const formulaPlaque = layout.flex(
    {
      flexDirection: 'column',
      width: 15.6,
      height: 3.3,
      padding: 0.38,
      alignItems: 'center',
      justifyContent: 'center',
      anchorX: 'center',
      anchorY: 'middle',
      background: '#111515',
      border: { color: '#6e5c43', width: 0.045 }
    },
    [formula]
  )
  formulaPlaque.name = 'FourierFormulaPlaque'

  const driveLabel = await createText({
    text: 'ODD HARMONIC DRIVE  ·  1  3  5  7  9',
    fontSize: 0.3,
    color: '#c9c3b7',
    anchorX: 'left',
    anchorY: 'middle'
  })
  const drivePlaque = layout.flex(
    {
      flexDirection: 'row',
      gap: 0,
      padding: 0.34,
      alignItems: 'center',
      anchorX: 'center',
      anchorY: 'middle',
      background: '#0d1010',
      border: { color: '#59605d', width: 0.035 }
    },
    [driveLabel]
  )
  drivePlaque.name = 'HarmonicDrivePlaque'

  const outputLabel = await createText({
    text: 'COMPOSITE OUTPUT',
    fontSize: 0.3,
    color: COLORS.muted,
    anchorX: 'center',
    anchorY: 'middle'
  })
  outputLabel.visible = false
  return {
    titlePlaque,
    title,
    subtitle,
    formulaPlaque,
    formula,
    drivePlaque,
    driveLabel,
    outputLabel
  }
}

const createCameraUi = async (): Promise<CameraUi> => {
  const eyebrow = await createText({
    text: 'SYNTHESIS  /  FRAME',
    fontSize: 0.2,
    color: COLORS.muted,
    anchorX: 'left',
    anchorY: 'top'
  })
  const title = await createText({
    text: 'Fourier series',
    fontSize: 0.52,
    color: COLORS.ivory,
    anchorX: 'left',
    anchorY: 'top'
  })
  const description = await createText({
    text: 'Odd rotors add into one trace.',
    fontSize: 0.23,
    color: '#aaa79f',
    maxWidth: 3.5,
    lineHeight: 1.28,
    textAlign: 'left',
    anchorX: 'left',
    anchorY: 'top'
  })
  const fundamentalNote = await createText({
    text: '01  Fundamental motion.',
    fontSize: 0.22,
    color: COLORS.bronze,
    anchorX: 'left',
    anchorY: 'top'
  })
  const convergenceNote = await createText({
    text: '05  Sharper corners.',
    fontSize: 0.22,
    color: COLORS.trace,
    anchorX: 'left',
    anchorY: 'top'
  })

  const meterTrack = createRectangle(3.5, 0.07, { color: '#343837' })
  const meterFill = createRectangle(3.5, 0.07, { color: COLORS.trace })
  meterFill.position.set(-1.75, 0, 0.02)
  meterFill.scale.x = 0
  meterTrack.add(meterFill)

  const root = layout.flex(
    {
      flexDirection: 'column',
      width: 4.3,
      gap: 0.28,
      padding: 0.34,
      alignItems: 'flex-start',
      anchorX: 'left',
      anchorY: 'top',
      background: '#0a0d0d',
      border: { color: '#4e5552', width: 0.035 }
    },
    [eyebrow, title, description, meterTrack]
  )
  root.name = 'FourierCameraAttachedPanel'

  const statusDot = createCircle(0.075, { color: COLORS.green })
  const statusLabel = await createText({
    text: 'LIVE  /  DETERMINISTIC',
    fontSize: 0.24,
    color: '#d4d0c7',
    anchorX: 'left',
    anchorY: 'middle'
  })
  const statusChip = layout.flex(
    {
      flexDirection: 'row',
      gap: 0.2,
      padding: 0.28,
      alignItems: 'center',
      anchorX: 'center',
      anchorY: 'middle',
      background: '#0a0d0d',
      border: { color: '#4e5552', width: 0.035 }
    },
    [statusDot, statusLabel]
  )
  statusChip.name = 'FourierCameraStatusChip'
  return {
    root,
    title,
    description,
    meterTrack,
    meterFill,
    fundamentalNote,
    convergenceNote,
    statusChip,
    statusDot,
    statusLabel
  }
}

const updateMachine = (machine: FourierMachine, globalFrame: number, fps: number): void => {
  const phase = (globalFrame / fps) * TAU * 0.115
  const centers: THREE.Vector3[] = []
  const tips: THREE.Vector3[] = []
  let planarCenter = MACHINE_CENTER.clone()
  let activeTip = MACHINE_CENTER.clone()

  machine.rotors.forEach((assembly, index) => {
    const reveal = THREE.MathUtils.clamp(machine.state.termReveal - index, 0, 1)
    const angle = phase * assembly.harmonic
    const depth =
      index === 0
        ? MACHINE_CENTER.z
        : MACHINE_CENTER.z + ROTOR_DEPTH_STEP * (index - 1 + reveal)
    const center = new THREE.Vector3(planarCenter.x, planarCenter.y, depth)
    assembly.root.position.copy(center)
    assembly.root.scale.setScalar(reveal)
    assembly.root.visible = reveal > 0.001
    assembly.rotor.rotation.z = angle
    setMaterialReveal(assembly.materials, reveal)
    centers.push(center.clone())
    planarCenter = planarCenter
      .clone()
      .add(new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0).multiplyScalar(assembly.radius * reveal))
    const tip = new THREE.Vector3(planarCenter.x, planarCenter.y, depth)
    tips.push(tip)
    if (reveal > 0.001) activeTip = tip
  })

  machine.rotorSpacers.forEach((spacer, index) => {
    const nextRotorIndex = index + 1
    const reveal = THREE.MathUtils.clamp(machine.state.termReveal - nextRotorIndex, 0, 1)
    spacer.mesh.visible = reveal > 0.001
    setMaterialReveal([spacer.material], reveal)
    if (spacer.mesh.visible) {
      setCylinderBetween(spacer.mesh, tips[index], centers[nextRotorIndex])
    }
  })

  const finalTip = new THREE.Vector3(planarCenter.x, planarCenter.y, activeTip.z)
  setBeamBetween(
    machine.connector,
    finalTip,
    new THREE.Vector3(WAVE_START_X, finalTip.y, 0.72)
  )

  const waveformPoints: THREE.Vector3[] = []
  let finite = true
  for (let index = 0; index < WAVE_SAMPLES; index++) {
    const amount = index / (WAVE_SAMPLES - 1)
    const samplePhase = phase - amount * TAU
    let y = MACHINE_CENTER.y
    machine.rotors.forEach((assembly, rotorIndex) => {
      const reveal = THREE.MathUtils.clamp(machine.state.termReveal - rotorIndex, 0, 1)
      y += assembly.radius * reveal * Math.sin(samplePhase * assembly.harmonic)
    })
    const point = new THREE.Vector3(THREE.MathUtils.lerp(WAVE_START_X, WAVE_END_X, amount), y, 0.72)
    finite &&= point.toArray().every(Number.isFinite)
    waveformPoints.push(point)
  }
  machine.waveform.setPoints(waveformPoints)

  machine.root.updateWorldMatrix(true, true)
  let jointError = 0
  for (let index = 1; index < machine.rotors.length; index++) {
    const expected = machine.rotors[index - 1].tip.getWorldPosition(new THREE.Vector3())
    const actual = machine.rotors[index].root.getWorldPosition(new THREE.Vector3())
    // The mathematical epicycle joints meet in x/y. Their intentional z separation is bridged
    // by the visible axle spacers and is verified independently.
    expected.z = actual.z
    jointError = Math.max(jointError, expected.distanceTo(actual))
  }

  machine.state.activeTerms = Math.max(
    1,
    Math.min(TERM_COUNT, Math.ceil(machine.state.termReveal - 1e-6))
  )
  machine.state.jointError = jointError
  machine.state.waveEndpointError = Math.abs(waveformPoints[0].y - finalTip.y)
  machine.state.waveFinite = finite
  machine.stateProbe.text = JSON.stringify({
    beat: machine.state.beatName,
    beatProgress: Number(machine.state.beatProgress.toFixed(3)),
    activeTerms: machine.state.activeTerms,
    termReveal: Number(machine.state.termReveal.toFixed(3)),
    jointError: Number(machine.state.jointError.toExponential(2)),
    waveEndpointError: Number(machine.state.waveEndpointError.toExponential(2))
  })
}

const setMaterialReveal = (states: readonly MaterialState[], reveal: number): void => {
  states.forEach((state) => {
    state.material.opacity = state.opacity * reveal
    state.material.transparent = reveal < 0.999 ? true : state.transparent
  })
}

const setBeamBetween = (beam: THREE.Mesh, start: THREE.Vector3, end: THREE.Vector3): void => {
  const delta = end.clone().sub(start)
  beam.position.copy(start).add(end).multiplyScalar(0.5)
  beam.scale.set(delta.length(), 1, 1)
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), delta.normalize())
}

const setCylinderBetween = (
  cylinder: THREE.Mesh,
  start: THREE.Vector3,
  end: THREE.Vector3
): void => {
  const delta = end.clone().sub(start)
  cylinder.position.copy(start).add(end).multiplyScalar(0.5)
  cylinder.scale.set(1, delta.length(), 1)
  cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize())
}

const collectMaterialStates = (object: THREE.Object3D): MaterialState[] => {
  const result: MaterialState[] = []
  const seen = new Set<THREE.Material>()
  object.traverse((child) => {
    const material = (child as THREE.Object3D & { material?: THREE.Material | THREE.Material[] })
      .material
    for (const current of Array.isArray(material) ? material : material ? [material] : []) {
      if (seen.has(current)) continue
      seen.add(current)
      result.push({
        material: current,
        opacity: current.opacity,
        transparent: current.transparent
      })
    }
  })
  return result
}

const setBeatState = (state: MachineState, name: string, beatProgress: number): void => {
  state.beatName = name
  state.beatProgress = beatProgress
}

const setMeterProgress = (cameraUi: CameraUi, progress: number): void => {
  const clamped = THREE.MathUtils.clamp(progress, 0, 1)
  cameraUi.meterFill.scale.x = clamped
  cameraUi.meterFill.position.x = -1.75 + (3.5 * clamped) / 2
}

const makeCameraAttachedUi = (root: THREE.Object3D): void => {
  root.traverse((object) => {
    object.renderOrder = 100
    const material = (object as THREE.Object3D & { material?: THREE.Material | THREE.Material[] })
      .material
    for (const current of Array.isArray(material) ? material : material ? [material] : []) {
      current.depthTest = false
      current.depthWrite = false
    }
  })
}

const exposeScene = (
  scene: AnimatedScene,
  machine: FourierMachine,
  labels: WorldLabels,
  cameraUi: CameraUi,
  studioRoot: THREE.Object3D
): void => {
  scene.expose('fourier-machine', machine.root, {
    description: 'Complete physical epicycle apparatus and output recorder'
  })
  machine.rotors.forEach((rotor) => {
    scene.expose(`fourier-rotor-${rotor.harmonic}`, rotor.root, {
      data: { harmonic: rotor.harmonic, radius: rotor.radius }
    })
  })
  machine.rotorSpacers.forEach((spacer, index) => {
    scene.expose(`fourier-rotor-spacer-${index + 1}`, spacer.mesh, {
      data: { depthStep: ROTOR_DEPTH_STEP }
    })
  })
  scene.expose('fourier-waveform', machine.waveform.root)
  scene.expose('fourier-machine-state', machine.stateProbe)
  scene.expose('fourier-world-title-layout', labels.titlePlaque)
  scene.expose('fourier-formula-layout', labels.formulaPlaque)
  scene.expose('fourier-formula', labels.formula, { data: { semanticParts: true } })
  scene.expose('fourier-drive-layout', labels.drivePlaque)
  scene.expose('fourier-output-label', labels.outputLabel)
  scene.expose('fourier-camera-ui-layout', cameraUi.root)
  scene.expose('fourier-camera-ui-meter', cameraUi.meterFill)
  scene.expose('fourier-camera-ui-status', cameraUi.statusChip)
  scene.expose('fourier-camera-ui-fundamental-note', cameraUi.fundamentalNote)
  scene.expose('fourier-camera-ui-convergence-note', cameraUi.convergenceNote)

  scene.watchCollisions('fourier-camera-ui', cameraUi.root, { ignore: [studioRoot] })
  scene.watchCollisions('fourier-camera-status', cameraUi.statusChip, { ignore: [studioRoot] })
}

const addInspectionCameras = (scene: AnimatedScene): void => {
  const overview = scene.exposeCamera(
    'apparatus-overview',
    new THREE.PerspectiveCamera(38, scene.width / scene.height, 0.1, 250),
    {
      description: 'Straight apparatus overview for inspecting rotor continuity and layout',
      tags: ['overview', 'apparatus', 'mechanical']
    }
  )
  overview.position.set(0, 11.5, 48)
  overview.lookAt(0, 8.6, 0.7)

  const mechanism = scene.exposeCamera(
    'mechanism-detail',
    new THREE.PerspectiveCamera(34, scene.width / scene.height, 0.1, 250),
    {
      description: 'Close oblique view of the nested harmonic rotor train',
      tags: ['detail', 'rotors', 'three-dimensional']
    }
  )
  mechanism.position.set(-18, 12.5, 25)
  mechanism.lookAt(-5.1, 8.7, 1.15)

  const recorder = scene.exposeCamera(
    'wave-recorder',
    new THREE.PerspectiveCamera(34, scene.width / scene.height, 0.1, 250),
    {
      description: 'Recorder view for checking the linkage and synthesized waveform',
      tags: ['detail', 'waveform', 'output']
    }
  )
  recorder.position.set(17, 12, 34)
  recorder.lookAt(5.5, 8.8, 0.7)

  const rotorDepth = scene.exposeCamera(
    'rotor-depth',
    new THREE.PerspectiveCamera(32, scene.width / scene.height, 0.1, 250),
    {
      description: 'Side-oblique inspection of the stepped rotor planes and axle spacers',
      tags: ['detail', 'rotors', 'depth', 'physical-clearance']
    }
  )
  rotorDepth.position.set(-17, 11.2, 18)
  rotorDepth.lookAt(-5.2, 8.5, 1.25)
}

const registerVerifications = (
  scene: AnimatedScene,
  frames: BeatFrames,
  machine: FourierMachine,
  labels: WorldLabels,
  cameraUi: CameraUi,
  studio: { root: THREE.Group; floor: THREE.Mesh; stage: THREE.Mesh }
): void => {
  scene.verify(
    'fourier-machine-duration-and-beats',
    { frames: { start: frames.end - 1, end: frames.end } },
    (context) => {
      context.assert(
        scene.totalSceneTicks === frames.end,
        'The integration scene must last 30 seconds',
        {
          durationInFrames: scene.totalSceneTicks,
          expectedFrames: frames.end,
          fps: scene.fps
        }
      )
      context.assert(context.beat?.name === 'resolve', 'The final frame must belong to resolve', {
        beat: context.beat
      })
    }
  )

  scene.verify(
    'fourier-machine-kinematic-continuity',
    { frames: { start: frames.start, end: frames.end } },
    (context) => {
      context.assert(
        machine.state.jointError < 1e-5,
        'Every rotor center must remain attached to the preceding rotor tip',
        { frame: context.globalFrame, jointError: machine.state.jointError }
      )
      context.assert(machine.state.waveFinite, 'Every waveform sample must remain finite', {
        frame: context.globalFrame
      })
      context.assert(
        machine.state.waveEndpointError < 1e-5,
        'The recorder trace must begin at the mechanical tip height',
        { frame: context.globalFrame, endpointError: machine.state.waveEndpointError }
      )
    }
  )

  scene.verify(
    'fourier-camera-ui-in-viewport',
    { frames: { start: frames.start, end: frames.end } },
    (context) => {
      const panelBounds = context.screenBounds(cameraUi.root)
      const statusBounds = context.screenBounds(cameraUi.statusChip)
      context.assert(
        insideViewport(panelBounds, context.viewport.width, context.viewport.height, 22),
        'The camera-attached explainer panel must remain inside the viewport',
        { panelBounds }
      )
      context.assert(
        insideViewport(statusBounds, context.viewport.width, context.viewport.height, 22),
        'The camera-attached status chip must remain inside the viewport',
        { statusBounds }
      )
      context.assert(
        panelBounds !== null &&
          statusBounds !== null &&
          panelBounds.right + 20 <= statusBounds.left,
        'The two camera-attached layout surfaces must remain separated',
        { panelBounds, statusBounds }
      )
    }
  )

  scene.verify(
    'fourier-camera-ui-layout-containment',
    { frames: { start: frames.start, end: frames.end } },
    (context) => {
      const rootBounds = context.screenBounds(cameraUi.root)
      const children = [cameraUi.title, cameraUi.description, cameraUi.meterTrack]
      if (cameraUi.fundamentalNote.parent) children.push(cameraUi.fundamentalNote)
      if (cameraUi.convergenceNote.parent) children.push(cameraUi.convergenceNote)
      const childBounds = children.map((child) => context.screenBounds(child))
      context.assert(
        childBounds.every((bounds) => containsWithMargin(rootBounds, bounds, 5)),
        'The layout-owned camera panel must contain every appended item',
        { rootBounds, childBounds, requiredMargin: 5 }
      )
      const chipBounds = context.screenBounds(cameraUi.statusChip)
      context.assert(
        containsWithMargin(chipBounds, context.screenBounds(cameraUi.statusDot), 4) &&
          containsWithMargin(chipBounds, context.screenBounds(cameraUi.statusLabel), 4),
        'The layout-owned status chip must contain its dot and label',
        { chipBounds }
      )
    }
  )

  scene.verify(
    'fourier-formula-layout-containment',
    { frames: { start: frames.fundamental, end: frames.end } },
    (context) => {
      context.assert(
        containsWithMargin(
          context.screenBounds(labels.formulaPlaque),
          context.screenBounds(labels.formula),
          4
        ),
        'The changing LaTeX expression must remain inside its world-space layout surface',
        {
          plaqueBounds: context.screenBounds(labels.formulaPlaque),
          formulaBounds: context.screenBounds(labels.formula)
        }
      )
    }
  )

  scene.verify(
    'fourier-fundamental-semantic-part',
    { frames: { start: frames.fundamental + 1, end: frames.harmonics } },
    (context) => {
      context.assert(
        queryLaTeXClass(labels.formula, 'amplitude') !== null,
        'The fundamental amplitude handle must resolve before the formula morph',
        { frame: context.globalFrame, latex: labels.formula.latex }
      )
    }
  )

  const expandedFormulaFrame = frames.harmonics + scene.secondsToFrames(1.8)
  scene.verify(
    'fourier-expanded-semantic-parts',
    { frames: { start: expandedFormulaFrame, end: frames.resolve } },
    (context) => {
      context.assert(
        queryLaTeXClass(labels.formula, 'odd') !== null &&
          queryLaTeXClass(labels.formula, 'coefficient') !== null,
        'Odd-index and coefficient handles must survive the expanded formula state',
        { frame: context.globalFrame, latex: labels.formula.latex }
      )
    }
  )

  scene.verify('fourier-convergence-term-count', { during: 'convergence' }, (context) => {
    const expected = Math.min(
      TERM_COUNT,
      1 + Math.floor((context.beat?.beatProgress ?? 0) * TERM_COUNT)
    )
    context.assert(
      machine.state.activeTerms === expected,
      'The convergence beat must expose the term count implied by beatProgress',
      { frame: context.globalFrame, expected, activeTerms: machine.state.activeTerms }
    )
  })

  scene.verify(
    'fourier-final-formula-and-terms',
    { frames: { start: frames.end - 1, end: frames.end } },
    (context) => {
      context.assert(machine.state.activeTerms === TERM_COUNT, 'All five rotors must be active', {
        activeTerms: machine.state.activeTerms
      })
      context.assert(
        queryLaTeXClass(labels.formula, 'result') !== null,
        'The final five-term expression must expose its semantic result handle',
        { frame: context.globalFrame, latex: labels.formula.latex }
      )
    }
  )

  verifyCameraPose(
    scene,
    'fourier-camera-overview-pose',
    frames.start + scene.secondsToFrames(3.2) - 1,
    CAMERA_POSES.overview
  )
  verifyCameraPose(
    scene,
    'fourier-camera-fundamental-pose',
    frames.fundamental + scene.secondsToFrames(2.2) - 1,
    CAMERA_POSES.fundamental
  )
  verifyCameraPose(
    scene,
    'fourier-camera-final-pose',
    frames.resolve + scene.secondsToFrames(2.1) - 1,
    CAMERA_POSES.final
  )

  scene.verify(
    'fourier-machine-physical-grounding',
    { frames: { start: frames.start, end: frames.start + 1 } },
    (context) => {
      const floorBounds = context.worldBounds(studio.floor)
      const stageBounds = context.worldBounds(studio.stage)
      context.assert(
        Math.abs(stageBounds.min.y - floorBounds.max.y) < 0.06,
        'The exhibit stage must make contact with the studio floor',
        { floorTop: floorBounds.max.y, stageBottom: stageBounds.min.y }
      )
    }
  )

  scene.verify(
    'fourier-rotors-clear-stage',
    { frames: { start: frames.start, end: frames.end } },
    (context) => {
      const stageTop = context.worldBounds(studio.stage).max.y
      const visibleRotorBounds = machine.rotors
        .filter((rotor) => rotor.root.visible)
        .map((rotor) => ({ harmonic: rotor.harmonic, bounds: context.worldBounds(rotor.root) }))
      const minimumClearance = Math.min(
        ...visibleRotorBounds.map(({ bounds }) => bounds.min.y - stageTop)
      )
      context.assert(
        minimumClearance >= 0.15,
        'Every visible rotor must remain physically clear of the exhibit stage',
        {
          frame: context.globalFrame,
          stageTop,
          minimumClearance,
          rotors: visibleRotorBounds.map(({ harmonic, bounds }) => ({
            harmonic,
            bottom: bounds.min.y
          }))
        }
      )
    }
  )

  scene.verify(
    'fourier-rotor-depth-separated',
    { frames: { start: frames.synthesis, end: frames.convergence } },
    (context) => {
      const centers = machine.rotors.map((rotor) =>
        rotor.root.getWorldPosition(new THREE.Vector3())
      )
      const separations = centers.slice(1).map((center, index) => center.z - centers[index].z)
      context.assert(
        separations.every((separation) => Math.abs(separation - ROTOR_DEPTH_STEP) < 1e-5),
        'Each fully revealed rotor must occupy its own depth plane',
        {
          frame: context.globalFrame,
          expectedDepthStep: ROTOR_DEPTH_STEP,
          separations
        }
      )
      context.assert(
        machine.rotorSpacers.every((spacer) => spacer.mesh.visible),
        'A visible axle spacer must bridge every separated rotor plane',
        { frame: context.globalFrame }
      )
    }
  )

  scene.verify(
    'fourier-drive-plaque-clear-stage',
    { frames: { start: frames.start, end: frames.end } },
    (context) => {
      const stageTop = context.worldBounds(studio.stage).max.y
      const plaqueBottom = context.worldBounds(labels.drivePlaque).min.y
      context.assert(
        plaqueBottom >= stageTop + 0.08,
        'The harmonic-drive plaque must remain mounted above the stage surface',
        {
          frame: context.globalFrame,
          stageTop,
          plaqueBottom,
          clearance: plaqueBottom - stageTop
        }
      )
    }
  )
}

const verifyCameraPose = (
  scene: AnimatedScene,
  id: string,
  frame: number,
  expected: { position: THREE.Vector3; rotation: THREE.Quaternion }
): void => {
  scene.verify(id, { frames: { start: frame, end: frame + 1 } }, (context) => {
    const positionError = scene.camera.position.distanceTo(expected.position)
    const rotationError = scene.camera.quaternion.angleTo(expected.rotation)
    context.assert(
      positionError < 1e-6 && rotationError < 1e-6,
      'The camera must reach the authored pose exactly at the animation endpoint',
      { frame: context.globalFrame, positionError, rotationError }
    )
  })
}

const insideViewport = (
  bounds: ScreenBounds | null,
  width: number,
  height: number,
  margin: number
): boolean =>
  bounds !== null &&
  bounds.left >= margin &&
  bounds.right <= width - margin &&
  bounds.top >= margin &&
  bounds.bottom <= height - margin

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

function pose(
  position: THREE.Vector3,
  target: THREE.Vector3
): { position: THREE.Vector3; rotation: THREE.Quaternion } {
  return {
    position,
    rotation: new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().lookAt(position, target, new THREE.Vector3(0, 1, 0))
    )
  }
}
