import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const rawName = process.argv[2]
const name = rawName
  ?.replace(/\.md$/, '')
  .replace(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}_/, '')

if (!name) {
  process.stderr.write('Usage: npm run test:integration -- <name>\n')
  process.exit(1)
}

const command = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const run = (script, extra = []) => {
  const result = spawnSync(command, ['run', script, ...extra], {
    cwd: packageRoot,
    stdio: 'inherit'
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

run('test:proposal', ['--', name])
if (name === 'viewer-preview' || name === 'viewer-scene-selection') run('test:viewer')
else if (name === 'documentation-system' || name === 'implementation-testing') {
  run('test:documentation')
} else run('test:scenes')
