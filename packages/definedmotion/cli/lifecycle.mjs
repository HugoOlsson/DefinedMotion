import { spawnSync } from 'node:child_process'
import { electronViteArguments, projectRoot, runtimeEnvironment } from './context.mjs'

export const runLifecycleCommand = (command) => {
  const electronViteCommand = command === 'dev' ? 'dev' : command
  const result = spawnSync(process.execPath, electronViteArguments(electronViteCommand), {
    cwd: projectRoot,
    env: runtimeEnvironment(),
    stdio: 'inherit'
  })
  if (result.error) throw result.error
  return result.status ?? 1
}
