/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { spawn } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync } from 'node:fs'
import { createConnection } from 'node:net'
import { computeSourceRevision } from '../source-revision.mjs'
import {
  descriptorPath,
  electronViteBin,
  projectRoot,
  runtimeDirectory,
  runtimeLogPath,
  socketPath
} from './context.mjs'
import { CliError, cliFailure, delay } from './shared.mjs'

export function readRuntimeDescriptor() {
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

export function cleanupStaleRuntime(descriptor) {
  rmSync(descriptorPath, { force: true })
  if (process.platform !== 'win32' && descriptor?.socketPath) {
    rmSync(descriptor.socketPath, { force: true })
  }
}

export async function runtimeStatus() {
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

export async function startRuntime(foreground = false) {
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

export async function stopRuntime() {
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

export async function executeWithRuntime(request) {
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

const staleConnectionCodes = new Set(['ECONNREFUSED', 'ECONNRESET', 'ENOENT', 'EPIPE'])
export const isStaleConnectionError = (error) =>
  error instanceof Error && staleConnectionCodes.has(error.code)

export const sessionConnectionError = (error) => {
  const normalized = error instanceof Error ? error : new Error(String(error))
  return new CliError(
    error?.code === 'EACCES' || error?.code === 'EPERM'
      ? 'SESSION_ACCESS_DENIED'
      : 'SESSION_CONNECTION_FAILED',
    `Could not connect to the runtime session: ${normalized.message}`
  )
}
