import { defineConfig } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import glsl from 'vite-plugin-glsl'
import path from 'node:path'
import { existsSync, readdirSync } from 'node:fs'
import { createConnection } from 'node:net'
import { fileURLToPath } from 'node:url'
import { normalizePath, type Plugin, type ViteDevServer } from 'vite'
import { computeSourceRevision } from './src/source-revision.mjs'
import type { RuntimeSourceDiagnostic } from './src/automation/types'

const packageRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)))
const projectRoot = path.resolve(process.env['DEFINEDMOTION_PROJECT_ROOT'] ?? process.cwd())
const projectSourceRoot = path.join(projectRoot, 'src')
const projectConfigPath = path.join(projectRoot, 'definedmotion.config.ts')
const referenceExamplesRoot = path.join(packageRoot, 'reference', 'examples')
const referenceTestsRoot = path.join(packageRoot, 'reference', 'tests')
const buildRoot = path.join(projectRoot, '.definedmotion', 'build')

if (!existsSync(projectConfigPath)) {
  throw new Error(`DefinedMotion config was not found at ${projectConfigPath}`)
}

const fsImport = (file: string): string => `/@fs/${normalizePath(file)}`

const sceneFiles = (root: string): string[] => {
  if (!existsSync(root)) return []
  const files: string[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const absolutePath = path.join(root, entry.name)
    if (entry.isDirectory()) files.push(...sceneFiles(absolutePath))
    else if (entry.isFile() && entry.name.endsWith('.scene.ts')) files.push(absolutePath)
  }
  return files.sort()
}

const moduleImports = (files: string[], prefix: string): { imports: string; entries: string } => {
  const imports: string[] = []
  const entries: string[] = []
  files.forEach((file, index) => {
    const identifier = `${prefix}${index}`
    imports.push(`import * as ${identifier} from ${JSON.stringify(fsImport(file))}`)
    entries.push(`${JSON.stringify(normalizePath(file))}: ${identifier}`)
  })
  return { imports: imports.join('\n'), entries: entries.join(',\n') }
}

const virtualConfigModule = (): string => `
import * as configModule from ${JSON.stringify(fsImport(projectConfigPath))}
import { defineConfig } from ${JSON.stringify(fsImport(path.join(packageRoot, 'src', 'project.ts')))}
const candidate = configModule.default
if (!candidate) throw new Error('definedmotion.config.ts must export a default config')
export const definedMotionConfig = defineConfig(candidate)
`

const virtualProjectModule = (): string => {
  const reference = moduleImports(
    [...sceneFiles(referenceExamplesRoot), ...sceneFiles(referenceTestsRoot)],
    'referenceModule'
  )
  const user = moduleImports(sceneFiles(path.join(projectSourceRoot, 'scenes')), 'userModule')
  return `
${reference.imports}
${user.imports}
import { definedMotionConfig } from 'virtual:definedmotion-config'
import {
  collectSceneModules,
  defineProject,
  mergeSceneRegistries
} from ${JSON.stringify(fsImport(path.join(packageRoot, 'src', 'project.ts')))}
import { setGlobalAssetNamespace } from ${JSON.stringify(
    fsImport(path.join(packageRoot, 'src', 'runtime', 'scene', 'sceneClass.ts'))
  )}

const referenceScenes = definedMotionConfig.includeReferenceScenes === false
  ? {}
  : collectSceneModules({${reference.entries}}, { assetNamespace: 'reference' })
const userScenes = collectSceneModules({${user.entries}}, { allowEmpty: true })
const scenes = mergeSceneRegistries(referenceScenes, userScenes)

export const project = defineProject({
  fps: definedMotionConfig.timelineFps,
  renderEveryNthFrame: definedMotionConfig.renderEveryNthFrame,
  seed: definedMotionConfig.seed,
  defaultScene: definedMotionConfig.defaultScene,
  scenes
})
export const renderSkip = project.renderEveryNthFrame
export const entryScene = () => {
  const definition = project.scenes[project.defaultScene]
  setGlobalAssetNamespace(definition.assetNamespace ?? 'project')
  return definition.create()
}
`
}

const projectModulesPlugin = (): Plugin => ({
  name: 'definedmotion:project-modules',
  resolveId(id) {
    if (id === 'virtual:definedmotion-config' || id === 'virtual:definedmotion-project') {
      return `\0${id}`
    }
    return undefined
  },
  load(id) {
    if (id === '\0virtual:definedmotion-config') return virtualConfigModule()
    if (id === '\0virtual:definedmotion-project') return virtualProjectModule()
    return undefined
  },
  handleHotUpdate(context) {
    if (!isProjectSourcePath(context.file) && context.file !== projectConfigPath) return
    invalidateProjectModules(context.server)
  },
  configureServer(server) {
    const handleFileSetChange = (event: string, file: string): void => {
      if (
        (event === 'add' || event === 'unlink' || event === 'addDir' || event === 'unlinkDir') &&
        isProjectSourcePath(file)
      ) {
        invalidateProjectModules(server)
      }
    }
    server.watcher.on('all', handleFileSetChange)
    server.httpServer?.once('close', () => server.watcher.off('all', handleFileSetChange))
  }
})

const invalidateProjectModules = (server: ViteDevServer): void => {
  for (const id of ['\0virtual:definedmotion-config', '\0virtual:definedmotion-project']) {
    const module = server.moduleGraph.getModuleById(id)
    if (module) server.moduleGraph.invalidateModule(module)
  }
}

