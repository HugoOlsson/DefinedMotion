import {
  AnimatedScene,
  SpaceSetting,
  defineScene,
  type ScreenBounds
} from 'definedmotion'
import {
  camera,
  fadeIn,
  rotateTo,
  scaleIn,
  scaleTo,
  wait
} from 'definedmotion/animation'
import { createRectangle, createText, layout } from 'definedmotion/rendering'
import * as THREE from 'three'

export default defineScene({
  id: 'test-animated-3d-camera-ui',
  name: 'Animated 3D Camera-Attached UI Contract',
  isTest: true,
  create: testAnimated3dCameraUi
})

const SUBJECT_POSITION = new THREE.Vector3(3.6, 0.15, 0)
const START_POSITION = new THREE.Vector3(10.5, 6.4, 18)
const ORBIT_POSITION = new THREE.Vector3(-5.5, 5.2, 18.5)
const FOCUS_POSITION = new THREE.Vector3(3.2, 3.4, 12.5)
const START_ROTATION = cameraRotation(START_POSITION, new THREE.Vector3(1.2, 0.2, 0))
const ORBIT_ROTATION = cameraRotation(ORBIT_POSITION, new THREE.Vector3(1.3, 0.2, 0))
const FOCUS_ROTATION = cameraRotation(FOCUS_POSITION, new THREE.Vector3(1.7, 0.2, 0))

