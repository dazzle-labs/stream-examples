import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  server: {
    proxy: {
      '/api/pypi': {
        target: 'https://pypi.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/pypi/, ''),
      },
    },
  },
})
