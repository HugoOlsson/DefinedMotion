/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const projectRoot = dirname(scriptDirectory)
const cli = join(scriptDirectory, 'definedmotion.mjs')
const fixturePath = join(projectRoot, 'src', 'scenes', 'runtime-freshness.scene.ts')
const revisionNoisePath = join(projectRoot, 'src', 'runtime-freshness-noise.ts')
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'definedmotion-runtime-smoke-'))

function run(arguments_, expectSuccess = true) {
  const result = spawnSync(process.execPath, [cli, ...arguments_, '--json'], {
    cwd: projectRoot,
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

function runAsync(arguments_) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [cli, ...arguments_, '--json'], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'inherit']
    })
    let stdout = ''
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk) => (stdout += chunk))
    child.once('error', rejectPromise)
    child.once('close', (status) => {
      try {
        const parsed = JSON.parse(stdout)
        if (status !== 0 || !parsed.success) {
          rejectPromise(new Error(parsed.error?.message ?? `CLI failed with code ${status}`))
          return
        }
        resolvePromise(parsed)
      } catch (error) {
        rejectPromise(error)
      }
    })
  })
}

function fixtureSource(color) {
  return `import { defineScene } from '../project'
import { createRectangle } from '$renderer/lib/rendering/objects2d'
import {
  AnimatedScene,
  HotReloadSetting,
  SpaceSetting
} from '$renderer/lib/scene/sceneClass'

export default defineScene({
  id: 'runtime-freshness',
  name: 'Runtime Freshness',
  isTest: true,
  create: runtimeFreshnessScene
})

function runtimeFreshnessScene(): AnimatedScene {
  return new AnimatedScene(
    320,
    180,
    SpaceSetting.TwoDim,
    HotReloadSetting.TraceFromStart,
    (scene) => {
      scene.add(createRectangle(320, 180, { color: '${color}' }))
      scene.addWait(1)
    }
  )
}
`
}

const fixtureSyntaxErrorSource = () =>
  `${fixtureSource('#0000ff')}\nconst __runtimeSyntaxErrorProbe: = true\n`

const fixtureMissingImportSource = () =>
  `import './runtime-missing-dependency'\n${fixtureSource('#0000ff')}`

async function waitForReady() {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    const status = run(['session', 'status'])
    if (status.status === 'ready') return status
    await delay(100)
  }
  throw new Error('Persistent runtime did not become ready within 30 seconds')
}

async function centerPixel(path) {
  return pixelAt(path, 160, 90)
}

async function pixelAt(path, left, top) {
  return Array.from(await sharp(path).extract({ left, top, width: 1, height: 1 }).raw().toBuffer())
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

const delay = (milliseconds) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds))