export function testAnimated3dCameraUi(): AnimatedScene {
  return new AnimatedScene(
    1200,
    675,
    SpaceSetting.ThreeDim,
    async (scene) => {
      scene.scene.background = new THREE.Color('#050813')
      scene.renderer.shadowMap.enabled = true

      const subject = createFieldCore()
      subject.root.position.copy(SUBJECT_POSITION)
      const stage = createStage()
      const lights = createLights()

      const cameraUi = await createCameraUi()
      cameraUi.root.position.set(-8.4, 3.4, -18)
      const statusChip = await createStatusChip()
      statusChip.position.set(9.8, 6.25, -18)
      const reticle = createReticle()
      reticle.position.set(4.1, 0.35, -18)
      makeCameraOverlay(cameraUi.root)
      makeCameraOverlay(statusChip)
      makeCameraOverlay(reticle)

      const callout = await createWorldCallout()
      callout.root.position.copy(SUBJECT_POSITION)

      scene.add(stage, ...lights, subject.root)
      scene.camera.add(cameraUi.root, statusChip, reticle)
      scene.add(scene.camera)

      scene.camera.position.copy(START_POSITION)
      scene.camera.quaternion.copy(START_ROTATION)
      if (scene.camera instanceof THREE.PerspectiveCamera) {
        scene.camera.fov = 46
        scene.camera.updateProjectionMatrix()
      }

      scene.expose('animated-camera-ui-panel', cameraUi.panel)
      scene.expose('animated-camera-ui-content', cameraUi.content)
      scene.expose('animated-camera-ui-meter', cameraUi.meterFill)
      scene.expose('animated-camera-ui-focus-note', cameraUi.focusNote)
      scene.expose('animated-camera-ui-status-chip', statusChip)
      scene.expose('animated-camera-ui-subject', subject.root)
      scene.expose('animated-camera-ui-world-callout', callout.pill)

      const beatFrames = {
        start: 0,
        orbit: scene.secondsToFrames(1.5),
        focus: scene.secondsToFrames(4.5),
        hold: scene.secondsToFrames(6.5),
        end: scene.secondsToFrames(7)
      }

      scene.timeline.defineBeats({
        establish: { start: beatFrames.start, end: beatFrames.orbit },
        orbit: { start: beatFrames.orbit, end: beatFrames.focus },
        focus: { start: beatFrames.focus, end: beatFrames.hold },
        hold: { start: beatFrames.hold, end: beatFrames.end }
      })

      scene.timeline.beat('establish', (beat) => {
        scene.addAnims(
          fadeIn(cameraUi.root, { duration: 0.55, easing: 'ease-out' }),
          fadeIn(statusChip, { duration: 0.4, easing: 'ease-out' }),
          scaleIn(subject.root, { duration: 1.15, from: 0.82, easing: 'ease-out' })
        )
        scene.addAnims(wait(0.35))

        beat.onEachTick(({ beatProgress }) => {
          subject.rings.rotation.y = beatProgress * 0.45
          subject.rings.rotation.z = beatProgress * 0.12
          setMeterProgress(cameraUi, THREE.MathUtils.lerp(0.12, 0.36, beatProgress))
        })
      })

      scene.timeline.beat('orbit', (beat) => {
        scene.do(() => scene.add(callout.root))
        scene.addAnims(
          camera.moveToPose(
            scene.camera,
            { position: ORBIT_POSITION, rotation: ORBIT_ROTATION },
            { duration: 2.6, easing: 'ease-in-out', space: 'world' }
          ),
          rotateTo(subject.body, new THREE.Euler(0.14, Math.PI * 0.7, -0.05), {
            duration: 2.6,
            easing: 'ease-in-out'
          }),
          fadeIn(callout.root, { duration: 0.55, easing: 'ease-out' })
        )
        scene.addAnims(wait(0.4))

        beat.onEachTick(({ beatProgress }) => {
          subject.rings.rotation.y = THREE.MathUtils.lerp(0.45, 2.55, beatProgress)
          subject.rings.rotation.z = THREE.MathUtils.lerp(0.12, 0.48, beatProgress)
          setMeterProgress(cameraUi, THREE.MathUtils.lerp(0.36, 0.78, beatProgress))
        })
      })

      scene.timeline.beat('focus', (beat) => {
        scene.do(() => {
          cameraUi.content.append(cameraUi.focusNote)
          makeCameraOverlay(cameraUi.focusNote)
        })
        scene.addAnims(
          camera.moveToPose(
            scene.camera,
            { position: FOCUS_POSITION, rotation: FOCUS_ROTATION },
            { duration: 1.6, easing: 'ease-in-out', space: 'world' }
          ),
          scaleTo(subject.glow, 1.16, { duration: 1.2, easing: 'ease-out' }),
          fadeIn(cameraUi.focusNote, { duration: 0.4, easing: 'ease-out' })
        )
        scene.addAnims(wait(0.4))

        beat.onEachTick(({ beatProgress }) => {
          subject.rings.rotation.y = THREE.MathUtils.lerp(2.55, 3.25, beatProgress)
          subject.rings.rotation.z = THREE.MathUtils.lerp(0.48, 0.62, beatProgress)
          setMeterProgress(cameraUi, THREE.MathUtils.lerp(0.78, 1, beatProgress))
        })
      })

      scene.timeline.beat('hold', (beat) => {
        scene.addAnims(wait(0.5))
        beat.onEachTick(({ beatProgress }) => {
          subject.rings.rotation.y = THREE.MathUtils.lerp(3.25, 3.42, beatProgress)
          subject.rings.rotation.z = THREE.MathUtils.lerp(0.62, 0.66, beatProgress)
          setMeterProgress(cameraUi, 1)
        })
      })

      const cameraWorldRotation = new THREE.Quaternion()
      scene.onEachTick(() => {
        scene.camera.getWorldQuaternion(cameraWorldRotation)
        callout.pill.quaternion.copy(cameraWorldRotation)
      })

      registerVerifications(
        scene,
        {
          cameraUi,
          statusChip,
          subject: subject.root,
          callout: callout.pill
        },
        beatFrames
      )
    }
  )
}

interface CameraUiVisuals {
  root: THREE.Group
  panel: THREE.Mesh
  content: ReturnType<typeof layout.flex>
  focusNote: Awaited<ReturnType<typeof createText>>
  meterFill: THREE.Mesh
  meterWidth: number
}

