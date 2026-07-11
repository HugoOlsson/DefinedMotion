import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import glsl from 'vite-plugin-glsl'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const r = (p: string) => path.resolve(fileURLToPath(new URL('.', import.meta.url)), p)

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [svelte(), tailwindcss(), glsl()],
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