const sourceModuleExtensions = new Set([
  '.cjs', '.css', '.glsl', '.js', '.json', '.jsx', '.less', '.mjs', '.sass', '.scss',
  '.svelte', '.ts', '.tsx', '.vue', '.wgsl'
])

const persistentRuntimeReloadPlugin = (): Plugin => ({
  name: 'definedmotion:persistent-runtime-reload',
  handleHotUpdate(context) {
    if (isProjectSourcePath(context.file) || context.file === projectConfigPath) return []
    return undefined
  },
  transformIndexHtml() {
    const revision = computeSourceRevision(projectRoot)
    return [{
      tag: 'script',
      children: `window.__DEFINEDMOTION_SOURCE_REVISION__ = ${JSON.stringify(revision)};`,
      injectTo: 'head-prepend'
    }]
  },
  configureServer(server) {
    server.watcher.add([
      projectConfigPath,
      projectSourceRoot,
      `${normalizePath(projectSourceRoot)}/**/*`
    ])
    let reloadTimer: ReturnType<typeof setTimeout> | undefined
    let changeSequence = 0
    const changedFiles = new Set<string>()
    const reloadForSourceChange = (_event: string, file: string): void => {
      if (!isProjectSourcePath(file) && file !== projectConfigPath) return
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
  file === projectSourceRoot || file.startsWith(`${projectSourceRoot}${path.sep}`)

const validateAndReloadSource = async (
  server: ViteDevServer,
  files: string[],
  sequence: number,
  currentSequence: () => number
): Promise<void> => {
  const revision = computeSourceRevision(projectRoot)
  try {
    for (const file of files) {
      if (!existsSync(file) || !sourceModuleExtensions.has(path.extname(file).toLowerCase())) continue
      await server.transformRequest(fsImport(file))
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
    ? path.isAbsolute(absoluteFile) ? path.relative(projectRoot, absoluteFile) : absoluteFile
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
    socket.write(`${JSON.stringify({ action: 'source-error', token, sourceRevision, diagnostic })}\n`)
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

const definedMotionPublicImports = [
  'definedmotion',
  'definedmotion/animation',
  'definedmotion/assets',
  'definedmotion/latex',
  'definedmotion/math',
  'definedmotion/media',
  'definedmotion/rendering',
  'definedmotion/reference'
]

const nestedCommonJsImports = [
  'three.meshline',
  'mathjax-full/js/mathjax',
  'mathjax-full/js/input/tex',
  'mathjax-full/js/input/tex/AllPackages.js',
  'mathjax-full/js/output/svg',
  'mathjax-full/js/adaptors/liteAdaptor',
  'mathjax-full/js/handlers/html'
].map((dependency) => `definedmotion > ${dependency}`)

export default defineConfig({
  main: {
    build: {
      outDir: path.join(buildRoot, 'main'),
      emptyOutDir: true,
      lib: { entry: path.join(packageRoot, 'src', 'main', 'index.ts') }
    }
  },
  preload: {
    build: {
      outDir: path.join(buildRoot, 'preload'),
      emptyOutDir: true,
      lib: { entry: path.join(packageRoot, 'src', 'preload', 'index.ts') },
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: 'index.js'
        }
      }
    }
  },
  renderer: {
    root: path.join(packageRoot, 'src', 'renderer'),
    cacheDir: path.join(projectRoot, '.definedmotion', 'vite'),
    plugins: [
      projectModulesPlugin(),
      svelte({ configFile: path.join(packageRoot, 'svelte.config.mjs') }),
      tailwindcss(),
      glsl(),
      ...persistentRuntimePlugins
    ],
    resolve: {
      alias: [
        { find: /^definedmotion$/, replacement: path.join(packageRoot, 'src', 'public', 'index.ts') },
        { find: /^definedmotion\/animation$/, replacement: path.join(packageRoot, 'src', 'public', 'animation.ts') },
        { find: /^definedmotion\/assets$/, replacement: path.join(packageRoot, 'src', 'public', 'assets.ts') },
        { find: /^definedmotion\/latex$/, replacement: path.join(packageRoot, 'src', 'public', 'latex.ts') },
        { find: /^definedmotion\/math$/, replacement: path.join(packageRoot, 'src', 'public', 'math.ts') },
        { find: /^definedmotion\/media$/, replacement: path.join(packageRoot, 'src', 'public', 'media.ts') },
        { find: /^definedmotion\/rendering$/, replacement: path.join(packageRoot, 'src', 'public', 'rendering.ts') },
        { find: 'fs', replacement: 'node:fs' },
        { find: 'path', replacement: 'node:path' },
        { find: 'os', replacement: 'node:os' },
        { find: 'crypto', replacement: 'node:crypto' }
      ]
    },
    build: {
      outDir: path.join(buildRoot, 'renderer'),
      emptyOutDir: true,
      rollupOptions: {
        input: path.join(packageRoot, 'src', 'renderer', 'index.html'),
        external: []
      }
    },
    server: {
      fs: { allow: [packageRoot, projectRoot] },
      watch: { ignored: [] }
    },
    // These ESM entry points resolve to framework source that requires this config's virtual
    // modules and GLSL plugin. An installed npm package lives under node_modules, so Vite would
    // otherwise try to prebundle it before those transforms are available.
    optimizeDeps: {
      exclude: ['electron', ...definedMotionPublicImports],
      include: nestedCommonJsImports
    }
  }
})
