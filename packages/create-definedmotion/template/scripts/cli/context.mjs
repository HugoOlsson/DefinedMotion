import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const cliDirectory = dirname(fileURLToPath(import.meta.url))
export const scriptsDirectory = resolve(cliDirectory, '..')
export const projectRoot = resolve(scriptsDirectory, '..')
export const projectRequire = createRequire(join(projectRoot, 'package.json'))
export const runtimeDirectory = join(projectRoot, '.definedmotion')
export const descriptorPath = join(runtimeDirectory, 'runtime.json')
export const runtimeLogPath = join(runtimeDirectory, 'runtime.log')

const projectHash = createHash('sha256').update(projectRoot).digest('hex').slice(0, 16)
export const socketPath =
  process.platform === 'win32'
    ? `\\\\.\\pipe\\definedmotion-${projectHash}`
    : join(tmpdir(), `definedmotion-${projectHash}.sock`)

const electronVitePackage = projectRequire.resolve('electron-vite/package.json')
export const electronViteBin = join(dirname(electronVitePackage), 'bin', 'electron-vite.js')
