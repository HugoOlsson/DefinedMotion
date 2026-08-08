import { spawnSync } from 'node:child_process'
import {
  electronViteArguments,
  packageRequire,
  projectRoot,
  runtimeEnvironment
} from './context.mjs'

export const runLifecycleCommand = (command) => {
  const electronViteCommand = command === 'dev' ? 'dev' : command
  const environment = runtimeEnvironment()
  if (command === 'dev' || command === 'preview') {
    environment.ELECTRON_EXEC_PATH = packageRequire('electron')
  }
  const result = spawnSync(process.execPath, electronViteArguments(electronViteCommand), {
    cwd: projectRoot,
    env: environment,
    stdio: 'inherit'
  })
  if (result.error) throw result.error
  return result.status ?? 1
}
