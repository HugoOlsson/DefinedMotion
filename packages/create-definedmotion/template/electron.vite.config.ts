import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import glsl from 'vite-plugin-glsl'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { computeSourceRevision } from './scripts/source-revision.mjs'

const r = (p: string): string => path.resolve(fileURLToPath(new URL('.', import.meta.url)), p)
const projectRoot = r('.')
const sourceRoot = r('src')

const persistentRuntimeReloadPlugin = (): Plugin => ({
  name: 'definedmotion:persistent-runtime-reload',
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
    const reloadForSourceChange = (_event: string, file: string): void => {
      if (file !== sourceRoot && !file.startsWith(`${sourceRoot}${path.sep}`)) return
      if (reloadTimer) clearTimeout(reloadTimer)
      reloadTimer = setTimeout(() => server.ws.send({ type: 'full-reload' }), 50)
    }
    server.watcher.on('all', reloadForSourceChange)
    return () => {
      if (reloadTimer) clearTimeout(reloadTimer)
      server.watcher.off('all', reloadForSourceChange)
    }
  }
})

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
