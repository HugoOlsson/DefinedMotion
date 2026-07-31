import { spawn } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectRoot = resolve(packageRoot, '..', '..', 'playground')
const cli = join(packageRoot, 'cli', 'index.mjs')
const timeoutMs = 90_000

const child = spawn(process.execPath, [cli, 'dev', '--project', projectRoot], {
  cwd: projectRoot,
  env: { ...process.env, DEFINEDMOTION_VIEWER_TEST: '1' },
  stdio: ['ignore', 'pipe', 'pipe']
})

let output = ''
let completed = false

const append = (chunk) => {
  output += chunk.toString()
  if (output.length > 80_000) output = output.slice(-80_000)
}
child.stdout.on('data', append)
child.stderr.on('data', append)

const timeout = setTimeout(() => {
  child.kill('SIGTERM')
}, timeoutMs)

const exit = await new Promise((resolve) => {
  child.once('exit', (code, signal) => resolve({ code, signal }))
})
clearTimeout(timeout)

completed = output.includes('DEFINEDMOTION_VIEWER_TEST_OK')
if (!completed || exit.code !== 0) {
  process.stderr.write(output)
  throw new Error(
    `Viewer integration failed (code ${exit.code}, signal ${exit.signal ?? 'none'})`
  )
}

const line = output.split('\n').find((entry) => entry.includes('DEFINEDMOTION_VIEWER_TEST_OK'))
console.log(line?.trim() ?? 'DefinedMotion viewer integration passed')