const createCameraUi = async (): Promise<CameraUiVisuals> => {
  const eyebrow = await createText({
    text: 'ORBITAL MONITOR  /  ARRAY 07',
    fontSize: 0.34,
    color: '#67e8f9',
    anchorX: 'left',
    anchorY: 'top'
  })
  const title = await createText({
    text: 'MAGNETIC CORE',
    fontSize: 0.78,
    color: '#f8fafc',
    anchorX: 'left',
    anchorY: 'top'
  })
  const description = await createText({
    text: 'Field geometry remains locked while the observation camera moves.',
    fontSize: 0.3,
    color: '#94a3b8',
    maxWidth: 7.2,
    lineHeight: 1.25,
    textAlign: 'left',
    anchorX: 'left',
    anchorY: 'top'
  })
  const metrics = layout.flex(
    {
      flexDirection: 'row',
      width: 7.2,
      gap: 0.45,
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      anchorX: 'left',
      anchorY: 'top'
    },
    await Promise.all([
      createMetric('STABILITY', '98.4%', '#67e8f9'),
      createMetric('FIELD', '2.4 T', '#a78bfa'),
      createMetric('LOCK', 'ACTIVE', '#4ade80')
    ])
  )
  const focusNote = await createText({
    text: 'FOCUS LOCK CONFIRMED',
    fontSize: 0.3,
    color: '#4ade80',
    anchorX: 'left',
    anchorY: 'top'
  })
  const content = layout.flex(
    {
      flexDirection: 'column',
      width: 7.2,
      height: 4.4,
      gap: 0.34,
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      anchorX: 'center',
      anchorY: 'middle'
    },
    [eyebrow, title, description, metrics]
  )
  content.position.y = 0.55

  const root = new THREE.Group()
  root.name = 'AnimatedCameraAttachedUi'
  const panel = createRectangle(8.8, 6.5, {
    material: new THREE.MeshBasicMaterial({
      color: '#0b1220',
      transparent: true,
      opacity: 0.94
    }),
    stroke: { color: '#28415f', width: 0.08, placement: 'inside' }
  })
  panel.position.z = -0.08
  const accent = createRectangle(0.08, 5.9, { color: '#22d3ee' })
  accent.position.set(-4.14, 0, 0.02)
  const scanLabel = await createText({
    text: 'SCAN PROGRESS',
    fontSize: 0.25,
    color: '#64748b',
    anchorX: 'left',
    anchorY: 'middle'
  })
  scanLabel.position.set(-3.6, -2.18, 0.02)
  const meterWidth = 7.2
  const meterTrack = createRectangle(meterWidth, 0.13, { color: '#1e293b' })
  meterTrack.position.set(0, -2.62, 0.02)
  const meterFill = createRectangle(meterWidth, 0.13, { color: '#22d3ee' })
  meterFill.position.set(-meterWidth / 2, -2.62, 0.03)
  meterFill.scale.x = 0
  root.add(panel, accent, content, scanLabel, meterTrack, meterFill)
  return { root, panel, content, focusNote, meterFill, meterWidth }
}

const createMetric = async (
  labelText: string,
  valueText: string,
  color: THREE.ColorRepresentation
) => {
  const label = await createText({
    text: labelText,
    fontSize: 0.23,
    color: '#64748b',
    anchorX: 'left',
    anchorY: 'top'
  })
  const value = await createText({
    text: valueText,
    fontSize: 0.5,
    color,
    anchorX: 'left',
    anchorY: 'top'
  })
  return layout.flex(
    {
      flexDirection: 'column',
      width: 2.1,
      gap: 0.12,
      alignItems: 'flex-start',
      anchorX: 'left',
      anchorY: 'top'
    },
    [label, value]
  )
}

