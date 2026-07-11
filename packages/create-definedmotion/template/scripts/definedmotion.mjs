#!/usr/bin/env node

import { buildAutomationRequest, emit, parseArguments, usage } from './cli/interface.mjs'
import {
  cleanupStaleRuntime,
  executeWithRuntime,
  isStaleConnectionError,
  readRuntimeDescriptor,
  runtimeStatus,
  sessionConnectionError,
  startRuntime,
  stopRuntime
} from './cli/session.mjs'
import { CliError, cliFailure } from './cli/shared.mjs'
import { executeStandalone } from './cli/standalone.mjs'

const { positionals, flags } = parseArguments(process.argv.slice(2))
const command = positionals[0]
const json = flags.json === true

if (!command || flags.help || command === 'help') {
  process.stdout.write(usage)
  process.exit(0)
}

let result
try {
  if (flags.standalone === true && flags['require-session'] === true) {
    throw new CliError('INVALID_ARGUMENTS', '--standalone and --require-session cannot be combined')
  }

  if (command === 'session') {
    const action = positionals[1]
    if (action === 'start') result = await startRuntime(flags.foreground === true)
    else if (action === 'status') result = await runtimeStatus()
    else if (action === 'stop') result = await stopRuntime()
    else throw new CliError('INVALID_ARGUMENTS', 'Usage: definedmotion session <start|status|stop>')
  } else {
    const request = buildAutomationRequest(command, positionals, flags)
    if (flags.standalone !== true) {
      try {
        result = await executeWithRuntime(request)
      } catch (error) {
        if (!isStaleConnectionError(error)) throw sessionConnectionError(error)
        cleanupStaleRuntime(readRuntimeDescriptor())
        if (flags['require-session'] === true) throw sessionConnectionError(error)
      }
    }

    if (!result) {
      if (flags['require-session'] === true) {
        throw new CliError('SESSION_NOT_RUNNING', 'No compatible DefinedMotion runtime is running')
      }
      result = executeStandalone(request, flags)
    }
  }
} catch (error) {
  const normalized = error instanceof Error ? error : new Error(String(error))
  result = cliFailure(
    command,
    error instanceof CliError ? error.code : 'CLI_FAILED',
    normalized.message
  )
}

emit(result, json)
if (!result.success && !json && result.error.code === 'UNKNOWN_COMMAND') {
  process.stderr.write(`\n${usage}`)
}
process.exitCode = result.success ? 0 : 1
