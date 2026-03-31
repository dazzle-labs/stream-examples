import { WebSocket } from 'ws'
import { execSync } from 'child_process'

const API_KEY = process.env.AISSTREAM_API_KEY || process.argv[2] || ''
const STAGE = process.env.DAZZLE_STAGE || 'hormuz-watch'
const VESSEL_BATCH_INTERVAL = 3000
const NEWS_POLL_INTERVAL = 5 * 60 * 1000
const OIL_POLL_INTERVAL = 5 * 60 * 1000

if (!API_KEY) {
  process.stderr.write('Usage: AISSTREAM_API_KEY=<key> node ais-feeder.mjs\n')
  process.exit(1)
}

function emitEvent(name, payload) {
  try {
    const json = JSON.stringify(payload).replace(/'/g, "'\\''")
    execSync(`dazzle stage event emit --stage ${STAGE} ${name} '${json}'`, { stdio: 'ignore', timeout: 5000 })
    return true
  } catch {
    return false
  }
}

const vessels = new Map()

function emitVesselBatch() {
  if (vessels.size === 0) return
  const batch = Array.from(vessels.values())
  vessels.clear()
  if (emitEvent('vessel-update', { type: 'vessel-batch', vessels: batch })) {
    process.stdout.write(`[vessels] emitted ${batch.length}\n`)
  }
}

function connectAIS() {
  const ws = new WebSocket('wss://stream.aisstream.io/v0/stream')

  ws.on('open', () => {
    process.stdout.write('[ais] connected\n')
    ws.send(JSON.stringify({
      Apikey: API_KEY,
      BoundingBoxes: [[[22, 48], [30, 61]]],
      FilterMessageTypes: ['PositionReport', 'StandardClassBPositionReport', 'ExtendedClassBPositionReport'],
    }))
  })

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString())
      const messageType = message.MessageType || ''
      const position = message.Message?.[messageType]
      const metadata = message.MetaData
      if (!position || !metadata) return

      vessels.set(String(metadata.MMSI), {
        mmsi: String(metadata.MMSI),
        name: (metadata.ShipName || '').trim(),
        shipType: metadata.ShipType || 0,
        latitude: position.Latitude,
        longitude: position.Longitude,
        speed: position.Sog || 0,
        course: position.Cog || 0,
        heading: position.TrueHeading || 0,
        timestamp: Date.now(),
      })
    } catch {}
  })

  ws.on('close', () => {
    process.stdout.write('[ais] disconnected, reconnecting in 5s\n')
    setTimeout(connectAIS, 5000)
  })

  ws.on('error', () => ws.close())
}

async function fetchAndEmitNews() {
  try {
    const [googleResponse, centcomResponse] = await Promise.all([
      fetch('https://news.google.com/rss/search?q=%22strait+of+hormuz%22+OR+%22hormuz%22+when%3A1d&hl=en-US&gl=US&ceid=US:en'),
      fetch('https://www.centcom.mil/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=808&max=10'),
    ])

    const headlines = []

    if (googleResponse.ok) {
      const xml = await googleResponse.text()
      const titleMatches = xml.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<source[^>]*>([\s\S]*?)<\/source>[\s\S]*?<pubDate>([\s\S]*?)<\/pubDate>[\s\S]*?<\/item>/g)
      let index = 0
      for (const match of titleMatches) {
        headlines.push({
          id: `gn-${index++}`,
          title: match[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
          source: match[2].replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
          category: 'news',
          timestamp: new Date(match[3].trim()).getTime() || Date.now(),
        })
      }
    }

    if (centcomResponse.ok) {
      const xml = await centcomResponse.text()
      const titleMatches = xml.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<pubDate>([\s\S]*?)<\/pubDate>[\s\S]*?<\/item>/g)
      let index = 0
      for (const match of titleMatches) {
        headlines.push({
          id: `cc-${index++}`,
          title: match[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
          source: 'CENTCOM',
          category: 'military',
          timestamp: new Date(match[2].trim()).getTime() || Date.now(),
        })
      }
    }

    if (headlines.length > 0) {
      headlines.sort((a, b) => b.timestamp - a.timestamp)
      if (emitEvent('news-update', { headlines: headlines.slice(0, 15) })) {
        process.stdout.write(`[news] emitted ${Math.min(headlines.length, 15)} headlines\n`)
      }
    }
  } catch {}
}

async function fetchAndEmitOilPrices() {
  const baselines = { 'BZ=F': 74.35, 'CL=F': 70.87, '^OVX': 25.0 }
  const labels = { 'BZ=F': 'BRENT', 'CL=F': 'WTI', '^OVX': 'OVX' }
  const prices = []

  for (const ticker of ['BZ=F', 'CL=F', '^OVX']) {
    try {
      const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=7d&interval=1d`)
      if (!response.ok) continue
      const json = await response.json()
      const result = json.chart?.result?.[0]
      if (!result) continue

      const currentPrice = result.meta?.regularMarketPrice
      if (typeof currentPrice !== 'number') continue

      const closes = (result.indicators?.quote?.[0]?.close ?? []).filter(v => v !== null)
      const baseline = baselines[ticker]
      const changePercent = ((currentPrice - baseline) / baseline) * 100

      prices.push({
        ticker,
        label: labels[ticker],
        price: currentPrice,
        changePercent,
        sparkline: closes.length > 0 ? closes : [currentPrice],
      })
    } catch {}
  }

  if (prices.length > 0) {
    if (emitEvent('oil-update', { prices })) {
      process.stdout.write(`[oil] emitted ${prices.length} prices\n`)
    }
  }
}

process.stdout.write(`[feeder] starting for stage "${STAGE}"\n`)

connectAIS()
setInterval(emitVesselBatch, VESSEL_BATCH_INTERVAL)

fetchAndEmitNews()
setInterval(fetchAndEmitNews, NEWS_POLL_INTERVAL)

fetchAndEmitOilPrices()
setInterval(fetchAndEmitOilPrices, OIL_POLL_INTERVAL)
