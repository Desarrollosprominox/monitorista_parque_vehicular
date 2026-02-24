import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/blob-api': {
        target: 'https://api-parquevehicular.prominox.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/blob-api/, ''),
      },
    },
  },
})
