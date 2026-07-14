import { spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { createRequire } from 'node:module'

const packageRoot = new URL('..', import.meta.url)
const require = createRequire(import.meta.url)
const compiler = require.resolve('typescript/bin/tsc')

rmSync(new URL('../types', import.meta.url), { recursive: true, force: true })
const result = spawnSync(process.execPath, [compiler, '-p', 'tsconfig.types.json'], {
  cwd: packageRoot,
  stdio: 'inherit'
})

if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status ?? 1)
