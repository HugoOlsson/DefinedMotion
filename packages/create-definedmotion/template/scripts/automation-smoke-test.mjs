/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
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
  if (!scenes.scenes.some((scene) => scene.id === 'tutorial-easy-1' && scene.isDefault)) {
    throw new Error('Default tutorial scene was not discoverable')
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
