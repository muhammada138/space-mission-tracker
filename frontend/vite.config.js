import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['fs', 'path', 'os', 'buffer', 'process'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['satellite.js']
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three') || id.includes('@react-three')) {
            return 'vendor-three'
          }
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
            return 'vendor-charts'
          }
          if (id.includes('node_modules/leaflet') || id.includes('node_modules/react-leaflet')) {
            return 'vendor-maps'
          }
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://168.138.75.236:8002',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
  },
})
