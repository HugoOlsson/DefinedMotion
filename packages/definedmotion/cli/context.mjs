import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, parse, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const cliDirectory = dirname(fileURLToPath(import.meta.url))
export const packageRoot = resolve(cliDirectory, '..')

const projectArgument = (() => {
  const values = process.argv.slice(2)
  const explicit = values.find((value) => value.startsWith('--project='))
  if (explicit) return explicit.slice('--project='.length)
  const index = values.indexOf('--project')
  return index === -1 ? undefined : values[index + 1]
})()

const findProjectRoot = (start) => {
  let directory = resolve(start)
  const filesystemRoot = parse(directory).root
  while (true) {
    if (existsSync(join(directory, 'definedmotion.config.ts'))) return directory
    if (directory === filesystemRoot) break
    directory = dirname(directory)
  }
  return resolve(start)
}

export const projectRoot = projectArgument
  ? findProjectRoot(resolve(process.cwd(), projectArgument))
  : findProjectRoot(process.cwd())
export const projectRequire = createRequire(join(projectRoot, 'package.json'))
export const packageRequire = createRequire(join(packageRoot, 'package.json'))
export const runtimeDirectory = join(projectRoot, '.definedmotion')
export const buildDirectory = join(runtimeDirectory, 'build')
export const descriptorPath = join(runtimeDirectory, 'runtime.json')
export const runtimeLogPath = join(runtimeDirectory, 'runtime.log')
export const electronViteConfig = join(packageRoot, 'electron.vite.config.ts')

const projectHash = createHash('sha256').update(projectRoot).digest('hex').slice(0, 16)
export const socketPath =
  process.platform === 'win32'
    ? `\\\\.\\pipe\\definedmotion-${projectHash}`
    : join(tmpdir(), `definedmotion-${projectHash}.sock`)

const electronVitePackage = packageRequire.resolve('electron-vite/package.json')
export const electronViteBin = join(dirname(electronVitePackage), 'bin', 'electron-vite.js')

export const runtimeEnvironment = () => ({
  ...process.env,
  DEFINEDMOTION_PACKAGE_ROOT: packageRoot,
  DEFINEDMOTION_PROJECT_ROOT: projectRoot
})

export const electronViteArguments = (command, additional = []) => [
  electronViteBin,
  command,
  packageRoot,
  '--config',
  electronViteConfig,
  '--entry',
  join(buildDirectory, 'main', 'index.js'),
  ...additional
]
