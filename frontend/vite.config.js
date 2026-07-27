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
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // แยก PDF libraries ออกเป็น chunk แยก — โหลดเฉพาะเมื่อ export PDF
          'pdf-libs': ['jspdf', 'html2canvas'],
          // แยก React core
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
