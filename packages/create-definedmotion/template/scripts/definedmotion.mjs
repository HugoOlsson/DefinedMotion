#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDir, '..')
const require = createRequire(join(projectRoot, 'package.json'))

const usage = `DefinedMotion automation CLI

Usage:
  definedmotion scenes [--json] [--no-build]
  definedmotion still <scene> --frame <number> [--output <file>] [--json] [--no-build]

Examples:
  npm run dm -- scenes
  npm run dm -- still tutorial-easy-1 --frame 120 --output .definedmotion/frame.png
`

function parseArguments(values) {
  const positionals = []
  const flags = {}

  for (let index = 0; index < values.length; index++) {
    const value = values[index]
    if (!value.startsWith('--')) {
      positionals.push(value)
      continue
    }

    const equals = value.indexOf('=')
    if (equals !== -1) {
      flags[value.slice(2, equals)] = value.slice(equals + 1)
      continue
    }

    const name = value.slice(2)
    const next = values[index + 1]
    if (next !== undefined && !next.startsWith('--')) {
      flags[name] = next
      index++
    } else {
      flags[name] = true
    }
  }

  return { positionals, flags }
}

function emit(result, json) {
  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    return
  }

  if (!result.success) {
    process.stderr.write(`DefinedMotion: ${result.error.message}\n`)
    return
  }

  if (result.command === 'scenes') {
    for (const scene of result.scenes ?? []) {
      process.stdout.write(`${scene.id}${scene.isDefault ? ' (default)' : ''}\t${scene.name}\n`)
    }
    return
  }

  process.stdout.write(
    `Rendered ${result.scene} frame ${result.frame} to ${result.output} (${result.renderTimeMs} ms)\n`
  )
}

function cliFailure(command, code, message) {
  return { success: false, command, error: { code, message } }
}

const { positionals, flags } = parseArguments(process.argv.slice(2))
const command = positionals[0]
const json = flags.json === true

if (!command || flags.help || command === 'help') {
  process.stdout.write(usage)
  process.exit(0)
}

let request
if (command === 'scenes') {
  request = { command: 'scenes' }
} else if (command === 'still') {
  const scene = positionals[1]
  const frame = Number(flags.frame)

  if (!scene || flags.frame === undefined || !Number.isInteger(frame) || frame < 0) {
    const result = cliFailure(
      'still',
      'INVALID_ARGUMENTS',
      'Usage: definedmotion still <scene> --frame <non-negative integer> [--output <file>]'
    )
    emit(result, json)
    process.exit(2)
  }

  const defaultOutput = join('.definedmotion', 'stills', `${scene}-frame-${frame}.png`)
  const outputValue = typeof flags.output === 'string' ? flags.output : defaultOutput
  request = {
    command: 'still',
    scene,
    frame,
    output: isAbsolute(outputValue) ? outputValue : resolve(projectRoot, outputValue)
  }
} else {
  const result = cliFailure(command, 'UNKNOWN_COMMAND', `Unknown command "${command}"`)
  emit(result, json)
  if (!json) process.stderr.write(`\n${usage}`)
  process.exit(2)
}

if (flags['no-build'] !== true) {
  const electronVitePackage = require.resolve('electron-vite/package.json')
  const electronViteBin = join(dirname(electronVitePackage), 'bin', 'electron-vite.js')
  const build = spawnSync(process.execPath, [electronViteBin, 'build'], {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  })

  if (build.status !== 0) {
    if (build.stdout) process.stderr.write(build.stdout)
    if (build.stderr) process.stderr.write(build.stderr)
    const result = cliFailure(command, 'BUILD_FAILED', 'Could not build the DefinedMotion project')
    emit(result, json)
    process.exit(1)
  }
}

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'definedmotion-'))
const resultPath = join(temporaryDirectory, 'result.json')

try {
  const electronPath = require('electron')
  const mainEntry = join(projectRoot, 'out', 'main', 'index.js')

  if (!existsSync(electronPath)) {
    const result = cliFailure(
      command,
      'ELECTRON_NOT_INSTALLED',
      `Electron's executable was not found at ${electronPath}. Run npm install in the project.`
    )
    emit(result, json)
    process.exitCode = 1
  } else if (!existsSync(mainEntry)) {
    const result = cliFailure(
      command,
      'BUILD_NOT_FOUND',
      `Built Electron entry was not found at ${mainEntry}`
    )
    emit(result, json)
    process.exitCode = 1
  } else {
    const execution = spawnSync(electronPath, [mainEntry], {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'ignore', 'pipe'],
      env: {
        ...process.env,
        DEFINEDMOTION_AUTOMATION_REQUEST: JSON.stringify(request),
        DEFINEDMOTION_AUTOMATION_RESULT: resultPath
      }
    })

    if (!existsSync(resultPath)) {
      if (execution.stderr) process.stderr.write(execution.stderr)
      const result = cliFailure(
        command,
        'AUTOMATION_DID_NOT_RESPOND',
        execution.error
          ? `Could not launch Electron: ${execution.error.message}`
          : execution.signal
            ? `Electron exited after signal ${execution.signal}`
            : `Electron exited with code ${execution.status ?? 'unknown'} without returning a result`
      )
      emit(result, json)
      process.exitCode = 1
    } else {
      const result = JSON.parse(readFileSync(resultPath, 'utf8'))
      if (!result.success && execution.stderr) process.stderr.write(execution.stderr)
      emit(result, json)
      process.exitCode = result.success ? 0 : 1
    }
  }
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true })
}
