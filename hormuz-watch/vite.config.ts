import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'
import { createServer } from 'http'
import { WebSocketServer, WebSocket as ServerWebSocket } from 'ws'

function aisRelayServer(): Plugin {
  return {
    name: 'ais-relay-server',
    configureServer() {
      const httpServer = createServer()
      const wss = new WebSocketServer({ server: httpServer })

      wss.on('connection', (client) => {
        const pendingMessages: Buffer[] = []
        let upstreamReady = false
        const upstream = new ServerWebSocket('wss://stream.aisstream.io/v0/stream')

        upstream.on('open', () => {
          process.stdout.write('[ais-relay] upstream connected\n')
          upstreamReady = true
          for (const message of pendingMessages) {
            upstream.send(message)
          }
          pendingMessages.length = 0
          if (client.readyState === ServerWebSocket.OPEN) {
            client.send(JSON.stringify({ relay: 'connected' }))
          }
        })

        upstream.on('message', (data) => {
          if (client.readyState === ServerWebSocket.OPEN) {
            client.send(data)
          }
        })

        upstream.on('close', () => {
          if (client.readyState === ServerWebSocket.OPEN) client.close()
        })

        upstream.on('error', (error) => {
          process.stdout.write(`[ais-relay] upstream error: ${error.message}\n`)
          if (client.readyState === ServerWebSocket.OPEN) client.close()
        })

        client.on('message', (data) => {
          if (upstreamReady && upstream.readyState === ServerWebSocket.OPEN) {
            upstream.send(data)
          } else {
            pendingMessages.push(data as Buffer)
          }
        })

        client.on('close', () => {
          process.stdout.write('[ais-relay] client disconnected\n')
          if (upstream.readyState === ServerWebSocket.OPEN) upstream.close()
        })
      })

      httpServer.listen(5198, () => {
        process.stdout.write('[ais-relay] listening on ws://localhost:5198\n')
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), aisRelayServer()],
  base: './',
  build: {
    outDir: 'dist',
  },
  server: {
    proxy: {
      '/api/yahoo': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/yahoo/, ''),
      },
      '/api/news': {
        target: 'https://news.google.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/news/, ''),
      },
      '/api/centcom': {
        target: 'https://www.centcom.mil',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/centcom/, ''),
      },
      '/api/polymarket/gamma': {
        target: 'https://gamma-api.polymarket.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/polymarket\/gamma/, ''),
      },
    },
  },
})