const createStatusChip = async (): Promise<THREE.Group> => {
  const root = new THREE.Group()
  root.name = 'CameraStatusChip'
  const panel = createRectangle(3.2, 1, {
    material: new THREE.MeshBasicMaterial({
      color: '#0b1220',
      transparent: true,
      opacity: 0.9
    }),
    stroke: { color: '#1e3a5f', width: 0.06, placement: 'inside' }
  })
  panel.position.z = -0.04
  const dot = new THREE.Mesh(
    new THREE.CircleGeometry(0.11, 20),
    new THREE.MeshBasicMaterial({ color: '#4ade80' })
  )
  dot.position.set(-1.18, 0, 0.02)
  const label = await createText({
    text: 'LIVE  /  TRACKING',
    fontSize: 0.3,
    color: '#dbeafe',
    anchorX: 'left',
    anchorY: 'middle'
  })
  label.position.set(-0.9, 0, 0.02)
  root.add(panel, dot, label)
  return root
}

const createFieldCore = () => {
  const root = new THREE.Group()
  root.name = 'FieldCoreAssembly'
  const body = new THREE.Group()
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.65, 4),
    new THREE.MeshPhysicalMaterial({
      color: '#0891b2',
      emissive: '#07334b',
      emissiveIntensity: 1.7,
      roughness: 0.18,
      metalness: 0.35,
      clearcoat: 1,
      clearcoatRoughness: 0.12
    })
  )
  core.castShadow = true
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(1.28, 48, 32),
    new THREE.MeshBasicMaterial({
      color: '#a5f3fc',
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  )
  body.add(core, glow)

  const rings = new THREE.Group()
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: '#67e8f9',
    transparent: true,
    opacity: 0.72,
    depthWrite: false
  })
  const ringA = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.035, 10, 160), ringMaterial)
  const ringB = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.025, 10, 160), ringMaterial)
  const ringC = new THREE.Mesh(new THREE.TorusGeometry(2.85, 0.02, 10, 160), ringMaterial)
  ringA.rotation.set(Math.PI / 2.8, 0.25, 0)
  ringB.rotation.set(-Math.PI / 3.5, 0.1, Math.PI / 2.2)
  ringC.rotation.set(Math.PI / 2, Math.PI / 5, -0.25)
  rings.add(ringA, ringB, ringC)

  const particleMaterial = new THREE.MeshBasicMaterial({ color: '#c4b5fd' })
  for (let index = 0; index < 12; index++) {
    const angle = (index / 12) * Math.PI * 2
    const particle = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), particleMaterial)
    particle.position.set(Math.cos(angle) * 2.55, Math.sin(angle) * 2.55, 0)
    rings.add(particle)
  }

  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(2.1, 2.45, 0.45, 64),
    new THREE.MeshStandardMaterial({ color: '#172033', roughness: 0.3, metalness: 0.75 })
  )
  collar.position.y = -2.35
  collar.castShadow = true
  collar.receiveShadow = true
  root.add(body, rings, collar)
  return { root, body, rings, glow }
}

