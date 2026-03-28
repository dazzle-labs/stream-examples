import { useEffect, useRef, useCallback, useState } from 'react'

// --- Types ---

interface WikiEventLength {
  old: number
  new: number
}

interface WikiEventMeta {
  domain: string
  uri: string
  id: string
  dt: string
}

interface WikiEvent {
  type: 'edit' | 'new' | 'log' | 'categorize'
  meta: WikiEventMeta
  title: string
  user: string
  bot: boolean
  length?: WikiEventLength
  namespace: number
  comment: string
}

interface TrailPoint {
  x: number
  y: number
  alpha: number
}

interface Particle {
  x: number
  y: number
  targetX: number
  targetY: number
  startX: number
  startY: number
  progress: number
  speed: number
  size: number
  color: string
  opacity: number
  wikiKey: string
  alive: boolean
  trail: TrailPoint[]
}

interface WikiNode {
  key: string
  label: string
  x: number
  y: number
  angle: number
  glow: number
  editCount: number
  recentEdits: number
}

interface TickerEntry {
  title: string
  wiki: string
  user: string
  alpha: number
  age: number
}

interface EditStats {
  total: number
  timestamps: number[]
  wikiCounts: Map<string, number>
}

interface ComboEntry {
  title: string
  count: number
  lastHitTime: number
  fadeAlpha: number
  fading: boolean
  hitTimestamps: number[]
}

interface DisplayCombo {
  title: string
  count: number
  fading: boolean
}

interface VisualizationState {
  wikiNodes: Map<string, WikiNode>
  particles: Particle[]
  eventQueue: WikiEvent[]
  ticker: TickerEntry[]
  stats: EditStats
  combos: Map<string, ComboEntry>
  coreBreathPhase: number
  lastFrameTime: number
  animationId: number
  smoothedEps: number
  smoothedBreathEps: number
  smoothedBarWidths: Map<string, number>
  lastStatsDisplayTime: number
  displayEps: string
  displayTotal: string
}

// --- Constants ---

const WIDTH = 1280
const HEIGHT = 720
const CENTER_X = 480
const CENTER_Y = HEIGHT / 2
const RING_RADIUS = 250
const MAX_PARTICLES = 300
const MAX_EVENTS_PER_FRAME = 30
const PARTICLE_TRAVEL_MS = 800
const GLOW_DECAY = 0.985
const TRAIL_LENGTH = 12
const TICKER_MAX = 5
const EPS_WINDOW_MS = 5000
const COMBO_WINDOW_MS = 15 * 60_000 // 15 minutes
const COMBO_FADE_MS = 2000
const COMBO_MAX_DISPLAY = 30
const COMBO_SNAPSHOT_INTERVAL_MS = 500
const FRAME_MIN_MS = 33 // Cap at ~30fps to match stage capture rate

const TYPE_COLORS: Record<string, string> = {
  edit: '#00d4ff',
  new: '#00ff88',
  log: '#ffaa00',
  categorize: '#aa44ff',
}

const TOP_WIKIS = [
  'en', 'de', 'fr', 'es', 'ja', 'ru', 'it', 'zh', 'pt', 'pl',
  'nl', 'ar', 'sv', 'uk', 'fa', 'he', 'ko', 'fi', 'vi', 'commons',
]

// --- Helpers ---

function extractWikiKey(domain: string): string {
  if (domain.includes('commons.wikimedia.org')) return 'commons'
  if (domain.includes('wikidata.org')) return 'wikidata'
  const match = /^(\w+)\.wikipedia\.org$/.exec(domain)
  if (match && match[1]) return match[1]
  const subMatch = /^(\w+)\./.exec(domain)
  if (subMatch && subMatch[1]) return subMatch[1]
  return domain
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function hexToRgb(hex: string): { r: number, g: number, b: number } {
  const result = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result || !result[1] || !result[2] || !result[3]) return { r: 255, g: 255, b: 255 }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  }
}

function buildWikiNodes(): Map<string, WikiNode> {
  const nodes = new Map<string, WikiNode>()
  const count = TOP_WIKIS.length
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2
    const key = TOP_WIKIS[i]
    if (!key) continue
    nodes.set(key, {
      key,
      label: key,
      x: CENTER_X + Math.cos(angle) * RING_RADIUS,
      y: CENTER_Y + Math.sin(angle) * RING_RADIUS,
      angle,
      glow: 0,
      editCount: 0,
      recentEdits: 0,
    })
  }
  return nodes
}

