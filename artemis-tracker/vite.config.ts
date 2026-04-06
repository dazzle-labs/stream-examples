import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function corsProxy(): Plugin {
  return {
    name: 'cors-proxy',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = request.url ?? ''
        if (!url.startsWith('/cors-proxy')) return next()

        if (request.method === 'OPTIONS') {
          response.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          })
          response.end()
          return
        }

        const parsed = new URL(url, 'http://localhost')
        const targetUrl = parsed.searchParams.get('url')
        if (!targetUrl) {
          response.writeHead(400, { 'Content-Type': 'text/plain' })
          response.end('Missing url parameter')
          return
        }

        fetch(targetUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'ArtemisTracker/1.0 (dazzle-example)',
            'Accept': 'application/xml, text/xml, application/json, */*',
          },
        }).then(async (upstream) => {
          const buffer = Buffer.from(await upstream.arrayBuffer())
          response.writeHead(upstream.status, {
            'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream',
            'Access-Control-Allow-Origin': '*',
          })
          response.end(buffer)
        }).catch((error) => {
          response.writeHead(502, {
            'Content-Type': 'text/plain',
            'Access-Control-Allow-Origin': '*',
          })
          response.end(`Proxy error: ${error}`)
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), corsProxy()],
  base: './',
  build: { outDir: 'dist' },
})
