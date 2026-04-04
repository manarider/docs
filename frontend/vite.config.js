import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/docs/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/docs/api': {
        target: 'http://localhost:4040',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/docs/, ''),
      },
    },
  },
})