function createParticle(event: WikiEvent, targetNode: WikiNode): Particle {
  const bytesChanged = event.length
    ? Math.abs(event.length.new - event.length.old)
    : 50
  const size = clamp(Math.sqrt(bytesChanged) * 0.4, 2, 14)
  const color = TYPE_COLORS[event.type] ?? '#ffffff'
  const opacity = event.bot ? 0.3 : 1.0

  return {
    x: CENTER_X,
    y: CENTER_Y,
    targetX: targetNode.x,
    targetY: targetNode.y,
    startX: CENTER_X,
    startY: CENTER_Y,
    progress: 0,
    speed: 1 / PARTICLE_TRAVEL_MS,
    size,
    color,
    opacity,
    wikiKey: targetNode.key,
    alive: true,
    trail: [],
  }
}

function parseWikiEvent(raw: unknown): WikiEvent | null {
  if (typeof raw !== 'object' || raw === null) return null

  const record = raw as Record<string, unknown>
  if (!('type' in record) || !('meta' in record) || !('title' in record) || !('user' in record)) {
    return null
  }

  const eventType = record.type
  if (
    eventType !== 'edit' &&
    eventType !== 'new' &&
    eventType !== 'log' &&
    eventType !== 'categorize'
  ) {
    return null
  }

  const meta = record.meta
  if (typeof meta !== 'object' || meta === null) return null
  const metaRecord = meta as Record<string, unknown>
  if (typeof metaRecord.domain !== 'string') return null

  const lengthField = record.length
  let parsedLength: WikiEventLength | undefined
  if (typeof lengthField === 'object' && lengthField !== null) {
    const lenRecord = lengthField as Record<string, unknown>
    if (typeof lenRecord.old === 'number' && typeof lenRecord.new === 'number') {
      parsedLength = { old: lenRecord.old, new: lenRecord.new }
    }
  }

  return {
    type: eventType,
    meta: {
      domain: metaRecord.domain,
      uri: typeof metaRecord.uri === 'string' ? metaRecord.uri : '',
      id: typeof metaRecord.id === 'string' ? metaRecord.id : '',
      dt: typeof metaRecord.dt === 'string' ? metaRecord.dt : '',
    },
    title: String(record.title),
    user: String(record.user),
    bot: Boolean(record.bot),
    length: parsedLength,
    namespace: typeof record.namespace === 'number' ? record.namespace : 0,
    comment: typeof record.comment === 'string' ? record.comment : '',
  }
}

// --- Pre-rendered core glow offscreen canvas ---
// Render the expensive radial gradients once, then stamp via drawImage each frame.

const CORE_BUFFER_SIZE = 320 // covers coreRadius * 4 at max breath
let coreOffscreen: OffscreenCanvas | null = null
let coreOffscreenCtx: OffscreenCanvasRenderingContext2D | null = null

