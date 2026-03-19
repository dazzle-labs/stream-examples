import { WebSocketServer } from 'ws'
import express from 'express'
import { createServer } from 'http'

const PORT = 7777
const app = express()
app.use(express.json())

const server = createServer(app)
const wss = new WebSocketServer({ server })

const clients = new Set<import('ws').WebSocket>()

wss.on('connection', (ws) => {
  clients.add(ws)
  console.log(`Client connected (${clients.size} total)`)
  ws.on('close', () => {
    clients.delete(ws)
    console.log(`Client disconnected (${clients.size} total)`)
  })
})

function broadcast(data: string) {
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(data)
    }
  }
}

// POST /event — relay script posts here
app.post('/event', (req, res) => {
  const { event, data } = req.body as { event: string, data: string }
  broadcast(JSON.stringify({ event, data }))
  res.json({ ok: true })
})

server.listen(PORT, () => {
  console.log(`Claude Code Stream bridge running on http://localhost:${PORT}`)
  console.log(`WebSocket: ws://localhost:${PORT}`)
  console.log(`POST events to: http://localhost:${PORT}/event`)
})