let runtimeProcess
try {
  run(['session', 'stop'])
  runtimeProcess = spawn(process.execPath, [cli, 'session', 'start', '--foreground'], {
    cwd: projectRoot,
    stdio: ['ignore', 'ignore', 'inherit']
  })

  const initialStatus = await waitForReady()
  const initialInspection = run(['inspect', 'test-scene-inspection', '--require-session'])
  const repeatedInspection = run([
    'inspect',
    'test-scene-inspection',
    '--frame',
    '59',
    '--require-session'
  ])
  const unexposedInspection = run([
    'inspect',
    'test-zoom-perspective-sequential',
    '--require-session'
  ])
  const assetHeavyInspection = run(['inspect', 'keyboard', '--frame', '300', '--require-session'])
  const typedMessage = assetHeavyInspection.objects.find((object) => object.id === 'typed-message')
  if (
    initialInspection.runtimeId !== initialStatus.runtimeId ||
    repeatedInspection.runtimeId !== initialStatus.runtimeId ||
    unexposedInspection.runtimeId !== initialStatus.runtimeId ||
    initialInspection.generation !== repeatedInspection.generation ||
    initialInspection.objects.length !== 4 ||
    repeatedInspection.objects.length !== 4 ||
    unexposedInspection.objects.length !== 0 ||
    unexposedInspection.camera.type !== 'perspective' ||
    unexposedInspection.camera.fov === undefined ||
    assetHeavyInspection.runtimeId !== initialStatus.runtimeId ||
    typedMessage?.text !== 'I am just testin' ||
    !typedMessage.worldBounds ||
    typedMessage.worldBounds.size[0] <= 0 ||
    !typedMessage.screenBounds ||
    typedMessage.screenBounds.width <= 0
  ) {
    throw new Error(
      'Persistent inspection retained stale references or failed to synchronize asset-heavy text'
    )
  }

  writeFileSync(fixturePath, fixtureSource('#ff0000'))

  const redOutput = join(temporaryDirectory, 'red.png')
  const redResult = run([
    'still',
    'runtime-freshness',
    '--frame',
    '0',
    '--output',
    redOutput,
    '--require-session'
  ])
  if (JSON.stringify(await centerPixel(redOutput)) !== JSON.stringify([255, 0, 0, 255])) {
    throw new Error('Generation after adding the fixture did not render its red source')
  }

  writeFileSync(fixturePath, fixtureSource('#0000ff'))
  await delay(75)
  writeFileSync(revisionNoisePath, 'export const runtimeFreshnessNoise = true\n')
  const blueOutput = join(temporaryDirectory, 'blue.png')
  const blueResult = run([
    'still',
    'runtime-freshness',
    '--frame',
    '0',
    '--output',
    blueOutput,
    '--require-session'
  ])
  if (JSON.stringify(await centerPixel(blueOutput)) !== JSON.stringify([0, 0, 255, 255])) {
    throw new Error('Generation after editing the fixture did not render its blue source')
  }
  if (
    redResult.runtimeId !== initialStatus.runtimeId ||
    blueResult.runtimeId !== initialStatus.runtimeId ||
    blueResult.generation <= redResult.generation ||
    blueResult.sourceRevision === redResult.sourceRevision
  ) {
    throw new Error('Runtime identity or source-generation metadata was not preserved correctly')
  }

  writeFileSync(fixturePath, fixtureSyntaxErrorSource())
  const syntaxFailureStartedAt = Date.now()
  const syntaxFailure = run(['inspect', 'runtime-freshness', '--require-session'], false)
  const syntaxFailureDuration = Date.now() - syntaxFailureStartedAt
  const syntaxFailureStatus = run(['session', 'status'])
  if (
    syntaxFailure.success ||
    syntaxFailure.error?.code !== 'SOURCE_COMPILE_ERROR' ||
    syntaxFailure.error?.file !== 'src/scenes/runtime-freshness.scene.ts' ||
    syntaxFailure.error?.plugin !== 'vite:esbuild' ||
    !Number.isInteger(syntaxFailure.error?.line) ||
    !syntaxFailure.error?.frame?.includes('__runtimeSyntaxErrorProbe') ||
    syntaxFailureDuration > 5_000 ||
    syntaxFailureStatus.status !== 'source-error' ||
    syntaxFailureStatus.error?.code !== 'SOURCE_COMPILE_ERROR'
  ) {
    throw new Error('Syntax errors were not reported immediately with revision-scoped diagnostics')
  }

  writeFileSync(fixturePath, fixtureMissingImportSource())
  const missingImportFailure = run(['inspect', 'runtime-freshness', '--require-session'], false)
  if (
    missingImportFailure.success ||
    missingImportFailure.error?.code !== 'SOURCE_COMPILE_ERROR' ||
    missingImportFailure.error?.plugin !== 'vite:import-analysis' ||
    !missingImportFailure.error?.message?.includes('runtime-missing-dependency')
  ) {
    throw new Error('Missing imports were not returned as structured Vite diagnostics')
  }

  writeFileSync(fixturePath, fixtureSource('#0000ff'))
  const recoveredOutput = join(temporaryDirectory, 'recovered.png')
  const recoveredResult = run([
    'still',
    'runtime-freshness',
    '--frame',
    '0',
    '--output',
    recoveredOutput,
    '--require-session'
  ])
  const recoveredPixel = await centerPixel(recoveredOutput)
  if (
    recoveredResult.runtimeId !== initialStatus.runtimeId ||
    recoveredResult.generation < blueResult.generation ||
    JSON.stringify(recoveredPixel) !== JSON.stringify([0, 0, 255, 255])
  ) {
    throw new Error(
      `Runtime did not recover the corrected source without restarting: ${JSON.stringify({
        initialRuntimeId: initialStatus.runtimeId,
        recoveredRuntimeId: recoveredResult.runtimeId,
        blueGeneration: blueResult.generation,
        recoveredGeneration: recoveredResult.generation,
        recoveredPixel
      })}`
    )
  }

  const concurrentResults = await Promise.all([
    runAsync(['scenes', '--require-session']),
    runAsync(['inspect', 'alternatives', '--frame', '300', '--require-session']),
    runAsync(['inspect', 'vector-field', '--frame', '600', '--require-session'])
  ])
  if (concurrentResults.some((result) => result.runtimeId !== initialStatus.runtimeId)) {
    throw new Error('Concurrent CLI requests did not share the same serialized runtime')
  }

  writeFileSync(fixturePath, fixtureSyntaxErrorSource())
  await delay(125)
  writeFileSync(fixturePath, fixtureSource('#00ff00'))
  const rapidCorrectionOutput = join(temporaryDirectory, 'rapid-correction.png')
  const rapidCorrectionResult = run([
    'still',
    'runtime-freshness',
    '--frame',
    '0',
    '--output',
    rapidCorrectionOutput,
    '--require-session'
  ])
  if (
    rapidCorrectionResult.runtimeId !== initialStatus.runtimeId ||
    JSON.stringify(await centerPixel(rapidCorrectionOutput)) !== JSON.stringify([0, 255, 0, 255])
  ) {
    throw new Error('A stale compile diagnostic poisoned a rapidly corrected source revision')
  }

  writeFileSync(fixturePath, fixtureSource('#0000ff'))
  const inFlightInspection = runAsync([
    'inspect',
    'vector-field',
    '--frame',
    '1100',
    '--require-session'
  ])
  await delay(250)
  writeFileSync(revisionNoisePath, 'export const runtimeFreshnessNoise = 2\n')
  const retriedInspection = await inFlightInspection
  const statusAfterInFlightChange = run(['session', 'status'])
  if (
    retriedInspection.runtimeId !== initialStatus.runtimeId ||
    retriedInspection.sourceRevision !== statusAfterInFlightChange.sourceRevision
  ) {
    throw new Error('A request interrupted by a source change did not retry on the ready revision')
  }

  const shortGridOutput = join(temporaryDirectory, 'short-grid.png')
  const shortGridResult = run([
    'timeline-grid',
    'runtime-freshness',
    '--count',
    '5',
    '--cell-width',
    '120',
    '--output',
    shortGridOutput,
    '--require-session'
  ])
  if (
    JSON.stringify(shortGridResult.frames) !== JSON.stringify([0]) ||
    shortGridResult.columns !== 1 ||
    shortGridResult.rows !== 1 ||
    JSON.stringify(await pixelAt(shortGridOutput, 68, 42)) !== JSON.stringify([0, 0, 255])
  ) {
    throw new Error('Count-based sampling did not adapt to a shorter scene')
  }

  const conflictingSelection = run(
    ['timeline-grid', 'tutorial-easy-1', '--frames', '0,30', '--count', '2'],
    false
  )
  if (conflictingSelection.success || conflictingSelection.error?.code !== 'INVALID_ARGUMENTS') {
    throw new Error('Timeline grid accepted conflicting frame selection flags')
  }

  const firstSessionOutput = join(temporaryDirectory, 'session-1.png')
  const secondSessionOutput = join(temporaryDirectory, 'session-2.png')
  const standaloneOutput = join(temporaryDirectory, 'standalone.png')
  const firstSessionResult = run([
    'still',
    'tutorial-easy-1',
    '--frame',
    '30',
    '--output',
    firstSessionOutput,
    '--require-session'
  ])
  const secondSessionResult = run([
    'still',
    'tutorial-easy-1',
    '--frame',
    '30',
    '--output',
    secondSessionOutput,
    '--require-session'
  ])
  run([
    'still',
    'tutorial-easy-1',
    '--frame',
    '30',
    '--output',
    standaloneOutput,
    '--standalone',
    '--no-build'
  ])
  if (
    sha256(firstSessionOutput) !== sha256(secondSessionOutput) ||
    sha256(secondSessionOutput) !== sha256(standaloneOutput)
  ) {
    throw new Error('Persistent and standalone still renders were not byte-identical')
  }
  if (
    firstSessionResult.runtimeId !== secondSessionResult.runtimeId ||
    firstSessionResult.generation !== secondSessionResult.generation
  ) {
    throw new Error('Unchanged source did not reuse the same runtime generation')
  }

  const sessionGridOutput = join(temporaryDirectory, 'session-grid.png')
  const standaloneGridOutput = join(temporaryDirectory, 'standalone-grid.png')
  const sessionGridResult = run([
    'timeline-grid',
    'tutorial-easy-1',
    '--frames',
    '0,30,59',
    '--columns',
    '2',
    '--cell-width',
    '180',
    '--output',
    sessionGridOutput,
    '--require-session'
  ])
  const standaloneGridResult = run([
    'timeline-grid',
    'tutorial-easy-1',
    '--frames',
    '0,30,59',
    '--columns',
    '2',
    '--cell-width',
    '180',
    '--output',
    standaloneGridOutput,
    '--standalone',
    '--no-build'
  ])
  if (
    sha256(sessionGridOutput) !== sha256(standaloneGridOutput) ||
    sessionGridResult.runtimeId !== initialStatus.runtimeId ||
    standaloneGridResult.runtimeId !== undefined ||
    JSON.stringify(sessionGridResult.cells) !== JSON.stringify(standaloneGridResult.cells)
  ) {
    throw new Error('Persistent and standalone timeline grids were not deterministic equivalents')
  }

  rmSync(fixturePath, { force: true })
  rmSync(revisionNoisePath, { force: true })
  const scenesAfterRemoval = run(['scenes', '--require-session'])
  if (scenesAfterRemoval.scenes.some((scene) => scene.id === 'runtime-freshness')) {
    throw new Error('Removed scene remained in the persistent scene registry')
  }
  if (scenesAfterRemoval.generation <= blueResult.generation) {
    throw new Error('Removing a source file did not advance the runtime generation')
  }

  process.stdout.write('DefinedMotion persistent runtime smoke test passed\n')
} finally {
  rmSync(fixturePath, { force: true })
  rmSync(revisionNoisePath, { force: true })
  try {
    run(['session', 'stop'])
  } catch {
    runtimeProcess?.kill('SIGTERM')
  }
  rmSync(temporaryDirectory, { recursive: true, force: true })
}