const createStage = (): THREE.Group => {
  const root = new THREE.Group()
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(42, 28),
    new THREE.MeshStandardMaterial({ color: '#070d18', roughness: 0.82, metalness: 0.08 })
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -2.58
  floor.receiveShadow = true
  const grid = new THREE.GridHelper(34, 34, '#16334d', '#0d1b2c')
  grid.position.y = -2.56
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(2.8, 5.2, 96),
    new THREE.MeshBasicMaterial({
      color: '#0e7490',
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  )
  halo.rotation.x = -Math.PI / 2
  halo.position.set(SUBJECT_POSITION.x, -2.53, SUBJECT_POSITION.z)
  root.add(floor, grid, halo)
  return root
}

const createLights = (): THREE.Light[] => {
  const ambient = new THREE.HemisphereLight('#8ec5ff', '#07101c', 1.25)
  const key = new THREE.DirectionalLight('#dbeafe', 4.2)
  key.position.set(8, 10, 12)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  const rim = new THREE.PointLight('#22d3ee', 42, 24, 2)
  rim.position.set(-4, 4, -5)
  const accent = new THREE.PointLight('#a78bfa', 28, 18, 2)
  accent.position.set(7, 2, 5)
  return [ambient, key, rim, accent]
}

const createWorldCallout = async () => {
  const root = new THREE.Group()
  root.name = 'WorldFieldCallout'
  const leaderGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(1.4, 1, 0),
    new THREE.Vector3(2.35, 1.8, 0)
  ])
  const leader = new THREE.Line(
    leaderGeometry,
    new THREE.LineBasicMaterial({ color: '#67e8f9', transparent: true, opacity: 0.75 })
  )
  const pill = new THREE.Group()
  pill.position.set(3.25, 2.08, 0)
  const panel = createRectangle(3.9, 1.05, {
    material: new THREE.MeshBasicMaterial({
      color: '#07111f',
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide
    }),
    stroke: { color: '#22d3ee', width: 0.05, placement: 'inside' }
  })
  panel.position.z = -0.02
  const label = await createText({
    text: 'FIELD CORE  /  2.4 T',
    fontSize: 0.34,
    color: '#cffafe'
  })
  pill.add(panel, label)
  root.add(leader, pill)
  return { root, pill }
}

const createReticle = (): THREE.LineSegments => {
  const points = [
    -1.1, 0.7, 0, -0.7, 0.7, 0,
    -1.1, 0.7, 0, -1.1, 0.3, 0,
    1.1, 0.7, 0, 0.7, 0.7, 0,
    1.1, 0.7, 0, 1.1, 0.3, 0,
    -1.1, -0.7, 0, -0.7, -0.7, 0,
    -1.1, -0.7, 0, -1.1, -0.3, 0,
    1.1, -0.7, 0, 0.7, -0.7, 0,
    1.1, -0.7, 0, 1.1, -0.3, 0
  ]
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  return new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({ color: '#67e8f9', transparent: true, opacity: 0.55 })
  )
}

const makeCameraOverlay = (root: THREE.Object3D): void => {
  root.traverse((object) => {
    object.renderOrder = 100
    const candidate = object as THREE.Object3D & {
      material?: THREE.Material | THREE.Material[]
    }
    const materials = Array.isArray(candidate.material)
      ? candidate.material
      : candidate.material
        ? [candidate.material]
        : []
    for (const material of materials) {
      material.depthTest = false
      material.depthWrite = false
    }
  })
}

const setMeterProgress = (cameraUi: CameraUiVisuals, progress: number): void => {
  const clamped = THREE.MathUtils.clamp(progress, 0, 1)
  cameraUi.meterFill.scale.x = clamped
  cameraUi.meterFill.position.x = -cameraUi.meterWidth / 2 + (cameraUi.meterWidth * clamped) / 2
}

function cameraRotation(position: THREE.Vector3, target: THREE.Vector3): THREE.Quaternion {
  return new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().lookAt(position, target, new THREE.Vector3(0, 1, 0))
  )
}

