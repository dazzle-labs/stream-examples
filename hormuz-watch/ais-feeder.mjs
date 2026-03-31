import { WebSocket } from 'ws'
import { execSync } from 'child_process'

const API_KEY = process.env.AISSTREAM_API_KEY || process.argv[2] || ''
const STAGE = process.env.DAZZLE_STAGE || 'hormuz-watch'
const BATCH_INTERVAL = 3000

if (!API_KEY) {
  process.stderr.write('Usage: AISSTREAM_API_KEY=<key> node ais-feeder.mjs\n')
  process.stderr.write('   or: node ais-feeder.mjs <api-key>\n')
  process.exit(1)
}

const vessels = new Map()
let batchTimer = null

function emitBatch() {
  if (vessels.size === 0) return

  const batch = Array.from(vessels.values())
  vessels.clear()

  const payload = JSON.stringify({ type: 'vessel-batch', vessels: batch })

  try {
    execSync(
      `dazzle stage event emit --stage ${STAGE} vessel-update '${payload.replace(/'/g, "'\\''")}'`,
      { stdio: 'ignore', timeout: 5000 },
    )
    process.stdout.write(`[ais-feeder] emitted ${batch.length} vessels\n`)
  } catch {
    process.stderr.write('[ais-feeder] failed to emit event\n')
  }
}

function connect() {
  const ws = new WebSocket('wss://stream.aisstream.io/v0/stream')

  ws.on('open', () => {
    process.stdout.write('[ais-feeder] connected to AISStream\n')
    ws.send(JSON.stringify({
      Apikey: API_KEY,
      BoundingBoxes: [[[22, 48], [30, 61]]],
      FilterMessageTypes: ['PositionReport', 'StandardClassBPositionReport', 'ExtendedClassBPositionReport'],
    }))

    batchTimer = setInterval(emitBatch, BATCH_INTERVAL)
  })

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString())
      const messageType = message.MessageType || ''
      const position = message.Message?.[messageType]
      const metadata = message.MetaData
      if (!position || !metadata) return

      const mmsi = String(metadata.MMSI)
      vessels.set(mmsi, {
        mmsi,
        name: (metadata.ShipName || '').trim(),
        shipType: metadata.ShipType || 0,
        latitude: position.Latitude,
        longitude: position.Longitude,
        speed: position.Sog || 0,
        course: position.Cog || 0,
        heading: position.TrueHeading || 0,
        timestamp: Date.now(),
      })
    } catch {
      // ignore
    }
  })

  ws.on('close', () => {
    process.stdout.write('[ais-feeder] disconnected, reconnecting in 5s...\n')
    if (batchTimer) { clearInterval(batchTimer); batchTimer = null }
    setTimeout(connect, 5000)
  })

  ws.on('error', () => {
    ws.close()
  })
}

process.stdout.write(`[ais-feeder] starting for stage "${STAGE}"\n`)
connect()
