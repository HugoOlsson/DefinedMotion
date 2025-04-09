import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [tailwindcss(), svelte()],
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
