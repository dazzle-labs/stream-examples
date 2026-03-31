import type { CommunityPost } from './types'
import { store } from './store'

const CVE_REGEX = /CVE-\d{4}-\d{4,}/g

const SECURITY_KEYWORDS = [
  'cve',
  'vulnerability',
  'breach',
  'ransomware',
  'zero-day',
  'zeroday',
  'exploit',
  'malware',
  'infosec',
  'cybersecurity',
  'phishing',
  'apt',
  'backdoor',
  'botnet',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function getString(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  return typeof value === 'string' ? value : ''
}

function extractCVEIds(text: string): string[] {
  return [...new Set(text.match(CVE_REGEX) ?? [])]
}

function containsSecurityKeyword(text: string): boolean {
  const lower = text.toLowerCase()
  return SECURITY_KEYWORDS.some(keyword => lower.includes(keyword))
}

interface BGPUpdate {
  type: string
  timestamp: number
  peer: string
  path: number[]
  announcements: Array<{ prefixes: string[] }>
  withdrawals: Array<{ prefixes: string[] }>
}

function connectBluesky() {
  let websocket: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  function connect() {
    websocket = new WebSocket(
      'wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post',
    )

    websocket.onmessage = (event: MessageEvent) => {
      try {
        const raw = typeof event.data === 'string' ? event.data : ''
        const message: unknown = JSON.parse(raw)
        if (!isRecord(message)) return

        const commit = message['commit']
        if (!isRecord(commit)) return

        const record = commit['record']
        if (!isRecord(record)) return

        const text = getString(record, 'text')
        if (!text || !containsSecurityKeyword(text)) return

        const did = getString(message, 'did')
        const timestamp = getString(record, 'createdAt')

        const post: CommunityPost = {
          id: `bluesky-${did}-${Date.now()}`,
          source: 'bluesky',
          title: text.slice(0, 300),
          url: '',
          score: 0,
          timestamp: timestamp || new Date().toISOString(),
          cveIds: extractCVEIds(text),
        }

        store.blueskyPosts.unshift(post)
        if (store.blueskyPosts.length > 50) {
          store.blueskyPosts.length = 50
        }
      } catch { /* silent */ }
    }

    websocket.onclose = () => {
      reconnectTimer = setTimeout(connect, 5000)
    }

    websocket.onerror = () => {
      websocket?.close()
    }
  }

  connect()

  return () => {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    websocket?.close()
  }
}

function connectRipeLive() {
  let websocket: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  const bgpUpdates: BGPUpdate[] = []

  function connect() {
    websocket = new WebSocket('wss://ris-live.ripe.net/v1/ws/?client=cyber-pulse')

    websocket.onopen = () => {
      websocket?.send(JSON.stringify({
        type: 'ris_subscribe',
        data: { type: 'UPDATE' },
      }))
    }

    websocket.onmessage = (event: MessageEvent) => {
      try {
        const raw = typeof event.data === 'string' ? event.data : ''
        const message: unknown = JSON.parse(raw)
        if (!isRecord(message)) return

        const data = message['data']
        if (!isRecord(data)) return

        const type = getString(data, 'type')
        const timestamp = typeof data['timestamp'] === 'number' ? data['timestamp'] : 0
        const peer = getString(data, 'peer')

        const pathRaw = data['path']
        const path: number[] = Array.isArray(pathRaw)
          ? pathRaw.filter((item): item is number => typeof item === 'number')
          : []

        const announcementsRaw = data['announcements']
        const announcements: Array<{ prefixes: string[] }> = Array.isArray(announcementsRaw)
          ? announcementsRaw
            .filter(isRecord)
            .map(announcement => {
              const prefixesRaw = announcement['prefixes']
              const prefixes = Array.isArray(prefixesRaw)
                ? prefixesRaw.filter((prefix): prefix is string => typeof prefix === 'string')
                : []
              return { prefixes }
            })
          : []

        const withdrawalsRaw = data['withdrawals']
        const withdrawals: Array<{ prefixes: string[] }> = Array.isArray(withdrawalsRaw)
          ? withdrawalsRaw
            .filter(isRecord)
            .map(withdrawal => {
              const prefixesRaw = withdrawal['prefixes']
              const prefixes = Array.isArray(prefixesRaw)
                ? prefixesRaw.filter((prefix): prefix is string => typeof prefix === 'string')
                : []
              return { prefixes }
            })
          : []

        const update: BGPUpdate = { type, timestamp, peer, path, announcements, withdrawals }
        bgpUpdates.unshift(update)
        if (bgpUpdates.length > 100) {
          bgpUpdates.length = 100
        }
      } catch { /* silent */ }
    }

    websocket.onclose = () => {
      reconnectTimer = setTimeout(connect, 5000)
    }

    websocket.onerror = () => {
      websocket?.close()
    }
  }

  connect()

  return () => {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    websocket?.close()
  }
}

export function startWebSockets() {
  const cleanupBluesky = connectBluesky()
  const cleanupRipe = connectRipeLive()

  return () => {
    cleanupBluesky()
    cleanupRipe()
  }
}
