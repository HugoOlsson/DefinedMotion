import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import glsl from 'vite-plugin-glsl'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [svelte(), tailwindcss(), glsl()],
    assetsInclude: ['**/*.hdr'],
    // Add Node.js built-in modules to the renderer process
    resolve: {
      // Ensure these modules can be used in the renderer
      alias: {
        fs: 'node:fs',
        path: 'node:path',
        os: 'node:os',
        crypto: 'node:crypto'
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