function ensureCoreOffscreen(): void {
  if (coreOffscreen) return
  coreOffscreen = new OffscreenCanvas(CORE_BUFFER_SIZE, CORE_BUFFER_SIZE)
  coreOffscreenCtx = coreOffscreen.getContext('2d')
  if (!coreOffscreenCtx) return

  const cx = CORE_BUFFER_SIZE / 2
  const cy = CORE_BUFFER_SIZE / 2
  const baseRadius = 35
  const oc = coreOffscreenCtx

  // Draw the three gradient layers once at base scale (breath=1)
  oc.globalCompositeOperation = 'lighter'

  // Wide ambient glow
  const ambientGlow = oc.createRadialGradient(cx, cy, 0, cx, cy, baseRadius * 4)
  ambientGlow.addColorStop(0, 'rgba(0, 120, 255, 0.08)')
  ambientGlow.addColorStop(0.4, 'rgba(0, 80, 200, 0.03)')
  ambientGlow.addColorStop(1, 'rgba(0, 40, 120, 0)')
  oc.fillStyle = ambientGlow
  oc.beginPath()
  oc.arc(cx, cy, baseRadius * 4, 0, Math.PI * 2)
  oc.fill()

  // Outer glow
  const outerGlow = oc.createRadialGradient(cx, cy, 0, cx, cy, baseRadius * 2.5)
  outerGlow.addColorStop(0, 'rgba(0, 150, 255, 0.2)')
  outerGlow.addColorStop(0.5, 'rgba(0, 100, 200, 0.06)')
  outerGlow.addColorStop(1, 'rgba(0, 50, 150, 0)')
  oc.fillStyle = outerGlow
  oc.beginPath()
  oc.arc(cx, cy, baseRadius * 2.5, 0, Math.PI * 2)
  oc.fill()

  // Inner core
  const coreGrad = oc.createRadialGradient(cx, cy, 0, cx, cy, baseRadius)
  coreGrad.addColorStop(0, 'rgba(200, 235, 255, 0.95)')
  coreGrad.addColorStop(0.2, 'rgba(120, 200, 255, 0.7)')
  coreGrad.addColorStop(0.5, 'rgba(40, 130, 240, 0.4)')
  coreGrad.addColorStop(0.8, 'rgba(20, 70, 200, 0.15)')
  coreGrad.addColorStop(1, 'rgba(10, 40, 120, 0)')
  oc.fillStyle = coreGrad
  oc.beginPath()
  oc.arc(cx, cy, baseRadius, 0, Math.PI * 2)
  oc.fill()
}

// --- Rendering ---

function drawCore(ctx: CanvasRenderingContext2D, breathPhase: number, eps: number) {
  ensureCoreOffscreen()
  if (!coreOffscreen) return

  const breathScale = 1 + Math.sin(breathPhase) * 0.08 + clamp(eps * 0.005, 0, 0.15)
  const drawSize = CORE_BUFFER_SIZE * breathScale
  const halfDraw = drawSize / 2

  // Stamp the pre-rendered core glow, scaled by breath
  ctx.globalCompositeOperation = 'lighter'
  ctx.drawImage(
    coreOffscreen,
    CENTER_X - halfDraw,
    CENTER_Y - halfDraw,
    drawSize,
    drawSize,
  )
}

// Pre-compute RGB values for each type color to avoid per-particle hex parsing
const TYPE_RGBS: Record<string, { r: number, g: number, b: number }> = {}
for (const [key, hex] of Object.entries(TYPE_COLORS)) {
  TYPE_RGBS[key] = hexToRgb(hex)
}

// Build a lookup from hex color string to rgb for particles
const COLOR_TO_RGB = new Map<string, { r: number, g: number, b: number }>()
for (const hex of Object.values(TYPE_COLORS)) {
  COLOR_TO_RGB.set(hex, hexToRgb(hex))
}

function getRgb(color: string): { r: number, g: number, b: number } {
  return COLOR_TO_RGB.get(color) ?? { r: 255, g: 255, b: 255 }
}

function drawWikiNode(ctx: CanvasRenderingContext2D, node: WikiNode) {
  const glowIntensity = clamp(node.glow, 0, 1)

  // Glow aura -- simple semi-transparent circle instead of radial gradient
  if (glowIntensity > 0.01) {
    const auraRadius = 22 + glowIntensity * 18
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = `rgba(0, 150, 240, ${glowIntensity * 0.15})`
    ctx.beginPath()
    ctx.arc(node.x, node.y, auraRadius, 0, Math.PI * 2)
    ctx.fill()
  }

  // Node dot -- simple filled circle instead of radial gradient
  ctx.globalCompositeOperation = 'source-over'
  const nodeRadius = 5 + glowIntensity * 5
  // Outer soft ring for glow effect
  ctx.fillStyle = `rgba(80, 150, 220, ${(0.3 + glowIntensity * 0.2) * 0.5})`
  ctx.beginPath()
  ctx.arc(node.x, node.y, nodeRadius, 0, Math.PI * 2)
  ctx.fill()
  // Inner bright dot
  ctx.fillStyle = `rgba(210, 235, 255, ${0.7 + glowIntensity * 0.3})`
  ctx.beginPath()
  ctx.arc(node.x, node.y, nodeRadius * 0.5, 0, Math.PI * 2)
  ctx.fill()

  // Label positioned outside the ring
  ctx.fillStyle = `rgba(160, 200, 240, ${0.45 + glowIntensity * 0.55})`
  ctx.font = 'bold 11px "Noto Sans Mono", "Noto Sans", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const labelOffset = 24
  const labelX = node.x + Math.cos(node.angle) * labelOffset
  const labelY = node.y + Math.sin(node.angle) * labelOffset
  ctx.fillText(node.label, labelX, labelY)
}


