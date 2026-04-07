import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['satellite.js']
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/],
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://168.138.75.236:8002',
        changeOrigin: true,
      },
    },
  },
})
