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
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

        const chunks: Uint8Array[] = []
        request.on('data', (chunk: Uint8Array) => { chunks.push(chunk) })
        request.on('end', async () => {
          const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined
          try {
            const upstream = await fetch(targetUrl, {
              method: request.method ?? 'GET',
              body: body?.length ? body : undefined,
              headers: {
                'User-Agent': 'CyberPulse/1.0 (security-dashboard; contact: connerruhl@me.com)',
                'Accept': 'application/json, text/xml, text/plain, text/csv, */*',
                ...(body?.length ? { 'Content-Type': 'application/json' } : {}),
              },
            })
            const responseBuffer = Buffer.from(await upstream.arrayBuffer())
            response.writeHead(upstream.status, {
              'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream',
              'Access-Control-Allow-Origin': '*',
            })
            response.end(responseBuffer)
          } catch (error) {
            response.writeHead(502, {
              'Content-Type': 'text/plain',
              'Access-Control-Allow-Origin': '*',
            })
            response.end(`Proxy error: ${error}`)
          }
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
