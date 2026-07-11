/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { isAbsolute, join, resolve } from 'node:path'
import { projectRoot } from './context.mjs'
import { CliError } from './shared.mjs'

export const usage = `DefinedMotion automation CLI

Usage:
  definedmotion session start [--foreground] [--json]
  definedmotion session status [--json]
  definedmotion session stop [--json]
  definedmotion scenes [--exclude-tests] [--json] [--no-build] [--standalone]
  definedmotion still <scene> --frame <number> [--output <file>] [--json] [--no-build] [--standalone]

Session-aware commands use a running persistent runtime automatically.
Pass --standalone to force a fresh build and Electron process, or
--require-session to fail when no runtime session is available.

Examples:
  npm run dm -- session start
  npm run dm -- scenes
  npm run dm -- still tutorial-easy-1 --frame 120 --output .definedmotion/frame.png
  npm run dm -- session stop
`

export function parseArguments(values) {
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

export function buildAutomationRequest(command, positionals, flags) {
  if (command === 'scenes') {
    return { command: 'scenes', excludeTests: flags['exclude-tests'] === true }
  }

  if (command === 'still') {
    const scene = positionals[1]
    const frame = Number(flags.frame)
    if (!scene || flags.frame === undefined || !Number.isInteger(frame) || frame < 0) {
      throw new CliError(
        'INVALID_ARGUMENTS',
        'Usage: definedmotion still <scene> --frame <non-negative integer> [--output <file>]'
      )
    }

    const defaultOutput = join('.definedmotion', 'stills', `${scene}-frame-${frame}.png`)
    const outputValue = typeof flags.output === 'string' ? flags.output : defaultOutput
    return {
      command: 'still',
      scene,
      frame,
      output: isAbsolute(outputValue) ? outputValue : resolve(projectRoot, outputValue)
    }
  }

  throw new CliError('UNKNOWN_COMMAND', `Unknown command "${command}"`)
}

export function emit(result, json) {
  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    return
  }

  if (!result.success) {
    process.stderr.write(`DefinedMotion: ${result.error.message}\n`)
    return
  }

  if (result.command === 'session') {
    if (result.action === 'stop') {
      process.stdout.write('DefinedMotion runtime session stopped\n')
      return
    }
    process.stdout.write(
      `DefinedMotion runtime ${result.status} (${result.runtimeId ?? 'not running'}${result.generation ? `, generation ${result.generation}` : ''})\n`
    )
    return
  }

  if (result.command === 'scenes') {
    for (const scene of result.scenes ?? []) {
      const labels = [scene.isDefault ? 'default' : undefined, scene.isTest ? 'test' : undefined]
        .filter(Boolean)
        .join(', ')
      process.stdout.write(`${scene.id}${labels ? ` (${labels})` : ''}\t${scene.name}\n`)
    }
    return
  }

  process.stdout.write(
    `Rendered ${result.scene} frame ${result.frame} to ${result.output} (${result.renderTimeMs} ms${result.runtimeId ? `, runtime generation ${result.generation}` : ''})\n`
  )
}