function updateCombos(combos: Map<string, ComboEntry>, deltaMs: number) {
  const now = Date.now()
  const cutoff = now - COMBO_WINDOW_MS
  const keysToDelete: string[] = []
  combos.forEach((combo, key) => {
    // Prune expired timestamps
    combo.hitTimestamps = combo.hitTimestamps.filter(t => t >= cutoff)

    // If no recent hits, start fading or delete
    if (combo.hitTimestamps.length === 0) {
      keysToDelete.push(key)
      return
    }

    if (!combo.fading && (now - combo.lastHitTime) >= COMBO_WINDOW_MS) {
      combo.fading = true
    }
    if (combo.fading) {
      combo.fadeAlpha -= deltaMs / COMBO_FADE_MS
      if (combo.fadeAlpha <= 0) {
        keysToDelete.push(key)
      }
    }
  })
  for (const key of keysToDelete) {
    combos.delete(key)
  }
}

function snapshotCombos(combos: Map<string, ComboEntry>): DisplayCombo[] {
  const now = Date.now()
  const cutoff = now - COMBO_WINDOW_MS
  const displayable: Array<{ combo: ComboEntry, recentCount: number }> = []
  combos.forEach((combo) => {
    const recentCount = combo.hitTimestamps.filter(t => t >= cutoff).length
    if (recentCount >= 2) {
      displayable.push({ combo, recentCount })
    }
  })
  displayable.sort((a, b) => b.recentCount - a.recentCount)
  return displayable.slice(0, COMBO_MAX_DISPLAY).map(({ combo, recentCount }) => ({
    title: combo.title,
    count: recentCount,
    fading: combo.fading,
  }))
}

function comboTierClass(count: number): string {
  if (count >= 20) return 'text-red-400'
  if (count >= 10) return 'text-orange-400'
  if (count >= 5) return 'text-yellow-400'
  return 'text-gray-300'
}

function comboGlowStyle(count: number): React.CSSProperties {
  if (count >= 20) return { textShadow: '0 0 12px rgba(255, 50, 30, 0.7), 0 0 4px rgba(255, 50, 30, 0.4)' }
  if (count >= 10) return { textShadow: '0 0 8px rgba(255, 136, 0, 0.5)' }
  return {}
}

// --- Component ---

