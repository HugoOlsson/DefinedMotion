/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const projectRoot = dirname(scriptDirectory)
const cli = join(scriptDirectory, 'definedmotion.mjs')
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'definedmotion-smoke-'))

function run(arguments_, expectSuccess = true) {
  const result = spawnSync(process.execPath, [cli, ...arguments_, '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit']
  })

  if (!result.stdout) throw new Error(`CLI returned no JSON for: ${arguments_.join(' ')}`)
  const parsed = JSON.parse(result.stdout)
  if (expectSuccess && (result.status !== 0 || !parsed.success)) {
    throw new Error(parsed.error?.message ?? `CLI failed with code ${result.status}`)
  }
  return parsed
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

try {
  const scenes = run(['scenes'])
  if (scenes.scenes.length !== 48) {
    throw new Error(`Expected 48 automatically discovered scenes, received ${scenes.scenes.length}`)
  }
  if (!scenes.scenes.some((scene) => scene.id === 'fourier-series' && scene.isDefault)) {
    throw new Error('Configured default scene was not discoverable')
  }
  if (
    !scenes.scenes.some((scene) => scene.id === 'test-camera-waypoints-sequential' && scene.isTest)
  ) {
    throw new Error('Visual test scenes were not discoverable with isTest metadata')
  }

  const scenesWithoutTests = run(['scenes', '--exclude-tests', '--no-build'])
  if (
    scenesWithoutTests.scenes.length !== 12 ||
    scenesWithoutTests.scenes.some((scene) => scene.isTest)
  ) {
    throw new Error('--exclude-tests did not return exactly the 12 non-test scenes')
  }

  const emittedMedia = readdirSync(join(projectRoot, 'out', 'renderer', 'assets')).filter((file) =>
    /\.(?:glb|gltf|hdr|mp3|mp4|webm|woff2?|ttf)$/i.test(file)
  )
  if (emittedMedia.length > 0) {
    throw new Error(`Scene media was eagerly emitted by Vite: ${emittedMedia.join(', ')}`)
  }

  const assetOutput = join(temporaryDirectory, 'asset-reference.png')
  const assetResult = run([
    'still',
    'test-asset-references',
    '--frame',
    '0',
    '--output',
    assetOutput,
    '--no-build'
  ])
  if (assetResult.durationInFrames !== 1) {
    throw new Error('Asset reference test did not render its expected one-frame scene')
  }

  const firstOutput = join(temporaryDirectory, 'first.png')
  const secondOutput = join(temporaryDirectory, 'second.png')

  const first = run([
    'still',
    'tutorial-easy-1',
    '--frame',
    '30',
    '--output',
    firstOutput,
    '--no-build'
  ])
  run(['still', 'tutorial-easy-1', '--frame', '30', '--output', secondOutput, '--no-build'])

  if (first.width !== 1080 || first.height !== 1920 || first.timeMs !== 500) {
    throw new Error('Still metadata did not match the scene and fixed 60 FPS timebase')
  }
  if (sha256(firstOutput) !== sha256(secondOutput)) {
    throw new Error('Repeated still renders were not byte-identical')
  }

  const inspection = run(['inspect', 'test-scene-inspection', '--frame', '30', '--no-build'])
  const subject = inspection.objects.find((object) => object.id === 'subject')
  const hiddenLabel = inspection.objects.find((object) => object.id === 'hidden-label')
  const detachedGuide = inspection.objects.find((object) => object.id === 'detached-guide')
  if (
    inspection.sceneInfo.durationInFrames !== 60 ||
    inspection.sceneInfo.lastFrame !== 59 ||
    inspection.timeMs !== 500 ||
    inspection.camera.type !== 'orthographic' ||
    JSON.stringify(inspection.camera.direction) !== JSON.stringify([0, 0, -1]) ||
    inspection.totalExposedObjects !== 4 ||
    inspection.objectsTruncated ||
    !subject ||
    subject.metadata.data?.purpose !== 'inspection-test' ||
    JSON.stringify(subject.worldTransform.position) !== JSON.stringify([-5, 3, 0]) ||
    JSON.stringify(subject.worldBounds?.size) !== JSON.stringify([4, 2, 0]) ||
    JSON.stringify(subject.screenBounds) !==
      JSON.stringify({ x: 176.666667, y: 86.666667, width: 13.333333, height: 6.666667 }) ||
    !subject.attached ||
    !subject.visible ||
    !subject.fullyInFrame ||
    !hiddenLabel ||
    hiddenLabel.parentId !== 'label-group' ||
    hiddenLabel.text !== 'Hidden label' ||
    JSON.stringify(hiddenLabel.worldTransform.position) !== JSON.stringify([9, -2, 0]) ||
    hiddenLabel.visible ||
    !detachedGuide ||
    detachedGuide.attached ||
    detachedGuide.inFrame
  ) {
    throw new Error('Semantic inspection metadata or geometry was incorrect')
  }

  const cameras = run(['cameras', 'test-scene-inspection', '--frame', '30', '--no-build'])
  const mainCamera = cameras.cameras.find((camera) => camera.id === 'main')
  const overviewCamera = cameras.cameras.find((camera) => camera.id === 'overview')
  const trackingCamera = cameras.cameras.find((camera) => camera.id === 'tracking')
  if (
    cameras.command !== 'cameras' ||
    cameras.cameraCount !== 3 ||
    cameras.sceneInfo.lastFrame !== 59 ||
    !mainCamera?.isMain ||
    mainCamera.camera.type !== 'orthographic' ||
    overviewCamera?.isMain ||
    overviewCamera?.camera.type !== 'perspective' ||
    overviewCamera.metadata.data?.purpose !== 'camera-regression' ||
    trackingCamera?.camera.type !== 'orthographic' ||
    trackingCamera.camera.position[0] !== 3
  ) {
    throw new Error('Inspection camera discovery or frame-aware state was incorrect')
  }

  const overviewInspection = run([
    'inspect',
    'test-scene-inspection',
    '--frame',
    '30',
    '--camera',
    'overview',
    '--no-build'
  ])
  const overviewSubject = overviewInspection.objects.find((object) => object.id === 'subject')
  if (
    overviewInspection.cameraId !== 'overview' ||
    overviewInspection.camera.type !== 'perspective' ||
    !overviewSubject?.screenBounds ||
    overviewSubject.screenBounds.width <= 0 ||
    JSON.stringify(overviewSubject.screenBounds) === JSON.stringify(subject.screenBounds)
  ) {
    throw new Error('Semantic inspection did not project objects through the selected camera')
  }

  const unknownCamera = run(
    [
      'inspect',
      'test-scene-inspection',
      '--frame',
      '30',
      '--camera',
      'missing-camera',
      '--no-build'
    ],
    false
  )
  if (
    unknownCamera.success ||
    unknownCamera.error?.code !== 'UNKNOWN_CAMERA' ||
    !unknownCamera.error?.message?.includes('main, overview, tracking')
  ) {
    throw new Error('Unknown camera IDs did not return actionable available-camera feedback')
  }

  const mainCameraOutput = join(temporaryDirectory, 'camera-main.png')
  const overviewCameraOutput = join(temporaryDirectory, 'camera-overview.png')
  const overviewStill = run([
    'still',
    'test-scene-inspection',
    '--frame',
    '30',
    '--camera',
    'overview',
    '--output',
    overviewCameraOutput,
    '--no-build'
  ])
  run([
    'still',
    'test-scene-inspection',
    '--frame',
    '30',
    '--camera',
    'main',
    '--output',
    mainCameraOutput,
    '--no-build'
  ])
  if (
    overviewStill.cameraId !== 'overview' ||
    sha256(mainCameraOutput) === sha256(overviewCameraOutput)
  ) {
    throw new Error('Still rendering did not use the selected inspection camera')
  }

  const cameraGridOutput = join(temporaryDirectory, 'camera-grid.png')
  const cameraGrid = run([
    'camera-grid',
    'test-scene-inspection',
    '--frame',
    '30',
    '--cameras',
    'main,overview,tracking',
    '--columns',
    '2',
    '--cell-width',
    '120',
    '--output',
    cameraGridOutput,
    '--no-build'
  ])
  const cameraGridImage = await sharp(cameraGridOutput).metadata()
  if (
    cameraGrid.command !== 'camera-grid' ||
    cameraGrid.cameraCount !== 3 ||
    cameraGrid.cameraCells.length !== 3 ||
    JSON.stringify(cameraGrid.cameras.map((camera) => camera.id)) !==
      JSON.stringify(['main', 'overview', 'tracking']) ||
    cameraGrid.columns !== 2 ||
    cameraGrid.rows !== 2 ||
    cameraGrid.width !== 264 ||
    cameraGrid.height !== 248 ||
    cameraGridImage.width !== cameraGrid.width ||
    cameraGridImage.height !== cameraGrid.height ||
    cameraGrid.cameraCells[1].label !== 'overview · perspective' ||
    cameraGrid.cameraCells[2].cameraId !== 'tracking'
  ) {
    throw new Error('Camera grid image or structured camera metadata was incorrect')
  }

  const dynamicTextInspection = run(['inspect', 'alternatives', '--frame', '300', '--no-build'])
  const courseName = dynamicTextInspection.objects.find((object) => object.id === 'course-name')
  if (
    courseName?.text !== 'Optik' ||
    !courseName.worldBounds ||
    courseName.worldBounds.size[0] <= 0 ||
    !courseName.screenBounds ||
    courseName.screenBounds.width <= 0
  ) {
    throw new Error('Dynamic text content and geometry were not synchronized before inspection')
  }

  const exposureLifecycleGrid = run([
    'timeline-grid',
    'test-scene-inspection',
    '--frames',
    '0,30,59',
    '--cell-width',
    '120',
    '--output',
    join(temporaryDirectory, 'exposure-lifecycle.png'),
    '--no-build'
  ])
  if (exposureLifecycleGrid.cells.length !== 3) {
    throw new Error('Exposed object registry did not survive repeated clean seeks')
  }

  const timelineGridOutput = join(temporaryDirectory, 'timeline-grid.png')
  const timelineGrid = run([
    'timeline-grid',
    'tutorial-easy-1',
    '--cell-width',
    '180',
    '--output',
    timelineGridOutput,
    '--no-build'
  ])
  const timelineGridImage = await sharp(timelineGridOutput).metadata()
  if (
    timelineGrid.command !== 'timeline-grid' ||
    timelineGrid.cells.length !== 9 ||
    JSON.stringify(timelineGrid.frames) !== JSON.stringify([0, 7, 15, 22, 30, 37, 44, 52, 59]) ||
    timelineGrid.columns !== 3 ||
    timelineGrid.rows !== 3 ||
    timelineGrid.width !== 572 ||
    timelineGrid.height !== 1088 ||
    timelineGridImage.width !== timelineGrid.width ||
    timelineGridImage.height !== timelineGrid.height ||
    timelineGrid.cells[4].frame !== 30 ||
    timelineGrid.cells[4].timeMs !== 500 ||
    timelineGrid.cells[8].label !== 'Frame 59 · 983 ms'
  ) {
    throw new Error('Timeline grid image or structured cell metadata was incorrect')
  }

  process.stdout.write('DefinedMotion automation smoke test passed\n')
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true })
}
