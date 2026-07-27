/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildDirectory,
  electronViteArguments,
  packageRequire,
  projectRoot,
  runtimeEnvironment
} from './context.mjs'
import { cliFailure } from './shared.mjs'

export function executeStandalone(request, flags) {
  if (flags['no-build'] !== true) {
    const build = spawnSync(process.execPath, electronViteArguments('build'), {
      cwd: projectRoot,
      env: runtimeEnvironment(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    })

    if (build.status !== 0) {
      if (build.stdout) process.stderr.write(build.stdout)
      if (build.stderr) process.stderr.write(build.stderr)
      return cliFailure(
        request.command,
        'BUILD_FAILED',
        'Could not build the DefinedMotion project'
      )
    }
  }

  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'definedmotion-'))
  const resultPath = join(temporaryDirectory, 'result.json')

  try {
    const electronPath = packageRequire('electron')
    const mainEntry = join(buildDirectory, 'main', 'index.js')

    if (!existsSync(electronPath)) {
      return cliFailure(
        request.command,
        'ELECTRON_NOT_INSTALLED',
        `Electron's executable was not found at ${electronPath}. Run npm install in the project.`
      )
    }
    if (!existsSync(mainEntry)) {
      return cliFailure(
        request.command,
        'BUILD_NOT_FOUND',
        `Built Electron entry was not found at ${mainEntry}`
      )
    }

    const execution = spawnSync(electronPath, [mainEntry], {
      cwd: projectRoot,
      stdio: ['ignore', 'ignore', 'inherit'],
      env: {
        ...runtimeEnvironment(),
        DEFINEDMOTION_AUTOMATION_REQUEST: JSON.stringify(request),
        DEFINEDMOTION_AUTOMATION_RESULT: resultPath,
        DEFINEDMOTION_CLI_PROGRESS: flags.json === true ? 'json' : 'text'
      }
    })

    if (!existsSync(resultPath)) {
      return cliFailure(
        request.command,
        'AUTOMATION_DID_NOT_RESPOND',
        execution.error
          ? `Could not launch Electron: ${execution.error.message}`
          : execution.signal
            ? `Electron exited after signal ${execution.signal}`
            : `Electron exited with code ${execution.status ?? 'unknown'} without returning a result`
      )
    }

    const result = JSON.parse(readFileSync(resultPath, 'utf8'))
    return result
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true })
  }
}
