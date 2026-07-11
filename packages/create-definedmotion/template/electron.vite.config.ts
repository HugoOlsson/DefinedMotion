import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import glsl from 'vite-plugin-glsl'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { createConnection } from 'node:net'
import { fileURLToPath } from 'node:url'
import { normalizePath, type Plugin, type ViteDevServer } from 'vite'
import { computeSourceRevision } from './scripts/source-revision.mjs'
import type { RuntimeSourceDiagnostic } from './src/automation/types'

const r = (p: string): string => path.resolve(fileURLToPath(new URL('.', import.meta.url)), p)
const projectRoot = r('.')
const sourceRoot = r('src')

const sourceModuleExtensions = new Set([
  '.cjs',
  '.css',
  '.glsl',
  '.js',
  '.json',
  '.jsx',
  '.less',
  '.mjs',
  '.sass',
  '.scss',
  '.svelte',
  '.ts',
  '.tsx',
  '.vue',
  '.wgsl'
])

const persistentRuntimeReloadPlugin = (): Plugin => ({
  name: 'definedmotion:persistent-runtime-reload',
  handleHotUpdate(context) {
    if (isProjectSourcePath(context.file)) return []
    return undefined
  },
  transformIndexHtml() {
    const revision = computeSourceRevision(projectRoot)
    return [
      {
        tag: 'script',
        children: `window.__DEFINEDMOTION_SOURCE_REVISION__ = ${JSON.stringify(revision)};`,
        injectTo: 'head-prepend'
      }
    ]
  },
  configureServer(server) {
    server.watcher.add([sourceRoot, `${sourceRoot.replaceAll(path.sep, '/')}/**/*`])
    let reloadTimer: ReturnType<typeof setTimeout> | undefined
    let changeSequence = 0
    const changedFiles = new Set<string>()
    const reloadForSourceChange = (_event: string, file: string): void => {
      if (!isProjectSourcePath(file)) return
      changedFiles.add(file)
      const sequence = ++changeSequence
      if (reloadTimer) clearTimeout(reloadTimer)
      reloadTimer = setTimeout(() => {
        const files = [...changedFiles]
        changedFiles.clear()
        void validateAndReloadSource(server, files, sequence, () => changeSequence)
      }, 100)
    }
    server.watcher.on('all', reloadForSourceChange)
    server.httpServer?.once('close', () => {
      if (reloadTimer) clearTimeout(reloadTimer)
      server.watcher.off('all', reloadForSourceChange)
    })
  }
})

const isProjectSourcePath = (file: string): boolean =>
  file === sourceRoot || file.startsWith(`${sourceRoot}${path.sep}`)

const validateAndReloadSource = async (
  server: ViteDevServer,
  files: string[],
  sequence: number,
  currentSequence: () => number
): Promise<void> => {
  const revision = computeSourceRevision(projectRoot)
  try {
    for (const file of files) {
      if (!existsSync(file) || !sourceModuleExtensions.has(path.extname(file).toLowerCase()))
        continue
      await server.transformRequest(`/@fs/${normalizePath(file)}`)
    }
    if (sequence !== currentSequence()) return
    server.ws.send({ type: 'full-reload' })
  } catch (error) {
    if (sequence !== currentSequence()) return
    reportSourceFailure(revision, sourceDiagnostic(error, files.at(-1)))
  }
}

const sourceDiagnostic = (error: unknown, changedFile?: string): RuntimeSourceDiagnostic => {
  const viteError = error as {
    message?: unknown
    plugin?: unknown
    id?: unknown
    frame?: unknown
    loc?: { file?: unknown; line?: unknown; column?: unknown }
  }
  const rawFile = stringValue(viteError.loc?.file) || stringValue(viteError.id) || changedFile
  const absoluteFile = rawFile?.split('?')[0]
  const file = absoluteFile
    ? path.isAbsolute(absoluteFile)
      ? path.relative(projectRoot, absoluteFile)
      : absoluteFile
    : undefined
  const line = positiveInteger(viteError.loc?.line)
  const column = nonNegativeInteger(viteError.loc?.column)
  return {
    message: boundedString(viteError.message, 4_000) || String(error).slice(0, 4_000),
    ...(file ? { file } : {}),
    ...(line !== undefined ? { line } : {}),
    ...(column !== undefined ? { column } : {}),
    ...(stringValue(viteError.plugin) ? { plugin: boundedString(viteError.plugin, 200) } : {}),
    ...(stringValue(viteError.frame) ? { frame: boundedString(viteError.frame, 4_000) } : {})
  }
}

const reportSourceFailure = (sourceRevision: string, diagnostic: RuntimeSourceDiagnostic): void => {
  const socketPath = process.env['DEFINEDMOTION_SESSION_SOCKET']
  const token = process.env['DEFINEDMOTION_SESSION_TOKEN']
  if (!socketPath || !token) return

  const socket = createConnection(socketPath)
  const timeout = setTimeout(() => socket.destroy(), 1_000)
  const finish = (): void => clearTimeout(timeout)
  socket.once('connect', () => {
    socket.write(
      `${JSON.stringify({ action: 'source-error', token, sourceRevision, diagnostic })}\n`
    )
  })
  socket.once('error', finish)
  socket.once('close', finish)
  socket.once('data', () => socket.end())
}

const stringValue = (value: unknown): string | undefined =>
  typeof value === 'string' && value ? value : undefined

const boundedString = (value: unknown, maximumLength: number): string =>
  typeof value === 'string' ? value.slice(0, maximumLength) : ''

const positiveInteger = (value: unknown): number | undefined =>
  Number.isInteger(value) && Number(value) > 0 ? Number(value) : undefined

const nonNegativeInteger = (value: unknown): number | undefined =>
  Number.isInteger(value) && Number(value) >= 0 ? Number(value) : undefined

const persistentRuntimePlugins = process.env['DEFINEDMOTION_SESSION_TOKEN']
  ? [persistentRuntimeReloadPlugin()]
  : []

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [svelte(), tailwindcss(), glsl(), ...persistentRuntimePlugins],
    // Add Node.js built-in modules to the renderer process
    resolve: {
      // Ensure these modules can be used in the renderer
      alias: {
        fs: 'node:fs',
        path: 'node:path',
        os: 'node:os',
        crypto: 'node:crypto',
        $renderer: r('src/renderer/src')
        // Add other Node.js modules you need
      }
    },
    // Configure how Node.js modules are handled
    build: {
      rollupOptions: {
        external: [] // Empty to prevent externalizing Node modules
      }
    },
    // Make Node.js built-ins available
    server: {
      watch: {
        ignored: []
      }
    },
    // Let the renderer process access Node.js APIs
    optimizeDeps: {
      exclude: ['electron']
    }
  }
})
