import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const rawName = process.argv[2]
const name = rawName
  ?.replace(/\.md$/, '')
  .replace(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}_/, '')

const scripts = {
  'new-animation-api': 'test:animation-plan',
  'timeline-beats': 'test:timeline-beats',
  'core-animation-effects': 'test:core-effects',
  'text-and-latex': 'test:visual-primitives',
  'primitive-layout': 'test:layout',
  'scene-verifications': 'test:verification',
  'viewer-preview': 'test:viewer-preview',
  'viewer-scene-selection': 'test:viewer-selection',
  'documentation-system': 'test:documentation',
  'implementation-testing': 'test:testing-system',
  'legacy-deletion': 'test:legacy-deletion'
}

if (!name || !scripts[name]) {
  process.stderr.write(
    `Usage: npm run test:proposal -- <name>\nAvailable: ${Object.keys(scripts).join(', ')}\n`
  )
  process.exit(1)
}

const command = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const result = spawnSync(command, ['run', scripts[name]], {
  cwd: packageRoot,
  stdio: 'inherit'
})
if (result.error) throw result.error
process.exit(result.status ?? 1)