const LEGEND_ITEMS: Array<{ label: string, color: string }> = [
  { label: 'edit', color: '#00d4ff' },
  { label: 'new', color: '#00ff88' },
  { label: 'log', color: '#ffaa00' },
  { label: 'categorize', color: '#aa44ff' },
]

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [displayCombos, setDisplayCombos] = useState<DisplayCombo[]>([])
  const lastSnapshotRef = useRef(0)
  const stateRef = useRef<VisualizationState>({
    wikiNodes: buildWikiNodes(),
    particles: [],
    eventQueue: [],
    ticker: [],
    stats: {
      total: 0,
      timestamps: [],
      wikiCounts: new Map(),
    },
    combos: new Map(),
    coreBreathPhase: 0,
    lastFrameTime: 0,
    animationId: 0,
    smoothedEps: 0,
    smoothedBreathEps: 0,
    smoothedBarWidths: new Map(),
    lastStatsDisplayTime: 0,
    displayEps: '0.0',
    displayTotal: '0',
  })

  const processEvent = useCallback((event: WikiEvent) => {
    const state = stateRef.current
    state.eventQueue.push(event)

    // Update stats
    state.stats.total++
    state.stats.timestamps.push(Date.now())

    const wikiKey = extractWikiKey(event.meta.domain)
    const currentCount = state.stats.wikiCounts.get(wikiKey) ?? 0
    state.stats.wikiCounts.set(wikiKey, currentCount + 1)

    // Update combo tracking (only mainspace articles, skip wikidata IDs)
    const isWikidataId = /^[QLM]\d+$/.test(event.title)
    if (event.namespace === 0 && !isWikidataId) {
    const now = Date.now()
    const existingCombo = state.combos.get(event.title)
    if (existingCombo && (now - existingCombo.lastHitTime) < COMBO_WINDOW_MS) {
      existingCombo.count++
      existingCombo.lastHitTime = now
      existingCombo.fading = false
      existingCombo.fadeAlpha = 1
      existingCombo.hitTimestamps.push(now)
    } else {
      state.combos.set(event.title, {
        title: event.title,
        count: 1,
        lastHitTime: now,
        fadeAlpha: 1,
        fading: false,
        hitTimestamps: [now],
      })
    }
    }

    // Add to ticker for notable article edits only
    if (event.namespace === 0 && !event.bot && event.type !== 'log' && event.type !== 'categorize') {
      state.ticker.unshift({
        title: event.title,
        wiki: wikiKey,
        user: event.user,
        alpha: 0,
        age: 0,
      })
      if (state.ticker.length > TICKER_MAX) {
        state.ticker.pop()
      }
    }
  }, [])

  const getTopWikis = useCallback((): Array<{ key: string, count: number }> => {
    const counts = stateRef.current.stats.wikiCounts
    const entries: Array<{ key: string, count: number }> = []
    counts.forEach((count, key) => {
      entries.push({ key, count })
    })
    entries.sort((a, b) => b.count - a.count)
    return entries.slice(0, 15)
  }, [])

  const getEditsPerSecond = useCallback((): number => {
    const now = Date.now()
    const timestamps = stateRef.current.stats.timestamps
    while (timestamps.length > 0 && (timestamps[0] ?? now) < now - EPS_WINDOW_MS) {
      timestamps.shift()
    }
    return timestamps.length / (EPS_WINDOW_MS / 1000)
  }, [])

  const render = useCallback((ctx: CanvasRenderingContext2D, deltaMs: number) => {
    const state = stateRef.current

    // --- Process queued events into particles ---
    const eventsThisFrame = state.eventQueue.splice(0, MAX_EVENTS_PER_FRAME)
    for (const event of eventsThisFrame) {
      const wikiKey = extractWikiKey(event.meta.domain)
      const targetNode = state.wikiNodes.get(wikiKey)
      if (!targetNode) continue

      if (state.particles.length < MAX_PARTICLES) {
        state.particles.push(createParticle(event, targetNode))
      } else {
        const deadIdx = state.particles.findIndex(p => !p.alive)
        if (deadIdx >= 0) {
          state.particles[deadIdx] = createParticle(event, targetNode)
        }
      }
    }

    // --- Full opaque clear each frame ---
    // Semi-transparent clears force full-framebuffer compositing every frame
    // which is very expensive in software rendering. Instead, draw trails
    // explicitly from stored trail points.
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = '#060612'
    ctx.fillRect(0, 0, WIDTH, HEIGHT)

    // --- Central core ---
    const rawEps = getEditsPerSecond()
    // EMA smoothing for displayed edits/sec
    state.smoothedEps = state.smoothedEps * 0.92 + rawEps * 0.08
    // Heavier smoothing for breath input to avoid jitter
    state.smoothedBreathEps = state.smoothedBreathEps * 0.97 + rawEps * 0.03
    // Slower breath cycle (0.0012 instead of 0.002)
    state.coreBreathPhase += deltaMs * 0.0012
    drawCore(ctx, state.coreBreathPhase, state.smoothedBreathEps)

    // --- Ring connector (subtle) ---
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = 'rgba(40, 70, 120, 0.12)'
    ctx.lineWidth = 0.5
    ctx.setLineDash([2, 6])
    ctx.beginPath()
    ctx.arc(CENTER_X, CENTER_Y, RING_RADIUS, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])

    // --- Update particle positions ---
    for (const particle of state.particles) {
      if (!particle.alive) continue

      particle.progress += particle.speed * deltaMs
      const easedProgress = easeOutCubic(clamp(particle.progress, 0, 1))

      // Store trail point before updating position
      particle.trail.push({ x: particle.x, y: particle.y, alpha: particle.opacity })
      if (particle.trail.length > TRAIL_LENGTH) {
        particle.trail.shift()
      }

      // Update position
      particle.x = particle.startX + (particle.targetX - particle.startX) * easedProgress
      particle.y = particle.startY + (particle.targetY - particle.startY) * easedProgress

      // Check arrival
      if (particle.progress >= 1) {
        particle.alive = false
        const node = state.wikiNodes.get(particle.wikiKey)
        if (node) {
          node.glow = clamp(node.glow + 0.35, 0, 1)
          node.editCount++
        }
      }
    }

    // --- Draw particles batched by color (source-over, no additive blending) ---
    // Group particles by color to minimize fillStyle changes
    ctx.globalCompositeOperation = 'source-over'
    const colorGroups = new Map<string, Particle[]>()
    for (const particle of state.particles) {
      if (!particle.alive) continue
      const existing = colorGroups.get(particle.color)
      if (existing) {
        existing.push(particle)
      } else {
        colorGroups.set(particle.color, [particle])
      }
    }

    colorGroups.forEach((particles, color) => {
      const rgb = getRgb(color)

      // Draw all trails for this color group
      for (const particle of particles) {
        for (let i = 0; i < particle.trail.length; i++) {
          const point = particle.trail[i]
          if (!point) continue
          const trailAlpha = (i / particle.trail.length) * particle.opacity * 0.3
          const trailSize = particle.size * (i / particle.trail.length) * 0.6
          if (trailSize < 0.5) continue
          ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${trailAlpha})`
          ctx.beginPath()
          ctx.arc(point.x, point.y, trailSize, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Draw glow circles (larger, low alpha) for all particles of this color
      for (const particle of particles) {
        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${particle.opacity * 0.15})`
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size * 2, 0, Math.PI * 2)
        ctx.fill()
      }

      // Draw core dots for all particles of this color in a single path
      ctx.beginPath()
      for (const particle of particles) {
        ctx.moveTo(particle.x + particle.size, particle.y)
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
      }
      // Use the brightest alpha from this group (they share the same color)
      const maxOpacity = particles.reduce((max, p) => Math.max(max, p.opacity), 0)
      ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${maxOpacity})`
      ctx.fill()
    })

    // Prune dead particles when buffer is getting full
    if (state.particles.length > MAX_PARTICLES * 0.8) {
      state.particles = state.particles.filter(p => p.alive)
    }

    // --- Draw wiki nodes ---
    state.wikiNodes.forEach((node) => {
      node.glow *= GLOW_DECAY
      drawWikiNode(ctx, node)
    })

    // --- Stats overlay (top-left) ---
    ctx.globalCompositeOperation = 'source-over'

    // Throttle stats text updates to every 500ms
    const statsNow = Date.now()
    if (statsNow - state.lastStatsDisplayTime >= 500) {
      state.lastStatsDisplayTime = statsNow
      state.displayEps = state.smoothedEps.toFixed(1)
      state.displayTotal = state.stats.total.toLocaleString()
    }

    const topWikis = getTopWikis()

    // Background panel
    ctx.fillStyle = 'rgba(6, 6, 18, 0.6)'
    ctx.beginPath()
    ctx.roundRect(16, 14, 160, 90 + topWikis.length * 14, 6)
    ctx.fill()

    ctx.fillStyle = 'rgba(160, 210, 240, 0.8)'
    ctx.font = '14px "Noto Sans Mono", "Noto Sans", sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'

    ctx.fillText(`${state.displayEps} edits/sec`, 28, 24)

    ctx.fillStyle = 'rgba(120, 170, 220, 0.5)'
    ctx.font = '12px "Noto Sans Mono", "Noto Sans", sans-serif'
    ctx.fillText(`${state.displayTotal} total`, 28, 46)

    // Separator
    ctx.strokeStyle = 'rgba(80, 130, 200, 0.15)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(28, 66)
    ctx.lineTo(160, 66)
    ctx.stroke()

    ctx.fillStyle = 'rgba(100, 160, 220, 0.35)'
    ctx.font = '10px "Noto Sans Mono", "Noto Sans", sans-serif'
    ctx.fillText('most active', 28, 74)

    for (let i = 0; i < topWikis.length; i++) {
      const entry = topWikis[i]
      if (!entry) continue
      const targetBarWidth = clamp((entry.count / (topWikis[0]?.count || 1)) * 80, 4, 80)
      // EMA smoothing for bar widths
      const prevBarWidth = state.smoothedBarWidths.get(entry.key) ?? targetBarWidth
      const smoothedBarWidth = prevBarWidth * 0.9 + targetBarWidth * 0.1
      state.smoothedBarWidths.set(entry.key, smoothedBarWidth)
      ctx.fillStyle = 'rgba(0, 150, 255, 0.1)'
      ctx.fillRect(28, 88 + i * 14, smoothedBarWidth, 12)
      ctx.fillStyle = 'rgba(140, 190, 230, 0.6)'
      ctx.font = '10px "Noto Sans Mono", "Noto Sans", sans-serif'
      ctx.fillText(`${entry.key}`, 32, 89 + i * 14)
      ctx.fillStyle = 'rgba(100, 150, 200, 0.4)'
      ctx.textAlign = 'right'
      ctx.fillText(`${entry.count}`, 160, 89 + i * 14)
      ctx.textAlign = 'left'
    }

    // --- Title (center-top, above radial) ---
    ctx.fillStyle = 'rgba(140, 190, 230, 0.2)'
    ctx.font = 'bold 15px "Noto Sans Mono", "Noto Sans", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('WIKIPEDIA PULSE', CENTER_X, 28)
    ctx.fillStyle = 'rgba(100, 150, 200, 0.12)'
    ctx.font = '11px "Noto Sans Mono", "Noto Sans", sans-serif'
    ctx.fillText('real-time edits via SSE', CENTER_X, 48)

    // --- Update combo state (decay/cleanup, no canvas drawing) ---
    updateCombos(state.combos, deltaMs)

    // --- Snapshot combos to React state periodically ---
    const now = Date.now()
    if (now - lastSnapshotRef.current >= COMBO_SNAPSHOT_INTERVAL_MS) {
      lastSnapshotRef.current = now
      setDisplayCombos(snapshotCombos(state.combos))
    }

    // --- Ticker (bottom 80px of canvas) ---
    const tickerTop = HEIGHT - 80
    ctx.fillStyle = '#060612'
    ctx.fillRect(0, tickerTop - 4, WIDTH, HEIGHT - tickerTop + 4)

    ctx.textAlign = 'left'
    ctx.font = '11px "Noto Sans Mono", "Noto Sans", sans-serif'
    const tickerLineHeight = 16

    for (let i = 0; i < state.ticker.length; i++) {
      const entry = state.ticker[i]
      if (!entry) continue
      entry.age += deltaMs
      entry.alpha = clamp(entry.age / 400, 0, 1) * clamp(1 - (i / TICKER_MAX), 0.15, 1)

      const y = tickerTop + i * tickerLineHeight
      if (y > HEIGHT - 4) continue

      // Wiki badge
      ctx.fillStyle = `rgba(0, 180, 255, ${entry.alpha * 0.5})`
      ctx.fillText(`[${entry.wiki}]`, 24, y)

      // Title
      const badgeWidth = (entry.wiki.length + 2) * 7 + 8
      const truncatedTitle = entry.title.length > 50
        ? entry.title.substring(0, 47) + '...'
        : entry.title
      ctx.fillStyle = `rgba(200, 220, 240, ${entry.alpha * 0.65})`
      ctx.fillText(truncatedTitle, 24 + badgeWidth, y)

      // User
      ctx.fillStyle = `rgba(120, 160, 200, ${entry.alpha * 0.35})`
      const titleWidth = Math.min(truncatedTitle.length, 50) * 7
      const userX = 24 + badgeWidth + titleWidth + 12
      if (userX < WIDTH - 160) {
        ctx.fillText(`~ ${entry.user}`, userX, y)
      }
    }
  }, [getEditsPerSecond, getTopWikis])

  // Periodically reload the page to clear accumulated state
  useEffect(() => {
    const FOUR_HOURS = 4 * 60 * 60 * 1000
    const id = setInterval(() => {
      location.reload()
    }, FOUR_HOURS)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const state = stateRef.current

    // Initial full clear
    ctx.fillStyle = '#060612'
    ctx.fillRect(0, 0, WIDTH, HEIGHT)

    // Connect to Wikipedia SSE stream with exponential backoff reconnection
    let currentSource: EventSource | null = null
    let consecutiveFailures = 0
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    const MAX_BACKOFF_MS = 30_000
    const MAX_CONSECUTIVE_FAILURES = 25

    const connectStream = () => {
      if (currentSource) {
        currentSource.close()
      }
      const es = new EventSource('https://stream.wikimedia.org/v2/stream/recentchange')

      es.onmessage = (messageEvent: MessageEvent<string>) => {
        // Successful message resets the failure counter
        consecutiveFailures = 0
        try {
          const data: unknown = JSON.parse(messageEvent.data)
          const event = parseWikiEvent(data)
          if (event) {
            processEvent(event)
          }
        } catch {
          // Silently ignore malformed events
        }
      }

      es.onerror = () => {
        es.close()
        consecutiveFailures++

        // If we've failed too many times in a row, hard reload the page
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          location.reload()
          return
        }

        // Exponential backoff: 2s, 4s, 8s, 16s, capped at 30s
        const delay = Math.min(2000 * Math.pow(2, consecutiveFailures - 1), MAX_BACKOFF_MS)
        reconnectTimer = setTimeout(connectStream, delay)
      }

      currentSource = es
    }

    connectStream()

    // Animation loop -- capped at ~30fps to match Dazzle stage capture rate.
    // Rendering at 60fps on a CPU-only stage just wastes cycles.
    state.lastFrameTime = performance.now()

    const animate = (timestamp: number) => {
      const elapsed = timestamp - state.lastFrameTime
      if (elapsed < FRAME_MIN_MS) {
        // Skip this frame -- not enough time has passed
        state.animationId = requestAnimationFrame(animate)
        return
      }
      const deltaMs = Math.min(elapsed, 50)
      state.lastFrameTime = timestamp
      render(ctx, deltaMs)
      state.animationId = requestAnimationFrame(animate)
    }

    state.animationId = requestAnimationFrame(animate)

    return () => {
      if (currentSource) {
        currentSource.close()
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
      }
      cancelAnimationFrame(state.animationId)
    }
  }, [processEvent, render])

  return (
    <div className="relative w-[1280px] h-[720px]" style={{
      background: '#060612',
      overflow: 'hidden',
    }}>
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
      />
      {/* Trending combo overlay */}
      <div
        className="absolute top-0 right-0 flex flex-col justify-between pointer-events-none"
        style={{
          width: 380,
          height: 720,
          overflow: 'hidden',
          borderLeft: '1px solid rgba(80, 130, 200, 0.12)',
          background: 'rgba(0, 0, 0, 0.4)',
          padding: '12px 14px 12px',
          fontFamily: '"Noto Sans Mono", "Noto Sans", sans-serif',
        }}
      >
        <div className="flex flex-col gap-0.5" style={{ overflow: 'hidden', maxHeight: 660 }}>
          <div
            className="text-[10px] uppercase tracking-[0.15em] mb-2"
            style={{ color: 'rgba(140, 190, 230, 0.45)' }}
          >
            Trending
          </div>
          <table className="w-full border-collapse" style={{ fontSize: 12, tableLayout: 'fixed' }}>
            <tbody>
              {displayCombos.map((combo) => {
                const tierClass = comboTierClass(combo.count)
                const glowSt = comboGlowStyle(combo.count)
                return (
                  <tr
                    key={combo.title}
                    className={`transition-opacity duration-500 ${combo.fading ? 'opacity-30' : 'opacity-100'}`}
                    style={{ height: 24, maxHeight: 24, overflow: 'hidden' }}
                  >
                    <td
                      className="py-[3px] pr-3 text-left"
                      style={{
                        color: 'rgba(200, 220, 240, 0.7)',
                        maxWidth: 300,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={combo.title}
                    >
                      {combo.title}
                    </td>
                    <td
                      className={`py-[3px] text-right whitespace-nowrap font-bold tabular-nums w-[40px] ${tierClass}`}
                      style={glowSt}
                    >
                      {combo.count}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {/* Legend */}
        <div className="flex gap-4 flex-shrink-0" style={{ fontSize: 10 }}>
          {LEGEND_ITEMS.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span
                className="inline-block w-[6px] h-[6px] rounded-full opacity-60"
                style={{ background: item.color }}
              />
              <span style={{ color: 'rgba(140, 180, 220, 0.4)' }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
