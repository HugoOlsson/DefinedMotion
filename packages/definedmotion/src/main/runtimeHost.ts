import { app, type BrowserWindow } from 'electron'
import { randomUUID } from 'node:crypto'
import { chmodSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { createServer, type Server, type Socket } from 'node:net'
import { dirname, relative, resolve } from 'node:path'
import type {
  AutomationRequest,
  AutomationResult,
  RuntimeClientRequest,
  RuntimeDescriptor,
  RuntimeSourceDiagnostic
} from '../automation/types'
import { computeSourceRevision } from '../source-revision.mjs'
import { getProjectRoot } from '../projectPaths'

interface PersistentRuntimeConfig {
  runtimeId: string
  token: string
  socketPath: string
  descriptorPath: string
  launcherPid?: number
}

interface RevisionWaiter {
  revision: string
  readySequence: number
  resolve: () => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

interface RendererResultWaiter {
  resolve: (result: AutomationResult) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

interface SourceFailure {
  revision: string
  code: SourceFailureCode
  diagnostic: RuntimeSourceDiagnostic
}

type SourceFailureCode = 'SOURCE_COMPILE_ERROR' | 'SOURCE_EVALUATION_FAILED'

class RuntimeHostError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly diagnostic?: Omit<RuntimeSourceDiagnostic, 'message'>
  ) {
    super(message)
    this.name = 'RuntimeHostError'
  }
}

export const getPersistentRuntimeConfig = (): PersistentRuntimeConfig | undefined => {
  const runtimeId = process.env['DEFINEDMOTION_SESSION_RUNTIME_ID']
  const token = process.env['DEFINEDMOTION_SESSION_TOKEN']
  const socketPath = process.env['DEFINEDMOTION_SESSION_SOCKET']
  const descriptorPath = process.env['DEFINEDMOTION_SESSION_DESCRIPTOR']
  if (!runtimeId || !token || !socketPath || !descriptorPath) return undefined

  const launcherPidValue = Number(process.env['DEFINEDMOTION_SESSION_LAUNCHER_PID'])
  return {
    runtimeId,
    token,
    socketPath,
    descriptorPath,
    launcherPid: Number.isInteger(launcherPidValue) ? launcherPidValue : undefined
  }
}

export class PersistentRuntimeHost {
  private readonly server: Server
  private readonly projectRoot = getProjectRoot()
  private rendererRevision?: string
  private generation = 0
  private readySequence = 0
  private revisionWaiters = new Set<RevisionWaiter>()
  private rendererResults = new Map<string, RendererResultWaiter>()
  private requestQueue: Promise<void> = Promise.resolve()
  private sourceFailure?: SourceFailure
  private stopped = false

  constructor(
    private readonly window: BrowserWindow,
    private readonly config: PersistentRuntimeConfig
  ) {
    this.server = createServer((socket) => this.handleConnection(socket))
    this.window.webContents.on('did-start-loading', () => this.markRendererLoading())
    this.window.webContents.on('render-process-gone', (_event, details) => {
      this.markRendererUnavailable(
        new RuntimeHostError('RENDERER_CRASHED', `Renderer exited: ${details.reason}`)
      )
    })
  }

  async start(): Promise<void> {
    if (process.platform !== 'win32') rmSync(this.config.socketPath, { force: true })
    await new Promise<void>((resolvePromise, rejectPromise) => {
      this.server.once('error', rejectPromise)
      this.server.listen(this.config.socketPath, () => {
        this.server.off('error', rejectPromise)
        resolvePromise()
      })
    })
    if (process.platform !== 'win32') chmodSync(this.config.socketPath, 0o600)
    await this.writeDescriptor()
  }

  rendererReady(sourceRevision: string): void {
    const revisionChanged = this.rendererRevision !== sourceRevision
    this.rendererRevision = sourceRevision
    this.readySequence++
    if (revisionChanged) this.generation++
    if (this.sourceFailure?.revision === sourceRevision) this.sourceFailure = undefined

    for (const waiter of [...this.revisionWaiters]) {
      if (waiter.revision === sourceRevision) {
        this.finishRevisionWaiter(waiter, () => waiter.resolve())
      } else if (this.readySequence > waiter.readySequence) {
        this.finishRevisionWaiter(waiter, () =>
          waiter.reject(
            new RuntimeHostError(
              'SOURCE_REVISION_CHANGED',
              'Source changed again while the runtime was preparing the requested revision; retry the command'
            )
          )
        )
      }
    }
  }

  rendererFailed(sourceRevision: string, diagnostic: RuntimeSourceDiagnostic): void {
    const revision =
      sourceRevision === 'unknown' ? computeSourceRevision(this.projectRoot) : sourceRevision
    this.recordSourceFailure(revision, diagnostic, 'SOURCE_EVALUATION_FAILED')
  }

  rendererResult(id: string, result: AutomationResult): void {
    const waiter = this.rendererResults.get(id)
    if (!waiter) return
    clearTimeout(waiter.timeout)
    this.rendererResults.delete(id)
    waiter.resolve(result)
  }

  stop(): void {
    if (this.stopped) return
    this.stopped = true
    this.markRendererUnavailable(new RuntimeHostError('SESSION_STOPPED', 'Runtime session stopped'))
    this.server.close()
    this.removeRuntimeFiles()
  }

  private handleConnection(socket: Socket): void {
    socket.setEncoding('utf8')
    let buffer = ''

    socket.on('data', (chunk: string) => {
      buffer += chunk
      if (buffer.length > 1_000_000) {
        this.respond(socket, this.failure('REQUEST_TOO_LARGE', 'Runtime request exceeded 1 MB'))
        return
      }

      const newline = buffer.indexOf('\n')
      if (newline === -1) return
      const message = buffer.slice(0, newline)
      buffer = ''
      void this.processMessage(message).then((response) => this.respond(socket, response))
    })

    socket.on('error', () => {
      socket.destroy()
    })
  }

  private async processMessage(message: string): Promise<unknown> {
    let request: RuntimeClientRequest
    try {
      request = JSON.parse(message) as RuntimeClientRequest
    } catch {
      return this.failure('INVALID_REQUEST', 'Runtime request was not valid JSON')
    }

    if (request.token !== this.config.token) {
      return this.failure('UNAUTHORIZED', 'Runtime session token was invalid')
    }

    if (request.action === 'status') return this.status()
    if (request.action === 'source-error') {
      if (
        typeof request.sourceRevision !== 'string' ||
        !request.diagnostic ||
        typeof request.diagnostic.message !== 'string'
      ) {
        return this.failure('INVALID_SOURCE_DIAGNOSTIC', 'Vite sent an invalid source diagnostic')
      }
      this.recordSourceFailure(request.sourceRevision, request.diagnostic, 'SOURCE_COMPILE_ERROR')
      return { success: true, action: 'source-error' }
    }
    if (request.action === 'stop') {
      setTimeout(() => app.quit(), 25)
      return {
        success: true,
        command: 'session',
        action: 'stop',
        ...this.statusMetadata()
      }
    }
    if (request.action !== 'execute') {
      return this.failure('UNKNOWN_SESSION_ACTION', 'Unknown runtime session action')
    }

    return this.enqueue(async () => {
      try {
        const sourceFailure = this.failureForRevision(request.sourceRevision)
        if (sourceFailure) throw this.sourceFailureError(sourceFailure)
        if (
          this.rendererRevision !== request.sourceRevision &&
          computeSourceRevision(this.projectRoot) !== request.sourceRevision
        ) {
          throw new RuntimeHostError(
            'SOURCE_REVISION_CHANGED',
            'Source changed before the runtime received the request; retry the command'
          )
        }
        await this.ensureRendererRevision(request.sourceRevision)
        const result = await this.executeInRenderer(request.request)
        return {
          ...result,
          runtimeId: this.config.runtimeId,
          generation: this.generation,
          sourceRevision: this.rendererRevision
        }
      } catch (error) {
        const normalized = error instanceof Error ? error : new Error(String(error))
        return {
          success: false,
          command: request.request.command,
          error: {
            code: error instanceof RuntimeHostError ? error.code : 'SESSION_FAILED',
            message: normalized.message,
            ...(error instanceof RuntimeHostError && error.diagnostic
              ? { ...error.diagnostic }
              : {})
          },
          runtimeId: this.config.runtimeId,
          generation: this.generation,
          sourceRevision: this.rendererRevision
        }
      }
    })
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.requestQueue.then(operation, operation)
    this.requestQueue = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  private waitForRevision(revision: string): Promise<void> {
    if (this.rendererRevision === revision) return Promise.resolve()
    const sourceFailure = this.failureForRevision(revision)
    if (sourceFailure) return Promise.reject(this.sourceFailureError(sourceFailure))

    return new Promise((resolvePromise, rejectPromise) => {
      const waiter: RevisionWaiter = {
        revision,
        readySequence: this.readySequence,
        resolve: resolvePromise,
        reject: rejectPromise,
        timeout: setTimeout(() => {
          this.finishRevisionWaiter(waiter, () =>
            rejectPromise(
              new RuntimeHostError(
                'SOURCE_UPDATE_TIMEOUT',
                'The source changed, but the renderer did not report a matching ready generation within 15 seconds'
              )
            )
          )
        }, 15_000)
      }
      this.revisionWaiters.add(waiter)
    })
  }

  private recordSourceFailure(
    revision: string,
    diagnostic: RuntimeSourceDiagnostic,
    code: SourceFailureCode
  ): void {
    try {
      if (computeSourceRevision(this.projectRoot) !== revision) return
    } catch {
      return
    }
    const failure = {
      revision,
      code,
      diagnostic: normalizeSourceDiagnostic(diagnostic, this.projectRoot)
    }
    this.sourceFailure = failure
    const error = this.sourceFailureError(failure)
    for (const waiter of [...this.revisionWaiters]) {
      if (waiter.revision === revision) {
        this.finishRevisionWaiter(waiter, () => waiter.reject(error))
      }
    }
  }

  private failureForRevision(revision: string): SourceFailure | undefined {
    return this.sourceFailure?.revision === revision ? this.sourceFailure : undefined
  }

  private currentSourceFailure(): SourceFailure | undefined {
    if (!this.sourceFailure) return undefined
    try {
      return this.failureForRevision(computeSourceRevision(this.projectRoot))
    } catch {
      return undefined
    }
  }

  private sourceFailureError(failure: SourceFailure): RuntimeHostError {
    const { code, diagnostic } = failure
    const location = diagnostic.file
      ? `${diagnostic.file}${diagnostic.line ? `:${diagnostic.line}${diagnostic.column ? `:${diagnostic.column}` : ''}` : ''}`
      : undefined
    const message =
      code === 'SOURCE_COMPILE_ERROR'
        ? location
          ? `Vite could not compile ${location}: ${diagnostic.message}`
          : `Vite could not compile the current source: ${diagnostic.message}`
        : location
          ? `Renderer could not evaluate ${location}: ${diagnostic.message}`
          : `Renderer could not evaluate the current source: ${diagnostic.message}`
    return new RuntimeHostError(code, message, {
      ...(diagnostic.stack ? { stack: diagnostic.stack } : {}),
      ...(diagnostic.file ? { file: diagnostic.file } : {}),
      ...(diagnostic.line !== undefined ? { line: diagnostic.line } : {}),
      ...(diagnostic.column !== undefined ? { column: diagnostic.column } : {}),
      ...(diagnostic.plugin ? { plugin: diagnostic.plugin } : {}),
      ...(diagnostic.frame ? { frame: diagnostic.frame } : {})
    })
  }

  private async ensureRendererRevision(revision: string): Promise<void> {
    if (this.rendererRevision === revision) return Promise.resolve()

    const rendererRevisionAtStart = this.rendererRevision
    const ready = this.waitForRevision(revision)
    const reloadTimer = rendererRevisionAtStart
      ? setTimeout(() => {
          if (
            this.rendererRevision === rendererRevisionAtStart &&
            !this.failureForRevision(revision)
          ) {
            this.window.webContents.reloadIgnoringCache()
          }
        }, 500)
      : undefined
    try {
      await ready
    } finally {
      if (reloadTimer) clearTimeout(reloadTimer)
    }
  }

  private executeInRenderer(request: AutomationRequest): Promise<AutomationResult> {
    if (!this.rendererRevision) {
      return Promise.reject(new RuntimeHostError('RENDERER_NOT_READY', 'Renderer is not ready'))
    }

    const id = randomUUID()
    const timeoutMs =
      request.command === 'layout-check' ? 24 * 60 * 60 * 1000 : 5 * 60 * 1000
    return new Promise((resolvePromise, rejectPromise) => {
      const timeout = setTimeout(
        () => {
          this.rendererResults.delete(id)
          rejectPromise(
            new RuntimeHostError(
              'AUTOMATION_TIMEOUT',
              request.command === 'layout-check'
                ? 'Persistent renderer did not finish the layout check within 24 hours'
                : 'Persistent renderer did not finish the request within 5 minutes'
            )
          )
        },
        timeoutMs
      )

      this.rendererResults.set(id, {
        resolve: resolvePromise,
        reject: rejectPromise,
        timeout
      })
      this.window.webContents.send('definedmotion:runtime-request', {
        id,
        request
      })
    })
  }

  private markRendererLoading(): void {
    this.rendererRevision = undefined
    this.rejectRendererResults(
      new RuntimeHostError('SOURCE_CHANGED_DURING_REQUEST', 'Source changed during the request')
    )
  }

  private markRendererUnavailable(error: Error): void {
    this.rendererRevision = undefined
    this.rejectRendererResults(error)
    for (const waiter of [...this.revisionWaiters]) {
      this.finishRevisionWaiter(waiter, () => waiter.reject(error))
    }
  }

  private rejectRendererResults(error: Error): void {
    for (const [id, waiter] of this.rendererResults) {
      clearTimeout(waiter.timeout)
      waiter.reject(error)
      this.rendererResults.delete(id)
    }
  }

  private finishRevisionWaiter(waiter: RevisionWaiter, finish: () => void): void {
    clearTimeout(waiter.timeout)
    this.revisionWaiters.delete(waiter)
    finish()
  }

  private status(): unknown {
    const sourceFailure = this.currentSourceFailure()
    return {
      success: true,
      command: 'session',
      action: 'status',
      status: sourceFailure ? 'source-error' : this.rendererRevision ? 'ready' : 'loading',
      ...(sourceFailure
        ? {
            pendingSourceRevision: sourceFailure.revision,
            error: {
              code: sourceFailure.code,
              ...sourceFailure.diagnostic
            }
          }
        : {}),
      ...this.statusMetadata()
    }
  }

  private statusMetadata(): object {
    return {
      runtimeId: this.config.runtimeId,
      generation: this.generation,
      sourceRevision: this.rendererRevision,
      pid: process.pid,
      launcherPid: this.config.launcherPid,
      projectRoot: this.projectRoot,
      startedAt: this.startedAt
    }
  }

  private readonly startedAt = new Date().toISOString()

  private async writeDescriptor(): Promise<void> {
    const descriptor: RuntimeDescriptor = {
      protocolVersion: 1,
      runtimeId: this.config.runtimeId,
      pid: process.pid,
      launcherPid: this.config.launcherPid,
      projectRoot: this.projectRoot,
      socketPath: this.config.socketPath,
      token: this.config.token,
      startedAt: this.startedAt
    }
    await mkdir(dirname(this.config.descriptorPath), { recursive: true })
    const temporaryPath = `${this.config.descriptorPath}.${process.pid}.tmp`
    await writeFile(temporaryPath, JSON.stringify(descriptor, null, 2), {
      mode: 0o600
    })
    await rename(temporaryPath, this.config.descriptorPath)
  }

  private removeRuntimeFiles(): void {
    if (existsSync(this.config.descriptorPath)) {
      try {
        const descriptor = JSON.parse(readFileSync(this.config.descriptorPath, 'utf8')) as {
          pid?: number
        }
        if (descriptor.pid === process.pid) rmSync(this.config.descriptorPath, { force: true })
      } catch {
        // A replacement runtime may be writing the descriptor; leave it untouched.
      }
    }
    if (process.platform !== 'win32') rmSync(this.config.socketPath, { force: true })
  }

  private respond(socket: Socket, response: unknown): void {
    if (socket.destroyed) return
    socket.end(`${JSON.stringify(response)}\n`)
  }

  private failure(code: string, message: string): object {
    return { success: false, command: 'session', error: { code, message } }
  }
}

const normalizeSourceDiagnostic = (
  diagnostic: RuntimeSourceDiagnostic,
  projectRoot: string
): RuntimeSourceDiagnostic => ({
  message: boundedString(diagnostic.message, 4_000) || 'Unknown Vite transform error',
  ...(diagnostic.stack ? { stack: boundedString(diagnostic.stack, 8_000) } : {}),
  ...(diagnostic.file
    ? { file: normalizeDiagnosticFile(boundedString(diagnostic.file, 1_000), projectRoot) }
    : {}),
  ...(Number.isInteger(diagnostic.line) && diagnostic.line! > 0 ? { line: diagnostic.line } : {}),
  ...(Number.isInteger(diagnostic.column) && diagnostic.column! >= 0
    ? { column: diagnostic.column }
    : {}),
  ...(diagnostic.plugin ? { plugin: boundedString(diagnostic.plugin, 200) } : {}),
  ...(diagnostic.frame ? { frame: boundedString(diagnostic.frame, 4_000) } : {})
})

const normalizeDiagnosticFile = (file: string, projectRoot: string): string => {
  try {
    const url = new URL(file)
    const pathname = decodeURIComponent(url.pathname.split('?')[0])
    if (pathname.startsWith('/src/')) return pathname.slice(1)
    const absolutePath = pathname.startsWith('/@fs/') ? pathname.slice('/@fs'.length) : pathname
    const relativePath = relative(projectRoot, absolutePath)
    if (relativePath && !relativePath.startsWith('..')) return relativePath
  } catch {
    const relativePath = relative(projectRoot, file)
    if (relativePath && !relativePath.startsWith('..')) return relativePath
  }
  return file
}

const boundedString = (value: unknown, maximumLength: number): string =>
  typeof value === 'string' ? value.slice(0, maximumLength) : ''
