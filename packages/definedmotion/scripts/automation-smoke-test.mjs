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
  if (scenes.scenes.length !== 62) {
    throw new Error(`Expected 62 packaged and project scenes, received ${scenes.scenes.length}`)
  }
  if (scenes.scenes.filter((scene) => scene.isDefault).length !== 1) {
    throw new Error('Scene discovery did not identify exactly one configured default')
  }
  if (
    !scenes.scenes.some((scene) => scene.id === 'test-camera-waypoints-sequential' && scene.isTest)
  ) {
    throw new Error('Visual test scenes were not discoverable with isTest metadata')
  }
  if (
    scenes.scenes.find((scene) => scene.id === 'playground-smoke')?.kind !== 'project' ||
    scenes.scenes.find((scene) => scene.id === 'fourier-series')?.kind !== 'example' ||
    scenes.scenes.find((scene) => scene.id === 'test-viewer-preview')?.kind !== 'test'
  ) {
    throw new Error('Scene registry did not classify project, example, and test scenes')
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
  if (videoResult.durationInFrames !== 679) {
    throw new Error('Video scene did not round its media duration to the expected 679 frames')
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
  const visualEffects = run(['inspect', 'test-visual-primitives', '--frame', '11', '--no-build'])
  const visualVerification = run(['verify', '--scene', 'test-visual-primitives', '--no-build'])
  const visualObject = (id) => visuals.objects.find((object) => object.id === id)
  const leftText = visualObject('visual-text-left-top')
  const centerText = visualObject('visual-text-centered')
  const leftLatex = visualObject('visual-latex-left-top')
  const centerLatex = visualObject('visual-latex-centered')
  const invalidVisuals = visualObject('visual-invalid-inputs')
  const earlyParticleTarget = visualObject('visual-latex-particle-target')
  const latexEffects = visualEffects.objects.find((object) => object.id === 'visual-latex-effects')
  const latexEffectsCleanup = visualEffects.objects.find(
    (object) => object.id === 'visual-latex-effects-cleanup'
  )
  const latexParticleTarget = visualEffects.objects.find(
    (object) => object.id === 'visual-latex-particle-target'
  )
  if (
    visuals.sceneInfo.durationInFrames !== 12 ||
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
    earlyParticleTarget?.attached !== false ||
    latexEffects?.latex !== String.raw`a = \frac{F}{\dmClass{mass}{m}}` ||
    latexEffects?.metadata.data?.rootStable !== true ||
    latexEffectsCleanup?.text !== 'cleanup=true' ||
    latexParticleTarget?.visible !== true ||
    visualVerification.passed !== true ||
    visualVerification.verificationCount !== 1
  ) {
    throw new Error(
      'Text/LaTeX readiness, stable updates, effects, anchors, or local bounds were incorrect'
    )
  }

  const layoutStart = run(['inspect', 'test-primitive-layout', '--frame', '0', '--no-build'])
  const layoutEnd = run(['inspect', 'test-primitive-layout', '--frame', '4', '--no-build'])
  const layoutObject = (result, id) => result.objects.find((object) => object.id === id)
  if (
    layoutEnd.sceneInfo.durationInFrames !== 5 ||
    layoutObject(layoutStart, 'layout-static-column')?.localBounds?.size[0] !== 34 ||
    layoutObject(layoutStart, 'layout-dynamic-list')?.localBounds?.size[0] !== 0 ||
    layoutObject(layoutStart, 'layout-first-appended')?.attached !== false ||
    layoutObject(layoutStart, 'layout-second-appended')?.attached !== false ||
    !(layoutObject(layoutEnd, 'layout-dynamic-list')?.localBounds?.size[0] > 0) ||
    !(layoutObject(layoutEnd, 'layout-dynamic-list')?.localBounds?.size[1] > 0) ||
    layoutObject(layoutEnd, 'layout-first-appended')?.attached !== true ||
    layoutObject(layoutEnd, 'layout-second-appended')?.attached !== true ||
    layoutObject(layoutEnd, 'layout-first-appended')?.visible !== true ||
    layoutObject(layoutEnd, 'layout-second-appended')?.visible !== true
  ) {
    throw new Error('Primitive layout bounds, append replay, or slot animation was incorrect')
  }

  const animatedLayoutStart = run([
    'inspect',
    'test-layout-animation',
    '--frame',
    '0',
    '--no-build'
  ])
  const animatedLayoutEnd = run(['inspect', 'test-layout-animation', '--frame', '89', '--no-build'])
  const animatedLayoutVerification = run([
    'verify',
    '--scene',
    'test-layout-animation',
    '--no-build'
  ])
  const animatedLayoutObject = (result, id) => result.objects.find((object) => object.id === id)
  if (
    animatedLayoutEnd.sceneInfo.durationInFrames !== 90 ||
    animatedLayoutObject(animatedLayoutStart, 'layout-animation-first-item')?.attached !== false ||
    animatedLayoutObject(animatedLayoutStart, 'layout-animation-second-item')?.attached !== false ||
    animatedLayoutObject(animatedLayoutEnd, 'layout-animation-first-item')?.attached !== true ||
    animatedLayoutObject(animatedLayoutEnd, 'layout-animation-second-item')?.attached !== true ||
    !(
      animatedLayoutObject(animatedLayoutEnd, 'layout-animation-list')?.localBounds?.size[1] >
      animatedLayoutObject(animatedLayoutStart, 'layout-animation-list')?.localBounds?.size[1]
    ) ||
    !(
      animatedLayoutObject(animatedLayoutEnd, 'layout-animation-footer')?.worldTransform
        ?.position[1] <
      animatedLayoutObject(animatedLayoutStart, 'layout-animation-footer')?.worldTransform
        ?.position[1]
    ) ||
    animatedLayoutVerification.passed !== true ||
    animatedLayoutVerification.verificationCount !== 3
  ) {
    throw new Error('Nested layout animation, append reflow, or verification was incorrect')
  }

  const latexSelectionEnd = run([
    'inspect',
    'test-text-latex-selection',
    '--frame',
    '203',
    '--no-build'
  ])
  const latexSelectionBeforeCommit = run([
    'inspect',
    'test-text-latex-selection',
    '--frame',
    '160',
    '--no-build'
  ])
  const latexSelectionCommit = run([
    'inspect',
    'test-text-latex-selection',
    '--frame',
    '161',
    '--no-build'
  ])
  const latexSelectionVerification = run([
    'verify',
    '--scene',
    'test-text-latex-selection',
    '--no-build'
  ])
  const selectedEquation = latexSelectionEnd.objects.find(
    (object) => object.id === 'latex-selection-equation'
  )
  const equationBeforeCommit = latexSelectionBeforeCommit.objects.find(
    (object) => object.id === 'latex-selection-equation'
  )
  const equationAtCommit = latexSelectionCommit.objects.find(
    (object) => object.id === 'latex-selection-equation'
  )
  const legendBeforeCommit = latexSelectionBeforeCommit.objects.find(
    (object) => object.id === 'latex-selection-legend'
  )
  const legendAtCommit = latexSelectionCommit.objects.find(
    (object) => object.id === 'latex-selection-legend'
  )
  if (
    latexSelectionEnd.sceneInfo.durationInFrames !== 204 ||
    selectedEquation?.latex !==
      String.raw`\frac{\dmClass{energy}{E}}{\dmClass{mass}{m}} = \dmClass{light}{c^2}` ||
    selectedEquation?.metadata.data?.rootStable !== true ||
    !equationBeforeCommit ||
    !equationAtCommit ||
    !legendBeforeCommit ||
    !legendAtCommit ||
    Math.abs(equationAtCommit.localBounds.size[1] - equationBeforeCommit.localBounds.size[1]) >=
      0.1 ||
    Math.abs(
      legendAtCommit.worldTransform.position[1] - legendBeforeCommit.worldTransform.position[1]
    ) >= 0.1 ||
    latexSelectionVerification.passed !== true ||
    latexSelectionVerification.verificationCount !== 8
  ) {
    throw new Error('Text/LaTeX selection, morph, or intermediate verification was incorrect')
  }

  const animatedCameraUiStart = run([
    'inspect',
    'test-animated-3d-camera-ui',
    '--frame',
    '0',
    '--no-build'
  ])
  const animatedCameraUiEnd = run([
    'inspect',
    'test-animated-3d-camera-ui',
    '--frame',
    '419',
    '--no-build'
  ])
  const animatedCameraUiVerification = run([
    'verify',
    '--scene',
    'test-animated-3d-camera-ui',
    '--no-build'
  ])
  const animatedCameraUiObject = (result, id) => result.objects.find((object) => object.id === id)
  const cameraUiPanelStart = animatedCameraUiObject(
    animatedCameraUiStart,
    'animated-camera-ui-panel'
  )
  const cameraUiPanelEnd = animatedCameraUiObject(animatedCameraUiEnd, 'animated-camera-ui-panel')
  if (
    animatedCameraUiEnd.sceneInfo.durationInFrames !== 420 ||
    animatedCameraUiObject(animatedCameraUiStart, 'animated-camera-ui-world-callout')?.attached !==
      false ||
    animatedCameraUiObject(animatedCameraUiEnd, 'animated-camera-ui-world-callout')?.attached !==
      true ||
    animatedCameraUiObject(animatedCameraUiStart, 'animated-camera-ui-focus-note')?.attached !==
      false ||
    animatedCameraUiObject(animatedCameraUiEnd, 'animated-camera-ui-focus-note')?.attached !==
      true ||
    animatedCameraUiObject(animatedCameraUiEnd, 'animated-camera-ui-meter')?.localTransform
      .scale[0] !== 1 ||
    !cameraUiPanelStart?.screenBounds ||
    !cameraUiPanelEnd?.screenBounds ||
    Math.abs(cameraUiPanelStart.screenBounds.x - cameraUiPanelEnd.screenBounds.x) >= 0.01 ||
    Math.abs(cameraUiPanelStart.screenBounds.y - cameraUiPanelEnd.screenBounds.y) >= 0.01 ||
    Math.abs(cameraUiPanelStart.screenBounds.width - cameraUiPanelEnd.screenBounds.width) >= 0.01 ||
    Math.abs(cameraUiPanelStart.screenBounds.height - cameraUiPanelEnd.screenBounds.height) >=
      0.01 ||
    animatedCameraUiVerification.passed !== true ||
    animatedCameraUiVerification.verificationCount !== 8
  ) {
    throw new Error(
      'Animated 3D camera-attached UI screen lock, late attachment, or verification was incorrect'
    )
  }

  const productionHeatEnd = run([
    'inspect',
    'test-production-heat-flow',
    '--frame',
    '509',
    '--no-build'
  ])
  const productionHeatVerification = run([
    'verify',
    '--scene',
    'test-production-heat-flow',
    '--no-build'
  ])
  const productionHeatLayoutCheck = run([
    'layout-check',
    'test-production-heat-flow',
    '--output-dir',
    join(temporaryDirectory, 'production-heat-layout-check'),
    '--no-build'
  ])
  const productionHeatObject = (id) => productionHeatEnd.objects.find((object) => object.id === id)
  if (
    productionHeatEnd.sceneInfo.durationInFrames !== 510 ||
    productionHeatObject('heat-flow-equation')?.latex !==
      String.raw`\dmClass{temperature}{\Delta T}=\frac{\dmClass{energy}{Q}}{\dmClass{mass}{mc}}` ||
    productionHeatObject('heat-flow-takeaway')?.visible !== true ||
    productionHeatObject('heat-flow-spread-fill')?.localTransform.scale[0] !== 0.18 ||
    productionHeatVerification.passed !== true ||
    productionHeatVerification.verificationCount !== 7 ||
    productionHeatLayoutCheck.checkedFrames !== 510 ||
    productionHeatLayoutCheck.watchedObjectCount !== 6 ||
    productionHeatLayoutCheck.clean !== true ||
    productionHeatLayoutCheck.incidentCount !== 0
  ) {
    throw new Error(
      'Production heat-flow composition, semantic morph, or verification was incorrect'
    )
  }

  const previewExact = run(['inspect', 'test-viewer-preview', '--frame', '4', '--no-build'])
  const previewCard = previewExact.objects.find((object) => object.id === 'preview-card')
  if (
    previewExact.sceneInfo.durationInFrames !== 5 ||
    previewCard?.worldTransform.position[0] !== 10
  ) {
    throw new Error('Exact automation did not trace complete state across a viewer preview marker')
  }

  const verificationList = run([
    'verify',
    '--scene',
    'test-scene-verifications',
    '--list',
    '--no-build'
  ])
  const verificationPass = run([
    'verify',
    '--scene',
    'test-scene-verifications',
    '--test',
    'panel-padding',
    '--no-build'
  ])
  const verificationFrame = run([
    'verify',
    '--scene',
    'test-scene-verifications',
    '--test',
    'intentional-failure',
    '--frame',
    '5',
    '--no-build'
  ])
  const verificationMultiple = run([
    'verify',
    '--scene',
    'test-scene-verifications',
    '--test',
    'panel-padding',
    '--test',
    'measurement-semantics',
    '--no-build'
  ])
  const verificationFailure = run(
    [
      'verify',
      '--scene',
      'test-scene-verifications',
      '--test',
      'intentional-failure',
      '--no-build'
    ],
    false
  )
  const unknownVerification = run(
    [
      'verify',
      '--scene',
      'test-scene-verifications',
      '--test',
      'missing-verification',
      '--no-build'
    ],
    false
  )
  if (
    verificationList.verifications?.length !== 3 ||
    verificationList.executedCheckCount !== 0 ||
    verificationPass.passed !== true ||
    verificationPass.executedCheckCount !== 3 ||
    verificationFrame.passed !== true ||
    verificationFrame.executedCheckCount !== 1 ||
    verificationMultiple.passed !== true ||
    verificationMultiple.verificationCount !== 2 ||
    verificationMultiple.executedCheckCount !== 9 ||
    verificationFailure.success !== true ||
    verificationFailure.passed !== false ||
    verificationFailure.failureCount !== 1 ||
    verificationFailure.failures?.[0]?.testId !== 'intentional-failure' ||
    verificationFailure.failures?.[0]?.globalFrame !== 4 ||
    verificationFailure.failures?.[0]?.beat?.localFrame !== 1 ||
    verificationFailure.failures?.[0]?.details?.observedFrame !== 4 ||
    unknownVerification.success !== false ||
    unknownVerification.error?.code !== 'UNKNOWN_VERIFICATION'
  ) {
    throw new Error(
      'Scene verification registration, selection, ranges, or failure output was incorrect'
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
