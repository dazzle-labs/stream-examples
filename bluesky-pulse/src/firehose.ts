// Bluesky Jetstream firehose connection and event parsing

export type EventKind = 'post' | 'reply' | 'repost' | 'like' | 'follow'

export interface ParsedEvent {
  kind: EventKind
  text: string
  language: string
  hashtags: string[]
  hasImages: boolean
  timestamp: number
}

export interface FirehoseStats {
  eventsPerSecond: number
  totalEvents: number
  postCount: number
  replyCount: number
  repostCount: number
  likeCount: number
  followCount: number
  sparkline: number[]
  languageCounts: Map<string, number>
  hashtagCounts: Map<string, number>
  recentPosts: ParsedEvent[]
  connected: boolean
  uptimeSeconds: number
}

type EventCallback = (event: ParsedEvent) => void
type StatsCallback = (stats: FirehoseStats) => void

interface JetstreamFacetFeature {
  readonly $type: string
  readonly tag?: string
}

interface JetstreamFacet {
  readonly features: readonly JetstreamFacetFeature[]
}

interface JetstreamEmbed {
  readonly $type: string
}

interface JetstreamRecord {
  readonly text?: string
  readonly langs?: readonly string[]
  readonly facets?: readonly JetstreamFacet[]
  readonly reply?: { readonly parent: unknown; readonly root: unknown }
  readonly embed?: JetstreamEmbed
}

interface JetstreamCommit {
  readonly operation: string
  readonly collection: string
  readonly record?: JetstreamRecord
}

interface JetstreamMessage {
  readonly kind: string
  readonly commit?: JetstreamCommit
}

const JETSTREAM_URL =
  'wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post&wantedCollections=app.bsky.feed.like&wantedCollections=app.bsky.feed.repost&wantedCollections=app.bsky.graph.follow'

const HASHTAG_WINDOW_MS = 120_000
const SPARKLINE_BUCKETS = 60
const MAX_RECENT_POSTS = 20
const RECONNECT_DELAY_MS = 2000
const MAX_RECONNECT_DELAY_MS = 30000

function extractHashtags(facets: readonly JetstreamFacet[] | undefined): string[] {
  if (!facets) return []
  const tags: string[] = []
  for (const facet of facets) {
    for (const feature of facet.features) {
      if (feature.$type === 'app.bsky.richtext.facet#tag' && feature.tag) {
        tags.push(feature.tag.toLowerCase())
      }
    }
  }
  return tags
}

function detectLanguage(langs: readonly string[] | undefined): string {
  const lang = langs?.[0]
  if (!lang) return 'other'
  const code = lang.slice(0, 2)
  if (code === 'en') return 'en'
  if (code === 'ja') return 'ja'
  if (code === 'pt') return 'pt'
  if (code === 'es') return 'es'
  if (code === 'de') return 'de'
  return 'other'
}

function hasImages(embed: JetstreamEmbed | undefined): boolean {
  if (!embed) return false
  return embed.$type === 'app.bsky.embed.images' || embed.$type === 'app.bsky.embed.recordWithMedia'
}

function parseEvent(msg: JetstreamMessage): ParsedEvent | null {
  if (msg.kind !== 'commit') return null
  const commit = msg.commit
  if (!commit || commit.operation !== 'create') return null

  const collection = commit.collection
  const record = commit.record
  const now = Date.now()

  if (collection === 'app.bsky.feed.post') {
    const isReply = record?.reply !== undefined
    return {
      kind: isReply ? 'reply' : 'post',
      text: record?.text ?? '',
      language: detectLanguage(record?.langs),
      hashtags: extractHashtags(record?.facets),
      hasImages: hasImages(record?.embed),
      timestamp: now,
    }
  }

  if (collection === 'app.bsky.feed.like') {
    return {
      kind: 'like',
      text: '',
      language: 'other',
      hashtags: [],
      hasImages: false,
      timestamp: now,
    }
  }

  if (collection === 'app.bsky.feed.repost') {
    return {
      kind: 'repost',
      text: '',
      language: 'other',
      hashtags: [],
      hasImages: false,
      timestamp: now,
    }
  }

  if (collection === 'app.bsky.graph.follow') {
    return {
      kind: 'follow',
      text: '',
      language: 'other',
      hashtags: [],
      hasImages: false,
      timestamp: now,
    }
  }

  return null
}

