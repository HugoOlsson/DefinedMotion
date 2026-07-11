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
  try {
    run(['session', 'stop'])
  } catch {
    runtimeProcess?.kill('SIGTERM')
  }
  rmSync(temporaryDirectory, { recursive: true, force: true })
}
