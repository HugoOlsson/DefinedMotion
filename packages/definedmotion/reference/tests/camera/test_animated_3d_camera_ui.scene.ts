import { AnimatedScene, SpaceSetting, defineScene, type ScreenBounds } from 'definedmotion'
import { camera, fadeIn, rotateTo, scaleIn, scaleTo, wait } from 'definedmotion/animation'
import { createCircle, createRectangle, createText, layout } from 'definedmotion/rendering'
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
  return new AnimatedScene(1200, 675, SpaceSetting.ThreeDim, async (scene) => {
    scene.scene.background = new THREE.Color('#070706')
    scene.renderer.shadowMap.enabled = true

    const subject = createFieldCore()
    subject.root.position.copy(SUBJECT_POSITION)
    const stage = createStage()
    const lights = createLights()

    const cameraUi = await createCameraUi()
    cameraUi.root.position.set(-8.4, 3.4, -18)
    const statusChip = await createStatusChip()
    statusChip.root.position.set(9.8, 6.25, -18)

    const callout = await createWorldCallout()
    callout.root.position.copy(SUBJECT_POSITION)

    scene.add(stage, ...lights, subject.root)
    scene.addCameraAttachedUI(cameraUi.root)
    scene.addCameraAttachedUI(statusChip.root)

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
    scene.expose('animated-camera-ui-status-chip', statusChip.root)
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
        fadeIn(statusChip.root, { duration: 0.4, easing: 'ease-out' }),
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
  })
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
    text: 'Magnetic field',
    fontSize: 0.34,
    color: '#aaa59d',
    anchorX: 'left',
    anchorY: 'top'
  })
  const title = await createText({
    text: '2.4 T',
    fontSize: 1.15,
    color: '#f1ede5',
    anchorX: 'left',
    anchorY: 'top'
  })
  const description = await createText({
    text: 'The camera moves around the apparatus. This reading stays fixed to the frame.',
    fontSize: 0.3,
    color: '#918d86',
    maxWidth: 7.2,
    lineHeight: 1.25,
    textAlign: 'left',
    anchorX: 'left',
    anchorY: 'top'
  })
  const focusNote = await createText({
    text: 'Focus acquired.',
    fontSize: 0.3,
    color: '#d4aa55',
    anchorX: 'left',
    anchorY: 'top'
  })
  const content = layout.flex(
    {
      flexDirection: 'column',
      width: 7.2,
      height: 4.1,
      gap: 0.34,
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      anchorX: 'center',
      anchorY: 'middle'
    },
    [eyebrow, title, description]
  )
  content.position.y = 0.3

  const root = new THREE.Group()
  root.name = 'AnimatedCameraAttachedUi'
  const panel = createRectangle(8.8, 5.6, {
    material: new THREE.MeshBasicMaterial({
      color: '#090908',
      transparent: true,
      opacity: 0.74
    })
  })
  panel.position.z = -0.08
  const scanLabel = await createText({
    text: 'camera path',
    fontSize: 0.25,
    color: '#77736d',
    anchorX: 'left',
    anchorY: 'middle'
  })
  scanLabel.position.set(-3.6, -1.82, 0.02)
  const meterWidth = 7.2
  const meterTrack = createRectangle(meterWidth, 0.08, { color: '#302e2a' })
  meterTrack.position.set(0, -2.25, 0.02)
  const meterFill = createRectangle(meterWidth, 0.08, { color: '#d4aa55' })
  meterFill.position.set(-meterWidth / 2, -2.25, 0.03)
  meterFill.scale.x = 0
  root.add(panel, content, scanLabel, meterTrack, meterFill)
  return { root, panel, content, focusNote, meterFill, meterWidth }
}

interface StatusChipVisuals {
  root: ReturnType<typeof layout.flex>
  dot: ReturnType<typeof createCircle>
  label: Awaited<ReturnType<typeof createText>>
}

const createStatusChip = async (): Promise<StatusChipVisuals> => {
  const dot = createCircle(0.09, { color: '#91a779' })
  dot.position.z = 0.02
  const label = await createText({
    text: 'tracking',
    fontSize: 0.3,
    color: '#d2cdc4',
    anchorX: 'left',
    anchorY: 'middle'
  })
  label.position.z = 0.02
  const root = layout.flex(
    {
      flexDirection: 'row',
      gap: 0.22,
      padding: 0.28,
      alignItems: 'center',
      anchorX: 'center',
      anchorY: 'middle',
      background: '#090908'
    },
    [dot, label]
  )
  root.name = 'CameraStatusChip'
  return { root, dot, label }
}