const registerVerifications = (
  scene: AnimatedScene,
  visuals: {
    cameraUi: CameraUiVisuals
    statusChip: THREE.Object3D
    subject: THREE.Object3D
    callout: THREE.Object3D
  },
  frames: { start: number; orbit: number; focus: number; hold: number; end: number }
): void => {
  scene.verify(
    'animated-camera-ui-inside-viewport',
    { frames: { start: frames.start, end: frames.end } },
    (context) => {
      const panelBounds = context.screenBounds(visuals.cameraUi.panel)
      const statusBounds = context.screenBounds(visuals.statusChip)
      context.assert(
        insideViewport(panelBounds, context.viewport.width, context.viewport.height, 24),
        'The primary camera-attached panel must remain inside the viewport',
        { panelBounds }
      )
      context.assert(
        insideViewport(statusBounds, context.viewport.width, context.viewport.height, 24),
        'The camera-attached status chip must remain inside the viewport',
        { statusBounds }
      )
    }
  )
  scene.verify(
    'animated-camera-ui-content-contained',
    { frames: { start: frames.start, end: frames.end } },
    (context) => {
      const panelBounds = context.screenBounds(visuals.cameraUi.panel)
      const contentBounds = context.screenBounds(visuals.cameraUi.content)
      context.assert(
        containsWithMargin(panelBounds, contentBounds, 18),
        'Nested camera-attached UI layout must remain within the camera-attached panel',
        { panelBounds, contentBounds, requiredMargin: 18 }
      )
    }
  )
  scene.verify(
    'animated-camera-ui-screen-lock',
    { frames: { start: frames.start, end: frames.end } },
    (context) => {
      const bounds = context.screenBounds(visuals.cameraUi.panel)
      const centerX = bounds ? (bounds.left + bounds.right) / 2 : Number.NaN
      const centerY = bounds ? (bounds.top + bounds.bottom) / 2 : Number.NaN
      context.assert(
        bounds !== null &&
          Math.abs(centerX - 229.2) <= 2 &&
          Math.abs(centerY - 187.4) <= 2 &&
          Math.abs(bounds.width - 388.8) <= 3 &&
          Math.abs(bounds.height - 287) <= 3,
        'Camera movement must not move or resize camera-attached UI in screen space',
        { bounds, expectedCenter: [229.2, 187.4], expectedSize: [388.8, 287] }
      )
    }
  )
  scene.verify(
    'animated-camera-ui-world-content-separated',
    { frames: { start: frames.orbit, end: frames.end } },
    (context) => {
      const panelBounds = context.screenBounds(visuals.cameraUi.panel)
      const subjectBounds = context.screenBounds(visuals.subject)
      const calloutBounds = context.screenBounds(visuals.callout)
      context.assert(
        panelBounds !== null && subjectBounds !== null && panelBounds.right + 18 <= subjectBounds.left,
        'The 3D subject must remain visually separated from the camera-attached UI panel',
        { panelBounds, subjectBounds }
      )
      context.assert(
        panelBounds !== null && calloutBounds !== null && panelBounds.right + 18 <= calloutBounds.left,
        'The world-space label must remain visually separated from the camera-attached UI panel',
        { panelBounds, calloutBounds }
      )
    }
  )
  scene.verify(
    'animated-camera-ui-focus-note-attached',
    { frames: { start: frames.focus, end: frames.end } },
    (context) => {
      context.assert(
        visuals.cameraUi.focusNote.parent !== null &&
          containsWithMargin(
            context.screenBounds(visuals.cameraUi.panel),
            context.screenBounds(visuals.cameraUi.focusNote),
            18
          ),
        'The runtime-appended focus state must be attached and contained by the camera-attached UI',
        { attached: visuals.cameraUi.focusNote.parent !== null }
      )
    }
  )
  verifyCameraPose(scene, 'animated-camera-ui-orbit-pose', frames.focus - 1, ORBIT_POSITION, ORBIT_ROTATION)
  verifyCameraPose(scene, 'animated-camera-ui-focus-pose', frames.hold - 1, FOCUS_POSITION, FOCUS_ROTATION)
}

const verifyCameraPose = (
  scene: AnimatedScene,
  id: string,
  frame: number,
  expectedPosition: THREE.Vector3,
  expectedRotation: THREE.Quaternion
): void => {
  scene.verify(id, { frames: { start: frame, end: frame + 1 } }, (context) => {
    const positionError = scene.camera.position.distanceTo(expectedPosition)
    const rotationError = scene.camera.quaternion.angleTo(expectedRotation)
    context.assert(
      positionError < 1e-6 && rotationError < 1e-6,
      'The authored camera pose must reach its exact endpoint',
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