export function createFirehose(onEvent: EventCallback, onStats: StatsCallback): { destroy: () => void } {
  let ws: WebSocket | null = null
  let destroyed = false
  let reconnectDelay = RECONNECT_DELAY_MS
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let startTime = Date.now()

  // Stats tracking
  let totalEvents = 0
  let postCount = 0
  let replyCount = 0
  let repostCount = 0
  let likeCount = 0
  let followCount = 0
  let connected = false

  // Per-second event counter for sparkline
  const secondBuckets: number[] = new Array(SPARKLINE_BUCKETS).fill(0) as number[]
  let currentSecond = Math.floor(Date.now() / 1000)

  // Language tracking
  const languageCounts = new Map<string, number>()

  // Hashtag tracking with timestamps for decay
  const hashtagEvents: Array<{ tag: string; time: number }> = []
  const hashtagCounts = new Map<string, number>()

  // Recent interesting posts
  const recentPosts: ParsedEvent[] = []

  function updateHashtagCounts(): void {
    const cutoff = Date.now() - HASHTAG_WINDOW_MS
    // Remove expired entries
    while (hashtagEvents.length > 0 && (hashtagEvents[0]?.time ?? cutoff + 1) < cutoff) {
      const removed = hashtagEvents.shift()
      if (removed) {
        const count = hashtagCounts.get(removed.tag) ?? 0
        if (count <= 1) {
          hashtagCounts.delete(removed.tag)
        } else {
          hashtagCounts.set(removed.tag, count - 1)
        }
      }
    }
  }

  function trackSecondBucket(): void {
    const nowSecond = Math.floor(Date.now() / 1000)
    if (nowSecond !== currentSecond) {
      const gap = Math.min(nowSecond - currentSecond, SPARKLINE_BUCKETS)
      for (let i = 0; i < gap; i++) {
        secondBuckets.push(0)
        secondBuckets.shift()
      }
      currentSecond = nowSecond
    }
  }

  function incrementCurrentBucket(): void {
    trackSecondBucket()
    const lastIdx = secondBuckets.length - 1
    const current = secondBuckets[lastIdx]
    if (current !== undefined) {
      secondBuckets[lastIdx] = current + 1
    }
  }

  function handleEvent(event: ParsedEvent): void {
    totalEvents++
    incrementCurrentBucket()

    switch (event.kind) {
      case 'post':
        postCount++
        break
      case 'reply':
        replyCount++
        break
      case 'repost':
        repostCount++
        break
      case 'like':
        likeCount++
        break
      case 'follow':
        followCount++
        break
    }

    // Track language
    if (event.kind === 'post' || event.kind === 'reply') {
      const lc = languageCounts.get(event.language) ?? 0
      languageCounts.set(event.language, lc + 1)
    }

    // Track hashtags
    const now = Date.now()
    for (const tag of event.hashtags) {
      hashtagEvents.push({ tag, time: now })
      const hc = hashtagCounts.get(tag) ?? 0
      hashtagCounts.set(tag, hc + 1)
    }

    // Track interesting posts
    if (
      (event.kind === 'post' || event.kind === 'reply') &&
      event.text.length > 20
    ) {
      recentPosts.push(event)
      if (recentPosts.length > MAX_RECENT_POSTS) {
        recentPosts.shift()
      }
    }

    onEvent(event)
  }

  // Emit stats periodically
  const statsInterval = setInterval(() => {
    trackSecondBucket()
    updateHashtagCounts()

    // Calculate events per second (average of last 5 seconds)
    const recentSeconds = secondBuckets.slice(-5)
    const eps = recentSeconds.reduce((a, b) => a + b, 0) / recentSeconds.length

    const stats: FirehoseStats = {
      eventsPerSecond: Math.round(eps),
      totalEvents,
      postCount,
      replyCount,
      repostCount,
      likeCount,
      followCount,
      sparkline: [...secondBuckets],
      languageCounts: new Map(languageCounts),
      hashtagCounts: new Map(hashtagCounts),
      recentPosts: [...recentPosts],
      connected,
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    }

    onStats(stats)
  }, 250)

  // Batch incoming WebSocket messages to avoid overwhelming the main thread
  let messageBuffer: string[] = []
  let processingScheduled = false

  function processBuffer(): void {
    processingScheduled = false
    const batch = messageBuffer
    messageBuffer = []

    for (const raw of batch) {
      try {
        const msg = JSON.parse(raw) as JetstreamMessage
        const event = parseEvent(msg)
        if (event) {
          handleEvent(event)
        }
      } catch {
        // Skip malformed messages
      }
    }
  }

  function scheduleProcessing(): void {
    if (!processingScheduled) {
      processingScheduled = true
      requestAnimationFrame(processBuffer)
    }
  }

  function connect(): void {
    if (destroyed) return

    try {
      ws = new WebSocket(JETSTREAM_URL)
    } catch {
      scheduleReconnect()
      return
    }

    ws.onopen = () => {
      connected = true
      reconnectDelay = RECONNECT_DELAY_MS
      startTime = Date.now()
    }

    ws.onmessage = (e: MessageEvent<unknown>) => {
      if (typeof e.data === 'string') {
        messageBuffer.push(e.data)
        scheduleProcessing()
      }
    }

    ws.onclose = () => {
      connected = false
      if (!destroyed) {
        scheduleReconnect()
      }
    }

    ws.onerror = () => {
      connected = false
      ws?.close()
    }
  }

  function scheduleReconnect(): void {
    if (destroyed) return
    reconnectTimer = setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 1.5, MAX_RECONNECT_DELAY_MS)
      connect()
    }, reconnectDelay)
  }

  connect()

  return {
    destroy() {
      destroyed = true
      clearInterval(statsInterval)
      if (reconnectTimer) clearTimeout(reconnectTimer)
      ws?.close()
    },
  }
}