const createFieldCore = () => {
  const root = new THREE.Group()
  root.name = 'FieldApparatus'
  const body = new THREE.Group()
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(1.55, 1.55, 0.62, 72),
    new THREE.MeshPhysicalMaterial({
      color: '#9b6038',
      roughness: 0.28,
      metalness: 0.78,
      clearcoat: 0.35,
      clearcoatRoughness: 0.32
    })
  )
  core.rotation.z = Math.PI / 2
  core.castShadow = true
  core.receiveShadow = true

  const axle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 4.5, 28),
    new THREE.MeshStandardMaterial({ color: '#8f918f', roughness: 0.24, metalness: 0.86 })
  )
  axle.rotation.z = Math.PI / 2
  axle.castShadow = true

  const glow = new THREE.Mesh(
    new THREE.TorusGeometry(1.82, 0.045, 12, 128),
    new THREE.MeshStandardMaterial({ color: '#d5b47a', roughness: 0.3, metalness: 0.72 })
  )
  glow.rotation.y = Math.PI / 2
  body.add(core, axle, glow)

  const rings = new THREE.Group()
  const outerRingMaterial = new THREE.MeshStandardMaterial({
    color: '#686a68',
    roughness: 0.34,
    metalness: 0.82
  })
  const innerRingMaterial = new THREE.MeshStandardMaterial({
    color: '#b57849',
    roughness: 0.3,
    metalness: 0.78
  })
  const ringA = new THREE.Mesh(new THREE.TorusGeometry(2.65, 0.085, 16, 160), outerRingMaterial)
  const ringB = new THREE.Mesh(new THREE.TorusGeometry(2.18, 0.065, 16, 160), innerRingMaterial)
  ringA.rotation.set(Math.PI / 2.8, 0.25, 0)
  ringB.rotation.set(-Math.PI / 3.5, 0.1, Math.PI / 2.2)
  ringA.castShadow = true
  ringB.castShadow = true
  rings.add(ringA, ringB)

  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.75, 2.15, 0.42, 64),
    new THREE.MeshStandardMaterial({ color: '#242422', roughness: 0.38, metalness: 0.68 })
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
    new THREE.MeshStandardMaterial({ color: '#11110f', roughness: 0.76, metalness: 0.12 })
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -2.58
  floor.receiveShadow = true
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(3.25, 3.55, 0.32, 80),
    new THREE.MeshStandardMaterial({ color: '#1d1d1a', roughness: 0.46, metalness: 0.48 })
  )
  plinth.position.set(SUBJECT_POSITION.x, -2.42, SUBJECT_POSITION.z)
  plinth.castShadow = true
  plinth.receiveShadow = true
  root.add(floor, plinth)
  return root
}

const createLights = (): THREE.Light[] => {
  const ambient = new THREE.HemisphereLight('#d8d2c5', '#12110e', 0.82)
  const key = new THREE.DirectionalLight('#fff1d5', 4.1)
  key.position.set(8, 10, 12)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  const rim = new THREE.PointLight('#8ea3ad', 19, 24, 2)
  rim.position.set(-4, 4, -5)
  const accent = new THREE.PointLight('#c47742', 16, 18, 2)
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
    new THREE.LineBasicMaterial({ color: '#b7b0a5', transparent: true, opacity: 0.72 })
  )
  const pill = new THREE.Group()
  pill.position.set(3.25, 2.08, 0)
  const panel = createRectangle(3.9, 1.05, {
    material: new THREE.MeshBasicMaterial({
      color: '#070706',
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide
    })
  })
  panel.position.z = -0.02
  const label = await createText({
    text: 'rotor axis',
    fontSize: 0.34,
    color: '#d4cec4'
  })
  pill.add(panel, label)
  root.add(leader, pill)
  return { root, pill }
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
    statusChip: StatusChipVisuals
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
      const statusBounds = context.screenBounds(visuals.statusChip.root)
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
    'animated-camera-ui-status-chip-contained',
    { frames: { start: frames.start, end: frames.end } },
    (context) => {
      const chipBounds = context.screenBounds(visuals.statusChip.root)
      const dotBounds = context.screenBounds(visuals.statusChip.dot)
      const labelBounds = context.screenBounds(visuals.statusChip.label)
      context.assert(
        containsWithMargin(chipBounds, dotBounds, 4) &&
          containsWithMargin(chipBounds, labelBounds, 4),
        'The layout-owned camera-attached status surface must contain its content',
        { chipBounds, dotBounds, labelBounds, requiredMargin: 4 }
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
          Math.abs(bounds.height - 247.2) <= 3,
        'Camera movement must not move or resize camera-attached UI in screen space',
        { bounds, expectedCenter: [229.2, 187.4], expectedSize: [388.8, 247.2] }
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
        panelBounds !== null &&
          subjectBounds !== null &&
          panelBounds.right + 18 <= subjectBounds.left,
        'The 3D subject must remain visually separated from the camera-attached UI panel',
        { panelBounds, subjectBounds }
      )
      context.assert(
        panelBounds !== null &&
          calloutBounds !== null &&
          panelBounds.right + 18 <= calloutBounds.left,
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
  verifyCameraPose(
    scene,
    'animated-camera-ui-orbit-pose',
    frames.focus - 1,
    ORBIT_POSITION,
    ORBIT_ROTATION
  )
  verifyCameraPose(
    scene,
    'animated-camera-ui-focus-pose',
    frames.hold - 1,
    FOCUS_POSITION,
    FOCUS_ROTATION
  )
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
