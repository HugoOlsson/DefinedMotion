/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDirectory, '..', '..', '..', 'playground')
const cli = join(scriptDirectory, '..', 'cli', 'index.mjs')
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'definedmotion-smoke-'))

function run(arguments_, expectSuccess = true, captureProgress = false) {
  const result = spawnSync(process.execPath, [cli, ...arguments_, '--json'], {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', captureProgress ? 'pipe' : 'inherit']
  })

  if (!result.stdout) throw new Error(`CLI returned no JSON for: ${arguments_.join(' ')}`)
  const parsed = JSON.parse(result.stdout)
  if (expectSuccess && (result.status !== 0 || !parsed.success)) {
    throw new Error(parsed.error?.message ?? `CLI failed with code ${result.status}`)
  }
  if (!captureProgress) return parsed
  const progress = result.stderr
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const value = JSON.parse(line)
        return value.type === 'progress' ? [value] : []
      } catch {
        return []
      }
    })
  return { result: parsed, progress }
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

try {
  const scenes = run(['scenes'])
  if (scenes.scenes.length !== 69) {
    throw new Error(`Expected 69 packaged and project scenes, received ${scenes.scenes.length}`)
  }
  if (scenes.scenes.filter((scene) => scene.isDefault).length !== 1) {
    throw new Error('Scene discovery did not identify exactly one configured default')
  }
  if (
    !scenes.scenes.some((scene) => scene.id === 'test-camera-waypoints-sequential' && scene.isTest)
  ) {
    throw new Error('Visual test scenes were not discoverable with isTest metadata')
  }

  const scenesWithoutTests = run(['scenes', '--exclude-tests', '--no-build'])
  if (
    scenesWithoutTests.scenes.length !== 18 ||
    scenesWithoutTests.scenes.some((scene) => scene.isTest)
  ) {
    throw new Error('--exclude-tests did not return the 17 examples plus the playground scene')
  }

  const emittedMedia = readdirSync(
    join(projectRoot, '.definedmotion', 'build', 'renderer', 'assets')
  ).filter((file) => /\.(?:glb|gltf|hdr|mp3|mp4|webm|woff2?|ttf)$/i.test(file))
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

  const videoOutput = join(temporaryDirectory, 'cli-render.mp4')
  const cliVideo = run(
    ['render', 'test-asset-references', '--output', videoOutput, '--no-build'],
    true,
    true
  )
  const probe = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'stream=codec_type,width,height', '-of', 'json', videoOutput],
    { encoding: 'utf8' }
  )
  const probeResult = probe.status === 0 ? JSON.parse(probe.stdout) : undefined
  const progressPhases = new Set(cliVideo.progress.map((progress) => progress.phase))
  if (
    cliVideo.result.command !== 'render' ||
    cliVideo.result.output !== videoOutput ||
    cliVideo.result.durationInFrames !== 1 ||
    cliVideo.result.outputFrameCount !== 1 ||
    cliVideo.result.fps !== 60 ||
    !probeResult?.streams?.some(
      (stream) => stream.codec_type === 'video' && stream.width === 320 && stream.height === 180
    ) ||
    !progressPhases.has('preparing') ||
    !progressPhases.has('rendering-frames') ||
    !progressPhases.has('encoding-video') ||
    !progressPhases.has('complete')
  ) {
    throw new Error('CLI video render output, metadata, or progress reporting was incorrect')
  }

  const videoFrameA = join(temporaryDirectory, 'video-frame-a.png')
  const videoFrameARepeat = join(temporaryDirectory, 'video-frame-a-repeat.png')
  const videoFrameB = join(temporaryDirectory, 'video-frame-b.png')
  const videoResult = run([
    'still',
    'test-video-plane',
    '--frame',
    '60',
    '--output',
    videoFrameA,
    '--no-build'
  ])
  if (videoResult.durationInFrames !== 680) {
    throw new Error('Video scene did not derive its 680-frame duration from media metadata')
  }
  run(['still', 'test-video-plane', '--frame', '60', '--output', videoFrameARepeat, '--no-build'])
  run(['still', 'test-video-plane', '--frame', '30', '--output', videoFrameB, '--no-build'])
  if (sha256(videoFrameA) !== sha256(videoFrameARepeat)) {
    throw new Error('Repeated exact video frames were not byte-identical')
  }
  if (sha256(videoFrameA) === sha256(videoFrameB)) {
    throw new Error('Different video timestamps rendered identical frames')
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

  const animationPlanStart = run(['inspect', 'test-animation-plan', '--frame', '0', '--no-build'])
  const animationPlanSecondStart = run([
    'inspect',
    'test-animation-plan',
    '--frame',
    '30',
    '--no-build'
  ])
  const animationPlanEnd = run(['inspect', 'test-animation-plan', '--frame', '59', '--no-build'])
  const animationPlanEndRepeat = run([
    'inspect',
    'test-animation-plan',
    '--frame',
    '59',
    '--no-build'
  ])
  const planObject = (result) => result.objects.find((object) => object.id === 'animation-plan-box')
  if (
    animationPlanEnd.sceneInfo.durationInFrames !== 60 ||
    planObject(animationPlanStart)?.text !== 'x=-6.000' ||
    planObject(animationPlanSecondStart)?.text !== 'x=0.000' ||
    planObject(animationPlanEnd)?.text !== 'x=6.000' ||
    JSON.stringify(planObject(animationPlanEnd)?.localTransform) !==
      JSON.stringify(planObject(animationPlanEndRepeat)?.localTransform)
  ) {
    throw new Error('AnimationPlan exact seeking or runtime endpoint capture was incorrect')
  }

  const beatStart = run(['inspect', 'test-timeline-beats', '--frame', '20', '--no-build'])
  const beatGap = run(['inspect', 'test-timeline-beats', '--frame', '55', '--no-build'])
  const beatEnd = run(['inspect', 'test-timeline-beats', '--frame', '74', '--no-build'])
  const beatObject = (result) => result.objects.find((object) => object.id === 'timeline-beat-box')
  const beatPointer = beatStart.objects.find((object) => object.id === 'timeline-beat-pointer')
  if (
    beatStart.sceneInfo.durationInFrames !== 75 ||
    JSON.stringify(beatStart.beat) !==
      JSON.stringify({
        name: 'move',
        startFrame: 20,
        endFrame: 50,
        localFrame: 0,
        beatProgress: 0
      }) ||
    beatObject(beatStart)?.text !== 'move:0:0.00' ||
    beatPointer?.text !== 'pointer=7' ||
    beatGap.beat !== undefined ||
    beatObject(beatGap)?.text !== 'move:29:1.00' ||
    beatObject(beatGap)?.localTransform.position[0] !== 6 ||
    beatEnd.beat?.name !== 'hold' ||
    beatEnd.beat?.localFrame !== 14 ||
    beatEnd.beat?.beatProgress !== 1 ||
    beatObject(beatEnd)?.text !== 'hold:14:1.00'
  ) {
    throw new Error('Timeline beat placement, progress, duration, or inspection was incorrect')
  }

  const effectsOut = run(['inspect', 'test-core-effects', '--frame', '29', '--no-build'])
  const effectsIn = run(['inspect', 'test-core-effects', '--frame', '59', '--no-build'])
  const effectsMatch = run(['inspect', 'test-core-effects', '--frame', '89', '--no-build'])
  const effectObject = (result, id) => result.objects.find((object) => object.id === id)
  if (
    effectsMatch.sceneInfo.durationInFrames !== 105 ||
    effectObject(effectsOut, 'core-fade')?.visible !== false ||
    effectObject(effectsOut, 'core-scale')?.text !== 'scale=0.000' ||
    effectObject(effectsOut, 'core-move')?.text !== 'x=-4.000' ||
    effectObject(effectsIn, 'core-fade')?.visible !== true ||
    effectObject(effectsIn, 'core-scale')?.text !== 'scale=1.000' ||
    effectObject(effectsIn, 'core-move')?.text !== 'x=-12.000' ||
    effectObject(effectsMatch, 'core-match')?.text !== 'x=10.000' ||
    effectObject(effectsMatch, 'core-reference')?.text !== 'x=10.000'
  ) {
    throw new Error('Core effect endpoints, visibility lifecycle, or runtime binding was incorrect')
  }

  const visuals = run(['inspect', 'test-visual-primitives', '--frame', '0', '--no-build'])
  const visualEffects = run(['inspect', 'test-visual-primitives', '--frame', '9', '--no-build'])
  const visualObject = (id) => visuals.objects.find((object) => object.id === id)
  const leftText = visualObject('visual-text-left-top')
  const centerText = visualObject('visual-text-centered')
  const leftLatex = visualObject('visual-latex-left-top')
  const centerLatex = visualObject('visual-latex-centered')
  const invalidVisuals = visualObject('visual-invalid-inputs')
  const latexEffects = visualEffects.objects.find((object) => object.id === 'visual-latex-effects')
  const latexEffectsCleanup = visualEffects.objects.find(
    (object) => object.id === 'visual-latex-effects-cleanup'
  )
  if (
    visuals.sceneInfo.durationInFrames !== 10 ||
    leftText?.text !== 'Updated title' ||
    leftText?.metadata.data?.rootStable !== true ||
    leftText?.localBounds?.min[0] !== 0 ||
    leftText?.localBounds?.max[1] !== 0 ||
    centerText?.localBounds?.size[0] !== 18 ||
    centerText?.localBounds?.center[0] !== 0 ||
    centerText?.localBounds?.center[1] !== 0 ||
    leftLatex?.latex !== String.raw`a = \frac{F}{\dmClass{mass}{m}}` ||
    leftLatex?.metadata.data?.rootStable !== true ||
    leftLatex?.metadata.data?.partStable !== true ||
    leftLatex?.localBounds?.min[0] !== 0 ||
    leftLatex?.localBounds?.max[1] !== 0 ||
    centerLatex?.localBounds?.center[0] !== 0 ||
    centerLatex?.localBounds?.center[1] !== 0 ||
    invalidVisuals?.text !== 'font=true;latex=true' ||
    latexEffects?.latex !== String.raw`a = \frac{F}{\dmClass{mass}{m}}` ||
    latexEffects?.metadata.data?.rootStable !== true ||
    latexEffectsCleanup?.text !== 'cleanup=true'
  ) {
    throw new Error(
      'Text/LaTeX readiness, stable updates, effects, anchors, or local bounds were incorrect'
    )
  }

  const cameraOverlayGrid = join(temporaryDirectory, 'camera-attached-overlay-rebuild.png')
  const cameraOverlayResult = run([
    'timeline-grid',
    'test-camera-attached-overlay-rebuild',
    '--frames',
    '0,1',
    '--columns',
    '2',
    '--cell-width',
    '160',
    '--output',
    cameraOverlayGrid,
    '--no-build'
  ])
  if (
    !existsSync(cameraOverlayGrid) ||
    JSON.stringify(cameraOverlayResult.frames) !== JSON.stringify([0, 1])
  ) {
    throw new Error('Camera-attached overlay rebuild regression did not render both seeks')
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

  const layoutCheckDirectory = join(temporaryDirectory, 'layout-check')
  const layoutCheck = run([
    'layout-check',
    'test-layout-check',
    '--output-dir',
    layoutCheckDirectory,
    '--no-build'
  ])
  const [firstIncident, parallelGuideIncident, guideIncident, finalIncident] = layoutCheck.incidents
  const layoutCheckScreenshots = readdirSync(layoutCheckDirectory).filter((file) =>
    file.endsWith('.png')
  )
  if (
    layoutCheck.command !== 'layout-check' ||
    layoutCheck.checkedFrames !== 270 ||
    layoutCheck.watchedObjectCount !== 1 ||
    layoutCheck.incidentCount !== 4 ||
    layoutCheck.clean ||
    firstIncident?.obstacleId !== 'moving-obstacle' ||
    firstIncident.startFrame !== 0 ||
    firstIncident.endFrame !== 138 ||
    firstIncident.collisionFrameCount !== 20 ||
    parallelGuideIncident?.obstacleId !== 'parallel-guide' ||
    parallelGuideIncident.startFrame !== 200 ||
    parallelGuideIncident.endFrame !== 205 ||
    guideIncident?.obstacleId !== 'thin-guide' ||
    guideIncident.startFrame !== 200 ||
    guideIncident.endFrame !== 205 ||
    parallelGuideIncident.screenshotPath !== guideIncident.screenshotPath ||
    layoutCheck.incidents.some((incident) => incident.obstacleId === 'far-clipped-obstacle') ||
    finalIncident?.obstacleId !== 'moving-obstacle' ||
    finalIncident.startFrame !== 259 ||
    finalIncident.endFrame !== 269 ||
    layoutCheckScreenshots.length !== 3 ||
    layoutCheck.incidents.some(
      (incident) =>
        !existsSync(incident.screenshotPath) ||
        dirname(incident.screenshotPath) !== layoutCheckDirectory
    )
  ) {
    throw new Error('Layout collision detection, incident grouping, or still output was incorrect')
  }

  const unrelatedLayoutCheckImage = join(layoutCheckDirectory, 'reference.png')
  writeFileSync(unrelatedLayoutCheckImage, 'preserve this unrelated file')
  const unwatchedLayoutCheck = run([
    'layout-check',
    'tutorial-easy-1',
    '--output-dir',
    layoutCheckDirectory,
    '--no-build'
  ])
  const staleLayoutCheckScreenshots = readdirSync(layoutCheckDirectory).filter((file) =>
    /^(?:frame-\d+|incident-\d+-frame-\d+)\.png$/.test(file)
  )
  if (
    unwatchedLayoutCheck.watchedObjectCount !== 0 ||
    unwatchedLayoutCheck.checkedFrames !== 0 ||
    unwatchedLayoutCheck.clean ||
    unwatchedLayoutCheck.warnings?.[0]?.code !== 'NO_COLLISION_WATCHES' ||
    staleLayoutCheckScreenshots.length !== 0 ||
    !existsSync(unrelatedLayoutCheckImage)
  ) {
    throw new Error('Layout check did not report an unwatched scene or remove stale screenshots')
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
