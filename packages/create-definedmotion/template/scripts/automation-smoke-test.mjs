/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const projectRoot = dirname(scriptDirectory)
const cli = join(scriptDirectory, 'definedmotion.mjs')
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'definedmotion-smoke-'))

function run(arguments_) {
  const result = spawnSync(process.execPath, [cli, ...arguments_, '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit']
  })

  if (!result.stdout) throw new Error(`CLI returned no JSON for: ${arguments_.join(' ')}`)
  const parsed = JSON.parse(result.stdout)
  if (result.status !== 0 || !parsed.success) {
    throw new Error(parsed.error?.message ?? `CLI failed with code ${result.status}`)
  }
  return parsed
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

try {
  const scenes = run(['scenes'])
  if (scenes.scenes.length !== 47) {
    throw new Error(`Expected 47 automatically discovered scenes, received ${scenes.scenes.length}`)
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

  process.stdout.write('DefinedMotion automation smoke test passed\n')
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true })
}
