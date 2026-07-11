#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { spawn, spawnSync } from 'node:child_process'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { createConnection } from 'node:net'
import {
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync
} from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { computeSourceRevision } from './source-revision.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDir, '..')
const require = createRequire(join(projectRoot, 'package.json'))
const runtimeDirectory = join(projectRoot, '.definedmotion')
const descriptorPath = join(runtimeDirectory, 'runtime.json')
const runtimeLogPath = join(runtimeDirectory, 'runtime.log')
const projectHash = createHash('sha256').update(projectRoot).digest('hex').slice(0, 16)
const socketPath =
  process.platform === 'win32'
    ? `\\\\.\\pipe\\definedmotion-${projectHash}`
    : join(tmpdir(), `definedmotion-${projectHash}.sock`)
const electronVitePackage = require.resolve('electron-vite/package.json')
const electronViteBin = join(dirname(electronVitePackage), 'bin', 'electron-vite.js')

const usage = `DefinedMotion automation CLI

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

function cliFailure(command, code, message) {
  return { success: false, command, error: { code, message } }
}

function buildAutomationRequest(command, positionals, flags) {
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

class CliError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

function readRuntimeDescriptor() {
  if (!existsSync(descriptorPath)) return undefined
  try {
    const descriptor = JSON.parse(readFileSync(descriptorPath, 'utf8'))
    if (
      descriptor.protocolVersion !== 1 ||
      descriptor.projectRoot !== projectRoot ||
      typeof descriptor.socketPath !== 'string' ||
      typeof descriptor.token !== 'string'
    ) {
      return undefined
    }
    return descriptor
  } catch {
    return undefined
  }
}

function sendRuntimeRequest(descriptor, request, timeoutMs = 35_000) {
  return new Promise((resolvePromise, rejectPromise) => {
    const socket = createConnection(descriptor.socketPath)
    socket.setEncoding('utf8')
    let buffer = ''
    const timeout = setTimeout(() => {
      socket.destroy()
      rejectPromise(new CliError('SESSION_TIMEOUT', 'Runtime session did not respond in time'))
    }, timeoutMs)

    const finishError = (error) => {
      clearTimeout(timeout)
      socket.destroy()
      rejectPromise(error)
    }

    socket.once('connect', () => {
      socket.write(`${JSON.stringify({ ...request, token: descriptor.token })}\n`)
    })
    socket.once('error', finishError)
    socket.on('data', (chunk) => {
      buffer += chunk
      const newline = buffer.indexOf('\n')
      if (newline === -1) return
      clearTimeout(timeout)
      socket.removeListener('error', finishError)
      socket.end()
      try {
        resolvePromise(JSON.parse(buffer.slice(0, newline)))
      } catch {
        rejectPromise(new CliError('INVALID_SESSION_RESPONSE', 'Runtime returned invalid JSON'))
      }
    })
  })
}

function cleanupStaleRuntime(descriptor) {
  rmSync(descriptorPath, { force: true })
  if (process.platform !== 'win32' && descriptor?.socketPath) {
    rmSync(descriptor.socketPath, { force: true })
  }
}

async function runtimeStatus() {
  const descriptor = readRuntimeDescriptor()
  if (!descriptor) {
    return {
      success: true,
      command: 'session',
      action: 'status',
      status: 'stopped'
    }
  }
  try {
    return await sendRuntimeRequest(descriptor, { action: 'status' }, 2_000)
  } catch (error) {
    if (isStaleConnectionError(error)) {
      return {
        success: true,
        command: 'session',
        action: 'status',
        status: 'stale'
      }
    }
    throw sessionConnectionError(error)
  }
}

async function startRuntime(foreground = false) {
  const existingStatus = await runtimeStatus()
  if (existingStatus.status === 'ready' || existingStatus.status === 'loading') {
    return { ...existingStatus, action: 'start' }
  }

  cleanupStaleRuntime(readRuntimeDescriptor())
  mkdirSync(runtimeDirectory, { recursive: true })

  const runtimeId = `runtime-${randomUUID().slice(0, 8)}`
  const token = randomBytes(32).toString('hex')
  const logFile = foreground ? undefined : openSync(runtimeLogPath, 'a')
  const child = spawn(process.execPath, [electronViteBin, 'dev', '--watch', '--logLevel', 'warn'], {
    cwd: projectRoot,
    detached: !foreground,
    stdio: foreground ? 'inherit' : ['ignore', logFile, logFile],
    env: {
      ...process.env,
      DEFINEDMOTION_SESSION_RUNTIME_ID: runtimeId,
      DEFINEDMOTION_SESSION_TOKEN: token,
      DEFINEDMOTION_SESSION_SOCKET: socketPath,
      DEFINEDMOTION_SESSION_DESCRIPTOR: descriptorPath
    }
  })
  if (foreground) {
    const forwardSignal = (signal) => child.kill(signal)
    process.once('SIGINT', forwardSignal)
    process.once('SIGTERM', forwardSignal)
    const exitCode = await new Promise((resolvePromise, rejectPromise) => {
      child.once('error', rejectPromise)
      child.once('close', (code) => resolvePromise(code ?? 0))
    })
    process.removeListener('SIGINT', forwardSignal)
    process.removeListener('SIGTERM', forwardSignal)
    return exitCode === 0
      ? {
          success: true,
          command: 'session',
          action: 'start',
          status: 'stopped'
        }
      : cliFailure('session', 'SESSION_EXITED', `Runtime process exited with code ${exitCode}`)
  }

  child.unref()
  closeSync(logFile)

  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    await delay(100)
    const descriptor = readRuntimeDescriptor()
    if (!descriptor) continue
    try {
      const status = await sendRuntimeRequest(descriptor, { action: 'status' }, 1_000)
      if (status.status === 'ready') return { ...status, action: 'start' }
    } catch {
      // electron-vite may still be compiling or launching Electron.
    }
  }

  throw new CliError(
    'SESSION_START_TIMEOUT',
    `Runtime did not become ready within 30 seconds. See ${runtimeLogPath}`
  )
}

async function stopRuntime() {
  const descriptor = readRuntimeDescriptor()
  if (!descriptor) {
    cleanupStaleRuntime(undefined)
    return {
      success: true,
      command: 'session',
      action: 'stop',
      status: 'stopped'
    }
  }

  try {
    const result = await sendRuntimeRequest(descriptor, { action: 'stop' }, 2_000)
    const deadline = Date.now() + 5_000
    while (existsSync(descriptorPath) && Date.now() < deadline) await delay(50)
    return result
  } catch (error) {
    if (!isStaleConnectionError(error)) throw sessionConnectionError(error)
    cleanupStaleRuntime(descriptor)
    return {
      success: true,
      command: 'session',
      action: 'stop',
      status: 'stale-cleaned'
    }
  }
}

async function executeWithRuntime(request) {
  const descriptor = readRuntimeDescriptor()
  if (!descriptor) return undefined

  for (let attempt = 0; attempt < 3; attempt++) {
    const sourceRevision = computeSourceRevision(projectRoot)
    const result = await sendRuntimeRequest(descriptor, {
      action: 'execute',
      sourceRevision,
      request
    })
    const revisionAfterRequest = computeSourceRevision(projectRoot)
    const retryableRuntimeError =
      !result.success &&
      ['SOURCE_REVISION_CHANGED', 'SOURCE_CHANGED_DURING_REQUEST'].includes(result.error?.code)
    if (!result.success && !retryableRuntimeError) return result
    if (result.success && result.sourceRevision === revisionAfterRequest) return result
  }

  return cliFailure(
    request.command,
    'SOURCE_CHANGING_TOO_QUICKLY',
    'Source changed repeatedly while the runtime was preparing the request'
  )
}

function executeStandalone(request, flags) {
  if (flags['no-build'] !== true) {
    const build = spawnSync(process.execPath, [electronViteBin, 'build'], {
      cwd: projectRoot,
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
    const electronPath = require('electron')
    const mainEntry = join(projectRoot, 'out', 'main', 'index.js')

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
    if (!result.success && execution.stderr) process.stderr.write(execution.stderr)
    return result
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true })
  }
}

const delay = (milliseconds) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds))

const staleConnectionCodes = new Set(['ECONNREFUSED', 'ECONNRESET', 'ENOENT', 'EPIPE'])
const isStaleConnectionError = (error) =>
  error instanceof Error && staleConnectionCodes.has(error.code)

const sessionConnectionError = (error) => {
  const normalized = error instanceof Error ? error : new Error(String(error))
  return new CliError(
    error?.code === 'EACCES' || error?.code === 'EPERM'
      ? 'SESSION_ACCESS_DENIED'
      : 'SESSION_CONNECTION_FAILED',
    `Could not connect to the runtime session: ${normalized.message}`
  )
}

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
