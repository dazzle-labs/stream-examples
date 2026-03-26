import { useEffect, useRef, useCallback } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RssItem {
  name: string
  version: string
  link: string
  pubDate: number
}

interface PackageMeta {
  summary: string
}

interface Comet {
  id: string
  name: string
  version: string
  hue: number
  saturation: number
  versionType: 'major' | 'minor' | 'patch'
  birthTime: number
  launchAngle: number
  orbitRadius: number
  r: number
  theta: number
  angularVel: number
  coreRadius: number
  opacity: number
  temperature: number
  settled: boolean
  trail: Array<{ x: number; y: number; alpha: number }>
  summary: string
}

interface Shockwave {
  birthTime: number
  cx: number
  cy: number
  hue: number
  maxRadius: number
}

interface Star {
  x: number
  y: number
  radius: number
  baseAlpha: number
  twinkleSpeed: number
  twinklePhase: number
}

interface NebulaBlob {
  x: number
  y: number
  radius: number
  hue: number
  alpha: number
  driftX: number
  driftY: number
  pulseSpeed: number
  pulsePhase: number
}

interface Stats {
  packagesPerMinute: number
  lastReleaseTime: number
  totalSeen: number
  recentTimestamps: number[]
  rateHistory: number[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const W = 1280
const H = 720
const CX = W / 2
const CY = H / 2
const MAX_COMETS = 60
const MAX_LIFETIME_MS = 120000
const FADE_OUT_MS = 8000
const POLL_INTERVAL_MS = 30000
const DPR = Math.min(window.devicePixelRatio, 2)
const TRAIL_LENGTH = 28
const RSS_PATH = '/api/pypi/rss/updates.xml'
const PYPI_JSON_PATH = '/api/pypi/pypi'

const ORBIT_BANDS = [140, 185, 230, 275, 320] as const

const STAR_COUNT = 200
const NEBULA_COUNT = 8

// Version type colors
const VERSION_COLORS: Record<'major' | 'minor' | 'patch', { hue: number; sat: number; light: number; label: string }> = {
  major: { hue: 42, sat: 95, light: 65, label: 'Major' },
  minor: { hue: 195, sat: 85, light: 60, label: 'Minor' },
  patch: { hue: 270, sat: 40, light: 55, label: 'Patch' },
}

// Simulated package names for fallback
const SIM_PACKAGES = [
  'requests', 'flask', 'django', 'numpy', 'pandas', 'scikit-learn',
  'tensorflow', 'torch', 'fastapi', 'pydantic', 'celery', 'boto3',
  'sqlalchemy', 'pytest', 'black', 'mypy', 'httpx', 'uvicorn',
  'gunicorn', 'pillow', 'matplotlib', 'scipy', 'aiohttp', 'cryptography',
  'click', 'typer', 'rich', 'textual', 'polars', 'dask',
  'streamlit', 'gradio', 'langchain', 'openai', 'anthropic',
  'transformers', 'huggingface-hub', 'wandb', 'mlflow', 'ray',
  'arrow', 'attrs', 'beautifulsoup4', 'certifi', 'charset-normalizer',
  'colorama', 'decorator', 'filelock', 'frozenlist', 'greenlet',
  'idna', 'importlib-metadata', 'jinja2', 'markupsafe', 'multidict',
  'packaging', 'pip', 'platformdirs', 'pluggy', 'protobuf',
  'pyasn1', 'pycparser', 'pygments', 'pyparsing', 'python-dateutil',
  'pyyaml', 'regex', 'ruff', 'setuptools', 'six', 'sniffio',
  'tqdm', 'typing-extensions', 'urllib3', 'virtualenv', 'wheel',
  'wrapt', 'zipp', 'orjson', 'msgpack', 'lxml',
] as const

const SIM_SUMMARIES = [
  'A simple, yet elegant, HTTP library.',
  'A micro web framework for Python.',
  'The web framework for perfectionists with deadlines.',
  'Fundamental package for scientific computing.',
  'Powerful data structures for data analysis.',
  'Machine learning in Python.',
  'An end-to-end open source ML platform.',
  'Tensors and dynamic neural networks.',
  'Modern, fast web framework for building APIs.',
  'Data validation using Python type hints.',
  'Distributed task queue.',
  'The AWS SDK for Python.',
  'The Python SQL Toolkit and ORM.',
  'Simple powerful testing with Python.',
  'The uncompromising code formatter.',
  'Optional static typing for Python.',
  'A next-generation HTTP client for Python.',
  'Lightning-fast ASGI server.',
] as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseVersionType(version: string): 'major' | 'minor' | 'patch' {
  const parts = version.split('.')
  const minor = parts[1]
  const patch = parts[2]

  if (parts[0] === '0') return 'minor'

  if ((minor === '0' || minor === undefined) && (patch === '0' || patch === undefined)) {
    return 'major'
  }

  if (patch === '0' || patch === undefined) {
    return 'minor'
  }

  return 'patch'
}

function versionCoreRadius(type: 'major' | 'minor' | 'patch'): number {
  switch (type) {
    case 'major': return 14
    case 'minor': return 8
    case 'patch': return 4.5
  }
}

function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function safeRecordGet(obj: object, key: string): unknown {
  if (key in obj) {
    return Object.getOwnPropertyDescriptor(obj, key)?.value
  }
  return undefined
}

function neonHsl(hue: number, sat: number, light: number, alpha: number): string {
  return `hsla(${hue}, ${Math.min(100, sat)}%, ${light}%, ${alpha})`
}

function versionTypeHue(type: 'major' | 'minor' | 'patch'): number {
  return VERSION_COLORS[type].hue
}

function versionTypeSat(type: 'major' | 'minor' | 'patch'): number {
  return VERSION_COLORS[type].sat
}

function timeAgo(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  return `${Math.floor(minutes / 60)}h ago`
}

// ---------------------------------------------------------------------------
// RSS Parsing
// ---------------------------------------------------------------------------

function parseRssFeed(xml: string): RssItem[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'text/xml')
  const items = doc.querySelectorAll('item')
  const results: RssItem[] = []

  items.forEach((item) => {
    const title = item.querySelector('title')?.textContent ?? ''
    const link = item.querySelector('link')?.textContent ?? ''
    const pubDateStr = item.querySelector('pubDate')?.textContent ?? ''

    const lastSpace = title.lastIndexOf(' ')
    if (lastSpace === -1) return

    const name = title.substring(0, lastSpace).trim()
    const version = title.substring(lastSpace + 1).trim()
    if (!name || !version) return

    const pubDate = pubDateStr ? new Date(pubDateStr).getTime() : Date.now()
    results.push({ name, version, link, pubDate })
  })

  return results
}

// ---------------------------------------------------------------------------
// Star field
// ---------------------------------------------------------------------------

function createStars(): Star[] {
  const stars: Star[] = []
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      radius: 0.3 + Math.random() * 1.2,
      baseAlpha: 0.15 + Math.random() * 0.45,
      twinkleSpeed: 0.0005 + Math.random() * 0.002,
      twinklePhase: Math.random() * Math.PI * 2,
    })
  }
  return stars
}

function drawStars(ctx: CanvasRenderingContext2D, stars: Star[], time: number) {
  for (const s of stars) {
    const twinkle = s.baseAlpha + 0.15 * Math.sin(time * s.twinkleSpeed + s.twinklePhase)
    const alpha = Math.max(0.05, twinkle)

    ctx.beginPath()
    ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(200, 210, 240, ${alpha})`
    ctx.fill()

    if (s.radius > 0.8 && alpha > 0.35) {
      const spikeLen = s.radius * 3
      const spikeAlpha = alpha * 0.3
      ctx.strokeStyle = `rgba(200, 220, 255, ${spikeAlpha})`
      ctx.lineWidth = 0.3
      ctx.beginPath()
      ctx.moveTo(s.x - spikeLen, s.y)
      ctx.lineTo(s.x + spikeLen, s.y)
      ctx.moveTo(s.x, s.y - spikeLen)
      ctx.lineTo(s.x, s.y + spikeLen)
      ctx.stroke()
    }
  }
}

// ---------------------------------------------------------------------------
// Nebula clouds
// ---------------------------------------------------------------------------

function createNebulae(): NebulaBlob[] {
  const blobs: NebulaBlob[] = []
  const hues = [220, 270, 320, 180, 260, 200, 340, 160]
  for (let i = 0; i < NEBULA_COUNT; i++) {
    const angle = (i / NEBULA_COUNT) * Math.PI * 2
    const dist = 200 + Math.random() * 250
    blobs.push({
      x: CX + Math.cos(angle) * dist,
      y: CY + Math.sin(angle) * dist,
      radius: 180 + Math.random() * 200,
      hue: hues[i % hues.length] ?? 220,
      alpha: 0.025 + Math.random() * 0.03,
      driftX: (Math.random() - 0.5) * 0.03,
      driftY: (Math.random() - 0.5) * 0.03,
      pulseSpeed: 0.0003 + Math.random() * 0.0004,
      pulsePhase: Math.random() * Math.PI * 2,
    })
  }
  return blobs
}

function drawNebulae(ctx: CanvasRenderingContext2D, blobs: NebulaBlob[], time: number) {
  for (const b of blobs) {
    b.x += b.driftX
    b.y += b.driftY

    if (b.x < -b.radius) b.x = W + b.radius
    if (b.x > W + b.radius) b.x = -b.radius
    if (b.y < -b.radius) b.y = H + b.radius
    if (b.y > H + b.radius) b.y = -b.radius

    const pulse = b.alpha + 0.012 * Math.sin(time * b.pulseSpeed + b.pulsePhase)
    const alpha = Math.max(0.008, pulse)

    const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.radius)
    grad.addColorStop(0, neonHsl(b.hue, 50, 35, alpha * 2))
    grad.addColorStop(0.25, neonHsl(b.hue, 40, 25, alpha * 1.2))
    grad.addColorStop(0.6, neonHsl(b.hue, 25, 18, alpha * 0.5))
    grad.addColorStop(1, 'rgba(0,0,0,0)')

    ctx.beginPath()
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()
  }
}

// ---------------------------------------------------------------------------
// Central nexus
// ---------------------------------------------------------------------------

function drawNexus(ctx: CanvasRenderingContext2D, time: number, recentActivity: number) {
  const activity = Math.min(1, recentActivity / 10)
  const breathe = 0.7 + 0.3 * Math.sin(time * 0.0008)
  const intensity = 0.4 + activity * 0.6

  const auraRadius = 160 + 40 * breathe + activity * 50
  const aura = ctx.createRadialGradient(CX, CY, 0, CX, CY, auraRadius)
  aura.addColorStop(0, `rgba(130, 150, 255, ${0.12 * intensity})`)
  aura.addColorStop(0.2, `rgba(100, 120, 240, ${0.06 * intensity})`)
  aura.addColorStop(0.5, `rgba(60, 50, 200, ${0.025 * intensity})`)
  aura.addColorStop(1, 'rgba(0,0,0,0)')

  ctx.beginPath()
  ctx.arc(CX, CY, auraRadius, 0, Math.PI * 2)
  ctx.fillStyle = aura
  ctx.fill()

  const coreRadius = 12 + 5 * breathe + activity * 8
  const core = ctx.createRadialGradient(CX, CY, 0, CX, CY, coreRadius)
  core.addColorStop(0, `rgba(240, 245, 255, ${0.95 * intensity})`)
  core.addColorStop(0.15, `rgba(200, 215, 255, ${0.7 * intensity})`)
  core.addColorStop(0.4, `rgba(120, 150, 255, ${0.35 * intensity})`)
  core.addColorStop(0.7, `rgba(80, 100, 220, ${0.12 * intensity})`)
  core.addColorStop(1, 'rgba(60, 80, 200, 0)')

  ctx.beginPath()
  ctx.arc(CX, CY, coreRadius, 0, Math.PI * 2)
  ctx.fillStyle = core
  ctx.fill()

  const warmRadius = 80 + 20 * breathe
  const warm = ctx.createRadialGradient(CX, CY, 0, CX, CY, warmRadius)
  warm.addColorStop(0, `rgba(180, 160, 255, ${0.06 * intensity})`)
  warm.addColorStop(0.3, `rgba(140, 100, 220, ${0.03 * intensity})`)
  warm.addColorStop(1, 'rgba(0,0,0,0)')

  ctx.beginPath()
  ctx.arc(CX, CY, warmRadius, 0, Math.PI * 2)
  ctx.fillStyle = warm
  ctx.fill()

  const spokeCount = 8
  ctx.save()
  ctx.translate(CX, CY)
  ctx.rotate(time * 0.00012)

  for (let i = 0; i < spokeCount; i++) {
    const angle = (i / spokeCount) * Math.PI * 2
    const spokeLen = 80 + 30 * Math.sin(time * 0.0008 + i * 1.2)
    const spokeAlpha = 0.04 * intensity

    const sx = Math.cos(angle) * spokeLen
    const sy = Math.sin(angle) * spokeLen
    const spokeGrad = ctx.createLinearGradient(0, 0, sx, sy)
    spokeGrad.addColorStop(0, `rgba(180, 200, 255, ${spokeAlpha * 1.5})`)
    spokeGrad.addColorStop(0.5, `rgba(120, 150, 255, ${spokeAlpha * 0.5})`)
    spokeGrad.addColorStop(1, `rgba(80, 100, 200, 0)`)

    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(sx, sy)
    ctx.strokeStyle = spokeGrad
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.stroke()
  }
  ctx.restore()

  for (let bi = 0; bi < ORBIT_BANDS.length; bi++) {
    const band = ORBIT_BANDS[bi]
    if (band === undefined) continue
    const ringAlpha = 0.035 + 0.015 * Math.sin(time * 0.0003 + band * 0.01)

    ctx.beginPath()
    ctx.arc(CX, CY, band, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(90, 120, 200, ${ringAlpha})`
    ctx.lineWidth = 0.6
    ctx.setLineDash([4, 8])
    ctx.stroke()
    ctx.setLineDash([])
  }
}

// ---------------------------------------------------------------------------
// Shockwave rings
// ---------------------------------------------------------------------------

function drawShockwaves(
  ctx: CanvasRenderingContext2D,
  waves: Shockwave[],
  time: number,
) {
  for (let i = waves.length - 1; i >= 0; i--) {
    const w = waves[i]
    if (!w) continue

    const age = time - w.birthTime
    const duration = 2500
    if (age > duration) {
      waves.splice(i, 1)
      continue
    }
    if (age < 0) continue

    const progress = age / duration
    const radius = w.maxRadius * easeOutExpo(progress)
    const alpha = (1 - progress) * 0.25

    ctx.beginPath()
    ctx.arc(w.cx, w.cy, radius, 0, Math.PI * 2)
    ctx.strokeStyle = neonHsl(w.hue, 85, 70, alpha)
    ctx.lineWidth = 2.5 * (1 - progress) + 0.5
    ctx.stroke()

    if (progress > 0.1) {
      const secondProgress = (progress - 0.1) / 0.9
      const secondRadius = w.maxRadius * 0.7 * easeOutExpo(secondProgress)
      const secondAlpha = (1 - secondProgress) * 0.1

      ctx.beginPath()
      ctx.arc(w.cx, w.cy, secondRadius, 0, Math.PI * 2)
      ctx.strokeStyle = neonHsl(w.hue, 60, 75, secondAlpha)
      ctx.lineWidth = 1 * (1 - secondProgress) + 0.3
      ctx.stroke()
    }
  }
}

// ---------------------------------------------------------------------------
// Comet update + drawing
// ---------------------------------------------------------------------------

function updateComet(comet: Comet, time: number) {
  const age = time - comet.birthTime
  if (age < 0) return

  const launchDuration = 1200
  if (age < launchDuration) {
    const t = easeOutExpo(age / launchDuration)
    comet.r = lerp(0, comet.orbitRadius, t)
    comet.theta = comet.launchAngle + t * 0.8
    comet.temperature = Math.max(0, 1 - t * 0.7)
    comet.settled = false
  } else {
    comet.settled = true
    comet.temperature = Math.max(0, comet.temperature - 0.001)
    comet.theta += comet.angularVel

    const breathe = Math.sin(time * 0.0005 + comet.launchAngle) * 3
    comet.r = comet.orbitRadius + breathe
  }

  const timeLeft = MAX_LIFETIME_MS - age
  if (age < 400) {
    comet.opacity = age / 400
  } else if (timeLeft < FADE_OUT_MS) {
    comet.opacity = Math.max(0, timeLeft / FADE_OUT_MS)
  } else {
    comet.opacity = 1
  }

  const globalRotation = time * 0.00003
  const displayTheta = comet.theta + globalRotation
  const x = CX + Math.cos(displayTheta) * comet.r
  const y = CY + Math.sin(displayTheta) * comet.r

  comet.trail.unshift({ x, y, alpha: comet.opacity })
  if (comet.trail.length > TRAIL_LENGTH) {
    comet.trail.pop()
  }
}

function drawCometTrail(ctx: CanvasRenderingContext2D, comet: Comet) {
  if (comet.trail.length < 2) return

  for (let i = 1; i < comet.trail.length; i++) {
    const prev = comet.trail[i - 1]
    const curr = comet.trail[i]
    if (!prev || !curr) continue

    const trailFade = 1 - i / comet.trail.length
    const alpha = comet.opacity * trailFade * 0.5

    if (alpha <= 0.005) continue

    const tempLight = lerp(60, 95, comet.temperature * trailFade)
    const tempSat = lerp(comet.saturation, 20, comet.temperature * trailFade)

    const width = Math.max(0.5, comet.coreRadius * 0.8 * trailFade)

    ctx.beginPath()
    ctx.moveTo(prev.x, prev.y)
    ctx.lineTo(curr.x, curr.y)
    ctx.strokeStyle = neonHsl(comet.hue, tempSat, tempLight, alpha)
    ctx.lineWidth = width
    ctx.lineCap = 'round'
    ctx.stroke()
  }
}

function drawComet(ctx: CanvasRenderingContext2D, comet: Comet) {
  if (comet.opacity <= 0.01) return

  const head = comet.trail[0]
  if (!head) return

  const x = head.x
  const y = head.y

  drawCometTrail(ctx, comet)

  const r = comet.coreRadius
  const op = comet.opacity

  const coreLight = lerp(70, 97, comet.temperature)
  const coreSat = lerp(comet.saturation, 10, comet.temperature)

  // Outer bloom
  const bloomR = r * (5 + comet.temperature * 10)
  const bloom = ctx.createRadialGradient(x, y, 0, x, y, bloomR)
  bloom.addColorStop(0, neonHsl(comet.hue, coreSat, coreLight, op * 0.3))
  bloom.addColorStop(0.1, neonHsl(comet.hue, comet.saturation, 65, op * 0.15))
  bloom.addColorStop(0.3, neonHsl(comet.hue, comet.saturation, 45, op * 0.05))
  bloom.addColorStop(1, 'rgba(0,0,0,0)')

  ctx.beginPath()
  ctx.arc(x, y, bloomR, 0, Math.PI * 2)
  ctx.fillStyle = bloom
  ctx.fill()

  // Mid glow
  const midR = r * (2.5 + comet.temperature * 4)
  const mid = ctx.createRadialGradient(x, y, r * 0.2, x, y, midR)
  mid.addColorStop(0, neonHsl(comet.hue, Math.min(100, coreSat + 10), coreLight, op * 0.6))
  mid.addColorStop(0.4, neonHsl(comet.hue, comet.saturation, 55, op * 0.2))
  mid.addColorStop(1, 'rgba(0,0,0,0)')

  ctx.beginPath()
  ctx.arc(x, y, midR, 0, Math.PI * 2)
  ctx.fillStyle = mid
  ctx.fill()

  // Core orb
  const coreGrad = ctx.createRadialGradient(
    x - r * 0.25, y - r * 0.25, 0,
    x, y, r,
  )
  coreGrad.addColorStop(0, neonHsl(comet.hue, Math.min(100, coreSat + 20), Math.min(98, coreLight + 5), op))
  coreGrad.addColorStop(0.4, neonHsl(comet.hue, comet.saturation, 65, op * 0.9))
  coreGrad.addColorStop(1, neonHsl(comet.hue, comet.saturation, 35, op * 0.4))

  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = coreGrad
  ctx.fill()

  // Specular highlight
  const specR = r * 0.5
  const spec = ctx.createRadialGradient(
    x - r * 0.3, y - r * 0.3, 0,
    x - r * 0.1, y - r * 0.1, specR,
  )
  spec.addColorStop(0, `rgba(255, 255, 255, ${op * 0.7})`)
  spec.addColorStop(0.4, `rgba(255, 255, 255, ${op * 0.15})`)
  spec.addColorStop(1, 'rgba(255,255,255,0)')

  ctx.beginPath()
  ctx.arc(x, y, specR, 0, Math.PI * 2)
  ctx.fillStyle = spec
  ctx.fill()

}

// Draw label for a comet that should be labeled (called selectively, not for every comet)
function drawCometLabel(
  ctx: CanvasRenderingContext2D,
  comet: Comet,
  time: number,
  showLabel: boolean,
) {
  if (!showLabel) return
  if (comet.opacity <= 0.01) return

  const head = comet.trail[0]
  if (!head) return

  const op = comet.opacity
  const r = comet.coreRadius

  // Label visible from 4s (after arrival flash) to 30s
  const age = time - comet.birthTime
  const labelStart = 4000
  const labelEnd = 30000
  const fadeIn = 600
  const fadeOut = 5000

  if (age < labelStart || age > labelEnd) return

  const labelAge = age - labelStart
  const timeToEnd = labelEnd - age

  const labelProgress = labelAge < fadeIn
    ? labelAge / fadeIn
    : timeToEnd < fadeOut
      ? Math.max(0, timeToEnd / fadeOut)
      : 1
  const labelAlpha = op * labelProgress * 0.9

  if (labelAlpha < 0.03) return

  const labelDist = comet.r + r + 18
  const globalRot = time * 0.00003
  const lx = CX + Math.cos(comet.theta + globalRot) * labelDist
  const ly = CY + Math.sin(comet.theta + globalRot) * labelDist

  const isRight = lx > CX

  // Version type color for the version badge
  const vtColor = VERSION_COLORS[comet.versionType]

  // Measure text
  const nameText = comet.name
  const verText = `v${comet.version}`
  ctx.font = '600 18px "Outfit", sans-serif'
  const nameWidth = ctx.measureText(nameText).width
  ctx.font = '400 13px "JetBrains Mono", monospace'
  const verWidth = ctx.measureText(verText).width
  const totalWidth = nameWidth + verWidth + 16
  const pillX = isRight ? lx - 4 : lx - totalWidth + 4
  const pillY = ly - 14

  // Semi-transparent background pill for readability
  ctx.fillStyle = `rgba(5, 5, 8, ${labelAlpha * 0.75})`
  ctx.beginPath()
  const pillRadius = 6
  const pw = totalWidth + 8
  const ph = 28
  ctx.moveTo(pillX + pillRadius, pillY)
  ctx.lineTo(pillX + pw - pillRadius, pillY)
  ctx.quadraticCurveTo(pillX + pw, pillY, pillX + pw, pillY + pillRadius)
  ctx.lineTo(pillX + pw, pillY + ph - pillRadius)
  ctx.quadraticCurveTo(pillX + pw, pillY + ph, pillX + pw - pillRadius, pillY + ph)
  ctx.lineTo(pillX + pillRadius, pillY + ph)
  ctx.quadraticCurveTo(pillX, pillY + ph, pillX, pillY + ph - pillRadius)
  ctx.lineTo(pillX, pillY + pillRadius)
  ctx.quadraticCurveTo(pillX, pillY, pillX + pillRadius, pillY)
  ctx.closePath()
  ctx.fill()

  // Package name -- bright white
  ctx.shadowColor = neonHsl(comet.hue, comet.saturation, 60, labelAlpha * 0.6)
  ctx.shadowBlur = 10

  ctx.font = '600 18px "Outfit", sans-serif'
  ctx.fillStyle = `rgba(240, 245, 255, ${labelAlpha})`
  const nameX = isRight ? lx + 2 : lx - totalWidth + nameWidth + 8
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(nameText, nameX, ly + 1)

  ctx.shadowBlur = 0

  // Version -- colored by version type
  ctx.font = '400 13px "JetBrains Mono", monospace'
  ctx.fillStyle = neonHsl(vtColor.hue, vtColor.sat, vtColor.light, labelAlpha)
  ctx.fillText(verText, nameX + nameWidth + 8, ly + 1)
}

// ---------------------------------------------------------------------------
// Energy arcs between nearby comets
// ---------------------------------------------------------------------------

function drawEnergyArcs(ctx: CanvasRenderingContext2D, comets: Comet[], time: number) {
  const settled = comets.filter((c) => c.settled && c.opacity > 0.2)
  const globalRot = time * 0.00003

  for (let i = 0; i < settled.length; i++) {
    const a = settled[i]
    if (!a) continue

    for (let j = i + 1; j < settled.length; j++) {
      const b = settled[j]
      if (!b) continue

      if (Math.abs(a.orbitRadius - b.orbitRadius) > 50) continue

      const ax = CX + Math.cos(a.theta + globalRot) * a.r
      const ay = CY + Math.sin(a.theta + globalRot) * a.r
      const bx = CX + Math.cos(b.theta + globalRot) * b.r
      const by = CY + Math.sin(b.theta + globalRot) * b.r

      const dx = ax - bx
      const dy = ay - by
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist > 250 || dist < 20) continue

      const alpha = Math.min(a.opacity, b.opacity) * 0.12 * (1 - dist / 250)
      if (alpha <= 0.003) continue

      const midX = (ax + bx) / 2 + (CX - (ax + bx) / 2) * 0.15
      const midY = (ay + by) / 2 + (CY - (ay + by) / 2) * 0.15

      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.quadraticCurveTo(midX, midY, bx, by)

      const grad = ctx.createLinearGradient(ax, ay, bx, by)
      grad.addColorStop(0, neonHsl(a.hue, a.saturation, 60, alpha))
      grad.addColorStop(1, neonHsl(b.hue, b.saturation, 60, alpha))

      ctx.strokeStyle = grad
      ctx.lineWidth = 0.8
      ctx.stroke()
    }
  }
}

// ---------------------------------------------------------------------------
// Background
// ---------------------------------------------------------------------------

function drawBackground(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#050508'
  ctx.fillRect(0, 0, W, H)

  const vignette = ctx.createRadialGradient(CX, CY, 80, CX, CY, 750)
  vignette.addColorStop(0, 'rgba(10, 12, 25, 0.1)')
  vignette.addColorStop(0.5, 'rgba(5, 5, 12, 0.2)')
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.6)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, W, H)
}

// ---------------------------------------------------------------------------
// Header / Title
// ---------------------------------------------------------------------------

function drawHeader(
  ctx: CanvasRenderingContext2D,
  isLive: boolean,
  time: number,
) {
  ctx.save()

  // Title: "PyPI PULSE"
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  // Glow behind title
  ctx.shadowColor = 'rgba(100, 160, 255, 0.4)'
  ctx.shadowBlur = 20
  ctx.font = '600 32px "Outfit", sans-serif'
  ctx.fillStyle = 'rgba(220, 230, 255, 0.95)'
  ctx.fillText('PyPI', 32, 24)

  const pypiWidth = ctx.measureText('PyPI').width
  ctx.fillStyle = 'rgba(130, 170, 255, 0.85)'
  ctx.fillText('PULSE', 32 + pypiWidth + 10, 24)
  ctx.shadowBlur = 0

  // Subtitle
  ctx.font = '300 14px "Outfit", sans-serif'
  ctx.fillStyle = 'rgba(150, 175, 210, 0.6)'
  ctx.fillText('Live Python Package Releases', 32, 62)

  // Live/Sim indicator
  const pulse = 0.5 + 0.5 * Math.sin(time * 0.004)
  const modeLabel = isLive ? 'LIVE' : 'SIMULATED'
  ctx.font = '400 11px "JetBrains Mono", monospace'

  const labelX = 32
  const labelY = 84
  const dotRadius = 4
  const dotX = labelX + dotRadius
  const dotY = labelY + 6

  if (isLive) {
    // Green pulsing dot
    ctx.beginPath()
    ctx.arc(dotX, dotY, dotRadius + 2, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(80, 255, 140, ${pulse * 0.3})`
    ctx.fill()

    ctx.beginPath()
    ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(80, 255, 140, ${0.6 + pulse * 0.4})`
    ctx.fill()

    ctx.fillStyle = 'rgba(80, 255, 140, 0.8)'
  } else {
    ctx.beginPath()
    ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255, 200, 80, ${0.5 + pulse * 0.5})`
    ctx.fill()

    ctx.fillStyle = 'rgba(255, 200, 80, 0.7)'
  }
  ctx.fillText(modeLabel, dotX + dotRadius + 8, labelY)

  ctx.restore()
}

// ---------------------------------------------------------------------------
// Version type legend
// ---------------------------------------------------------------------------

function drawLegend(ctx: CanvasRenderingContext2D) {
  ctx.save()

  const lx = 32
  const ly = H - 90

  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.font = '300 11px "JetBrains Mono", monospace'
  ctx.fillStyle = 'rgba(140, 160, 190, 0.4)'
  ctx.fillText('RELEASE TYPE', lx, ly)

  const types: Array<'major' | 'minor' | 'patch'> = ['major', 'minor', 'patch']
  const sizes = [8, 5, 3]

  for (let i = 0; i < types.length; i++) {
    const type = types[i]
    const size = sizes[i]
    if (type === undefined || size === undefined) continue
    const vc = VERSION_COLORS[type]
    const rowY = ly + 20 + i * 22

    // Colored dot
    ctx.beginPath()
    ctx.arc(lx + size, rowY, size, 0, Math.PI * 2)
    const dotGrad = ctx.createRadialGradient(lx + size, rowY, 0, lx + size, rowY, size)
    dotGrad.addColorStop(0, neonHsl(vc.hue, vc.sat, vc.light + 15, 0.9))
    dotGrad.addColorStop(1, neonHsl(vc.hue, vc.sat, vc.light - 10, 0.4))
    ctx.fillStyle = dotGrad
    ctx.fill()

    // Label
    ctx.fillStyle = neonHsl(vc.hue, vc.sat, vc.light, 0.8)
    ctx.font = '400 12px "Outfit", sans-serif'
    ctx.fillText(vc.label, lx + 22, rowY + 1)
  }

  ctx.restore()
}

// ---------------------------------------------------------------------------
// Latest release featured panel (bottom-right)
// ---------------------------------------------------------------------------

function drawLatestRelease(
  ctx: CanvasRenderingContext2D,
  latest: Comet | undefined,
  time: number,
) {
  if (!latest) return

  ctx.save()

  const panelW = 320
  const panelH = 110
  const px = W - panelW - 24
  const py = 20
  const cornerR = 10

  // Panel age for entrance animation
  const panelAge = time - latest.birthTime
  const entranceT = Math.min(1, Math.max(0, panelAge / 800))
  const easedT = easeOutExpo(entranceT)

  ctx.globalAlpha = easedT

  // Panel background with subtle border glow
  const vtColor = VERSION_COLORS[latest.versionType]

  // Glow behind panel
  ctx.shadowColor = neonHsl(vtColor.hue, vtColor.sat, vtColor.light, 0.3)
  ctx.shadowBlur = 20

  ctx.fillStyle = 'rgba(8, 10, 20, 0.85)'
  ctx.beginPath()
  ctx.moveTo(px + cornerR, py)
  ctx.lineTo(px + panelW - cornerR, py)
  ctx.quadraticCurveTo(px + panelW, py, px + panelW, py + cornerR)
  ctx.lineTo(px + panelW, py + panelH - cornerR)
  ctx.quadraticCurveTo(px + panelW, py + panelH, px + panelW - cornerR, py + panelH)
  ctx.lineTo(px + cornerR, py + panelH)
  ctx.quadraticCurveTo(px, py + panelH, px, py + panelH - cornerR)
  ctx.lineTo(px, py + cornerR)
  ctx.quadraticCurveTo(px, py, px + cornerR, py)
  ctx.closePath()
  ctx.fill()

  ctx.shadowBlur = 0

  // Thin border
  ctx.strokeStyle = neonHsl(vtColor.hue, vtColor.sat, vtColor.light, 0.25)
  ctx.lineWidth = 1
  ctx.stroke()

  // "LATEST RELEASE" label
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.font = '400 10px "JetBrains Mono", monospace'
  ctx.fillStyle = neonHsl(vtColor.hue, vtColor.sat, vtColor.light, 0.7)
  ctx.fillText('LATEST RELEASE', px + 16, py + 12)

  // Time ago
  const agoText = timeAgo(Math.max(0, time - latest.birthTime))
  ctx.textAlign = 'right'
  ctx.font = '300 10px "JetBrains Mono", monospace'
  ctx.fillStyle = 'rgba(140, 160, 190, 0.5)'
  ctx.fillText(agoText, px + panelW - 16, py + 12)

  // Package name -- large and prominent
  ctx.textAlign = 'left'
  ctx.shadowColor = neonHsl(latest.hue, latest.saturation, 60, 0.5)
  ctx.shadowBlur = 12
  ctx.font = '600 22px "Outfit", sans-serif'
  ctx.fillStyle = 'rgba(240, 245, 255, 0.95)'

  // Truncate name if needed
  let displayName = latest.name
  const maxNameW = panelW - 32
  while (ctx.measureText(displayName).width > maxNameW && displayName.length > 3) {
    displayName = displayName.slice(0, -1)
  }
  if (displayName !== latest.name) displayName += '...'
  ctx.fillText(displayName, px + 16, py + 30)

  ctx.shadowBlur = 0

  // Version badge
  const verText = `v${latest.version}`
  ctx.font = '400 14px "JetBrains Mono", monospace'
  const verW = ctx.measureText(verText).width

  // Badge background
  const badgeX = px + 16
  const badgeY = py + 58
  const badgePadX = 8
  const badgePadY = 3
  const badgeH = 20

  ctx.fillStyle = neonHsl(vtColor.hue, vtColor.sat, vtColor.light, 0.15)
  ctx.beginPath()
  const br = 4
  ctx.moveTo(badgeX + br, badgeY)
  ctx.lineTo(badgeX + verW + badgePadX * 2 - br, badgeY)
  ctx.quadraticCurveTo(badgeX + verW + badgePadX * 2, badgeY, badgeX + verW + badgePadX * 2, badgeY + br)
  ctx.lineTo(badgeX + verW + badgePadX * 2, badgeY + badgeH - br)
  ctx.quadraticCurveTo(badgeX + verW + badgePadX * 2, badgeY + badgeH, badgeX + verW + badgePadX * 2 - br, badgeY + badgeH)
  ctx.lineTo(badgeX + br, badgeY + badgeH)
  ctx.quadraticCurveTo(badgeX, badgeY + badgeH, badgeX, badgeY + badgeH - br)
  ctx.lineTo(badgeX, badgeY + br)
  ctx.quadraticCurveTo(badgeX, badgeY, badgeX + br, badgeY)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = neonHsl(vtColor.hue, vtColor.sat, vtColor.light, 0.9)
  ctx.fillText(verText, badgeX + badgePadX, badgeY + badgePadY)

  // Version type label next to badge
  ctx.font = '300 12px "Outfit", sans-serif'
  ctx.fillStyle = neonHsl(vtColor.hue, vtColor.sat, vtColor.light, 0.5)
  ctx.fillText(vtColor.label.toUpperCase() + ' RELEASE', badgeX + verW + badgePadX * 2 + 10, badgeY + badgePadY + 1)

  // Summary line if available
  if (latest.summary) {
    ctx.font = '300 12px "Outfit", sans-serif'
    ctx.fillStyle = 'rgba(160, 180, 210, 0.55)'

    let summary = latest.summary
    const summaryMaxW = panelW - 32
    while (ctx.measureText(summary).width > summaryMaxW && summary.length > 3) {
      summary = summary.slice(0, -1)
    }
    if (summary !== latest.summary) summary += '...'
    ctx.fillText(summary, px + 16, py + 86)
  }

  ctx.globalAlpha = 1
  ctx.restore()
}

// ---------------------------------------------------------------------------
// Release rate / stats panel (bottom-right)
// ---------------------------------------------------------------------------

function drawStatsPanel(
  ctx: CanvasRenderingContext2D,
  stats: Stats,
  cometCount: number,
) {
  ctx.save()

  const panelW = 240
  const panelH = 80
  const px = W - panelW - 24
  const py = H - panelH - 20

  // Subtle panel background
  ctx.fillStyle = 'rgba(8, 10, 20, 0.7)'
  const cr = 8
  ctx.beginPath()
  ctx.moveTo(px + cr, py)
  ctx.lineTo(px + panelW - cr, py)
  ctx.quadraticCurveTo(px + panelW, py, px + panelW, py + cr)
  ctx.lineTo(px + panelW, py + panelH - cr)
  ctx.quadraticCurveTo(px + panelW, py + panelH, px + panelW - cr, py + panelH)
  ctx.lineTo(px + cr, py + panelH)
  ctx.quadraticCurveTo(px, py + panelH, px, py + panelH - cr)
  ctx.lineTo(px, py + cr)
  ctx.quadraticCurveTo(px, py, px + cr, py)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = 'rgba(80, 110, 170, 0.15)'
  ctx.lineWidth = 1
  ctx.stroke()

  // Rate display
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  ctx.font = '400 10px "JetBrains Mono", monospace'
  ctx.fillStyle = 'rgba(140, 160, 190, 0.5)'
  ctx.fillText('RELEASE RATE', px + 16, py + 10)

  // Big number
  ctx.font = '600 28px "Outfit", sans-serif'
  const rate = stats.packagesPerMinute
  const rateColor = rate > 5
    ? 'rgba(100, 255, 180, 0.9)'
    : rate > 2
      ? 'rgba(100, 200, 255, 0.9)'
      : 'rgba(180, 195, 220, 0.8)'
  ctx.fillStyle = rateColor
  ctx.fillText(rate.toFixed(1), px + 16, py + 26)

  const rateWidth = ctx.measureText(rate.toFixed(1)).width
  ctx.font = '300 14px "Outfit", sans-serif'
  ctx.fillStyle = 'rgba(140, 160, 190, 0.5)'
  ctx.fillText('/min', px + 16 + rateWidth + 4, py + 36)

  // Sparkline from rate history
  const history = stats.rateHistory
  if (history.length > 1) {
    const sparkX = px + 130
    const sparkY = py + 16
    const sparkW = 90
    const sparkH = 35

    const maxVal = Math.max(1, ...history)

    ctx.beginPath()
    for (let i = 0; i < history.length; i++) {
      const val = history[i]
      if (val === undefined) continue
      const sx = sparkX + (i / (history.length - 1)) * sparkW
      const sy = sparkY + sparkH - (val / maxVal) * sparkH

      if (i === 0) {
        ctx.moveTo(sx, sy)
      } else {
        ctx.lineTo(sx, sy)
      }
    }
    ctx.strokeStyle = 'rgba(100, 180, 255, 0.5)'
    ctx.lineWidth = 1.5
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.stroke()

    // Fill under sparkline
    const lastIdx = history.length - 1
    const lastVal = history[lastIdx]
    if (lastVal !== undefined) {
      const lastSx = sparkX + (lastIdx / (history.length - 1)) * sparkW
      const lastSy = sparkY + sparkH - (lastVal / maxVal) * sparkH
      ctx.lineTo(lastSx, sparkY + sparkH)
      ctx.lineTo(sparkX, sparkY + sparkH)
      ctx.closePath()

      const fillGrad = ctx.createLinearGradient(sparkX, sparkY, sparkX, sparkY + sparkH)
      fillGrad.addColorStop(0, 'rgba(100, 180, 255, 0.15)')
      fillGrad.addColorStop(1, 'rgba(100, 180, 255, 0.02)')
      ctx.fillStyle = fillGrad
      ctx.fill()

      // Dot at the end
      ctx.beginPath()
      ctx.arc(lastSx, lastSy, 3, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(100, 200, 255, 0.9)'
      ctx.fill()
    }
  }

  // Stats row
  ctx.font = '300 11px "JetBrains Mono", monospace'
  ctx.fillStyle = 'rgba(120, 145, 180, 0.4)'
  ctx.fillText(`${cometCount} orbiting  |  ${stats.totalSeen} total`, px + 16, py + 60)

  ctx.restore()
}

// ---------------------------------------------------------------------------
// Arrival flash effect for the newest comet
// ---------------------------------------------------------------------------

function drawArrivalFlash(
  ctx: CanvasRenderingContext2D,
  comet: Comet,
  time: number,
) {
  const age = time - comet.birthTime
  if (age < 0 || age > 3000) return

  const head = comet.trail[0]
  if (!head) return

  // Bright radial flash that fades out
  const flashProgress = age / 3000
  const flashAlpha = (1 - flashProgress) * 0.6
  const flashRadius = 30 + easeOutExpo(flashProgress) * 80

  const vtColor = VERSION_COLORS[comet.versionType]

  const flash = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, flashRadius)
  flash.addColorStop(0, neonHsl(vtColor.hue, vtColor.sat, 90, flashAlpha))
  flash.addColorStop(0.2, neonHsl(vtColor.hue, vtColor.sat, vtColor.light, flashAlpha * 0.5))
  flash.addColorStop(1, 'rgba(0,0,0,0)')

  ctx.beginPath()
  ctx.arc(head.x, head.y, flashRadius, 0, Math.PI * 2)
  ctx.fillStyle = flash
  ctx.fill()

  // Announcement text for very new arrivals (first 4 seconds)
  if (age < 4000 && age > 300) {
    const textProgress = age < 600
      ? (age - 300) / 300
      : age > 3000
        ? Math.max(0, 1 - (age - 3000) / 1000)
        : 1
    const textAlpha = textProgress * 0.95

    if (textAlpha > 0.05) {
      ctx.save()

      // Position: above the comet, clamped to viewport
      const rawTextY = head.y - comet.coreRadius - 35
      const rawTextX = head.x

      // Clamp so text stays visible
      const textX = Math.max(120, Math.min(W - 120, rawTextX))
      const textY = Math.max(50, Math.min(H - 30, rawTextY))

      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'

      // Package name -- large and bright
      ctx.shadowColor = neonHsl(vtColor.hue, vtColor.sat, vtColor.light, textAlpha * 0.8)
      ctx.shadowBlur = 18

      ctx.font = '600 22px "Outfit", sans-serif'
      ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha})`
      ctx.fillText(comet.name, textX, textY)

      ctx.shadowBlur = 0

      // Version -- colored by type
      ctx.font = '400 16px "JetBrains Mono", monospace'
      ctx.fillStyle = neonHsl(vtColor.hue, vtColor.sat, vtColor.light, textAlpha)
      ctx.fillText(`v${comet.version}`, textX, textY + 20)

      ctx.restore()
    }
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PypiPulse() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cometsRef = useRef<Comet[]>([])
  const shockwavesRef = useRef<Shockwave[]>([])
  const statsRef = useRef<Stats>({
    packagesPerMinute: 0,
    lastReleaseTime: 0,
    totalSeen: 0,
    recentTimestamps: [],
    rateHistory: [],
  })
  const seenIdsRef = useRef<Set<string>>(new Set())
  const animFrameRef = useRef<number>(0)
  const starsRef = useRef<Star[]>(createStars())
  const nebulaeRef = useRef<NebulaBlob[]>(createNebulae())
  const isLiveRef = useRef<boolean>(false)
  const simCounterRef = useRef<number>(0)
  const orbitIndexRef = useRef<number>(0)
  const metadataRef = useRef<Map<string, PackageMeta>>(new Map())
  const rateHistoryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const addPackage = useCallback((item: RssItem) => {
    const id = `${item.name}@${item.version}`
    if (seenIdsRef.current.has(id)) return
    seenIdsRef.current.add(id)

    const versionType = parseVersionType(item.version)
    const coreRadius = versionCoreRadius(versionType)
    const hue = versionTypeHue(versionType)
    const saturation = versionTypeSat(versionType)

    const bandIndex = orbitIndexRef.current % ORBIT_BANDS.length
    const band = ORBIT_BANDS[bandIndex]
    orbitIndexRef.current++
    if (band === undefined) return
    const orbitRadius = band + (Math.random() - 0.5) * 30

    const launchAngle = Math.random() * Math.PI * 2

    const baseAngularVel = 0.0003
    const angularVel = baseAngularVel * (200 / orbitRadius) * (0.8 + Math.random() * 0.4)
    const direction = Math.random() > 0.5 ? 1 : -1

    const comet: Comet = {
      id,
      name: item.name,
      version: item.version,
      hue,
      saturation,
      versionType,
      birthTime: performance.now(),
      launchAngle,
      orbitRadius,
      r: 0,
      theta: launchAngle,
      angularVel: angularVel * direction,
      coreRadius,
      opacity: 0,
      temperature: 1,
      settled: false,
      trail: [],
      summary: '',
    }

    cometsRef.current.push(comet)

    shockwavesRef.current.push({
      birthTime: performance.now(),
      cx: CX,
      cy: CY,
      hue,
      maxRadius: orbitRadius + 40,
    })

    const stats = statsRef.current
    stats.lastReleaseTime = Date.now()
    stats.totalSeen++
    stats.recentTimestamps.push(Date.now())

    const cutoff = Date.now() - 60000
    stats.recentTimestamps = stats.recentTimestamps.filter((t) => t > cutoff)
    stats.packagesPerMinute = stats.recentTimestamps.length

    while (cometsRef.current.length > MAX_COMETS) {
      cometsRef.current.shift()
    }

    void fetchMetadata(item.name, item.version, comet, metadataRef.current)
  }, [])

  const generateSimulatedPackage = useCallback(() => {
    const idx = simCounterRef.current % SIM_PACKAGES.length
    const name = SIM_PACKAGES[idx]
    simCounterRef.current++
    if (!name) return

    const roll = Math.random()
    let version: string

    if (roll < 0.10) {
      const major = 1 + Math.floor(Math.random() * 4)
      version = `${major}.0.0`
    } else if (roll < 0.35) {
      const major = Math.floor(Math.random() * 5)
      const minor = 1 + Math.floor(Math.random() * 15)
      version = `${major}.${minor}.0`
    } else {
      const major = Math.floor(Math.random() * 5)
      const minor = Math.floor(Math.random() * 20)
      const patch = 1 + Math.floor(Math.random() * 30)
      version = `${major}.${minor}.${patch}`
    }

    // Assign a simulated summary
    const simIdx = simCounterRef.current % SIM_SUMMARIES.length
    const summary = SIM_SUMMARIES[simIdx] ?? ''

    addPackage({
      name,
      version,
      link: `https://pypi.org/project/${name}/${version}/`,
      pubDate: Date.now(),
    })

    // Attach summary to the most recently added comet
    const lastComet = cometsRef.current[cometsRef.current.length - 1]
    if (lastComet && lastComet.name === name) {
      lastComet.summary = summary
    }
  }, [addPackage])

  const fetchRss = useCallback(async (): Promise<boolean> => {
    try {
      const resp = await fetch(RSS_PATH)
      if (!resp.ok) return false
      const xml = await resp.text()
      const items = parseRssFeed(xml)
      if (items.length === 0) return false

      const reversed = [...items].reverse()
      for (const item of reversed) {
        addPackage(item)
      }
      return true
    } catch {
      return false
    }
  }, [addPackage])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width = W * DPR
    canvas.height = H * DPR
    canvas.style.width = `${W}px`
    canvas.style.height = `${H}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.scale(DPR, DPR)

    let simulateId: ReturnType<typeof setInterval> | null = null
    let pollId: ReturnType<typeof setInterval> | null = null

    // Record rate history every 5 seconds
    rateHistoryIntervalRef.current = setInterval(() => {
      const stats = statsRef.current
      const cutoff = Date.now() - 60000
      stats.recentTimestamps = stats.recentTimestamps.filter((t) => t > cutoff)
      stats.packagesPerMinute = stats.recentTimestamps.length
      stats.rateHistory.push(stats.packagesPerMinute)
      if (stats.rateHistory.length > 30) {
        stats.rateHistory.shift()
      }
    }, 5000)

    const initData = async () => {
      const proxyWorked = await fetchRss()

      if (proxyWorked) {
        isLiveRef.current = true
        pollId = setInterval(() => {
          void fetchRss()
        }, POLL_INTERVAL_MS)
        return
      }

      try {
        const resp = await fetch('https://pypi.org/rss/updates.xml')
        if (resp.ok) {
          const xml = await resp.text()
          const items = parseRssFeed(xml)
          if (items.length > 0) {
            isLiveRef.current = true
            const reversed = [...items].reverse()
            for (const item of reversed) {
              addPackage(item)
            }
            pollId = setInterval(async () => {
              try {
                const r = await fetch('https://pypi.org/rss/updates.xml')
                if (!r.ok) return
                const x = await r.text()
                const parsed = parseRssFeed(x)
                for (const item of [...parsed].reverse()) {
                  addPackage(item)
                }
              } catch {
                // Silently continue
              }
            }, POLL_INTERVAL_MS)
            return
          }
        }
      } catch {
        // CORS blocked
      }

      // Simulation fallback
      isLiveRef.current = false
      for (let i = 0; i < 15; i++) {
        setTimeout(() => generateSimulatedPackage(), i * 300)
      }
      simulateId = setInterval(() => {
        generateSimulatedPackage()
      }, 2000 + Math.random() * 2500)
    }

    void initData()

    function animate(time: number) {
      if (!ctx) return

      drawBackground(ctx)
      drawNebulae(ctx, nebulaeRef.current, time)
      drawStars(ctx, starsRef.current, time)

      const recentCount = cometsRef.current.filter(
        (c) => time - c.birthTime < 5000,
      ).length
      drawNexus(ctx, time, recentCount)

      drawShockwaves(ctx, shockwavesRef.current, time)

      for (const comet of cometsRef.current) {
        updateComet(comet, time)
      }

      cometsRef.current = cometsRef.current.filter(
        (c) => time - c.birthTime < MAX_LIFETIME_MS,
      )

      drawEnergyArcs(ctx, cometsRef.current, time)

      const sorted = [...cometsRef.current].sort(
        (a, b) => a.birthTime - b.birthTime,
      )
      for (const comet of sorted) {
        drawComet(ctx, comet)
      }

      // Determine which comets get labels -- only the 6 most recent
      const recentForLabels = [...cometsRef.current]
        .sort((a, b) => b.birthTime - a.birthTime)
        .slice(0, 6)
      const labelSet = new Set(recentForLabels.map((c) => c.id))

      for (const comet of sorted) {
        drawCometLabel(ctx, comet, time, labelSet.has(comet.id))
      }

      // Draw arrival flash for the most recent comet(s)
      const newest = cometsRef.current
        .filter((c) => time - c.birthTime < 4000)
        .sort((a, b) => b.birthTime - a.birthTime)
      for (const comet of newest.slice(0, 3)) {
        drawArrivalFlash(ctx, comet, time)
      }

      // HUD overlays
      drawHeader(ctx, isLiveRef.current, time)
      drawLegend(ctx)

      // Latest release panel
      const latestComet = cometsRef.current.length > 0
        ? cometsRef.current.reduce((a, b) => a.birthTime > b.birthTime ? a : b)
        : undefined
      drawLatestRelease(ctx, latestComet, time)

      drawStatsPanel(ctx, statsRef.current, cometsRef.current.length)

      animFrameRef.current = requestAnimationFrame(animate)
    }

    animFrameRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      if (pollId) clearInterval(pollId)
      if (simulateId) clearInterval(simulateId)
      if (rateHistoryIntervalRef.current) clearInterval(rateHistoryIntervalRef.current)
    }
  }, [fetchRss, generateSimulatedPackage, addPackage])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0"
    />
  )
}

// ---------------------------------------------------------------------------
// Metadata enrichment (best-effort, non-blocking)
// ---------------------------------------------------------------------------

async function fetchMetadata(
  name: string,
  version: string,
  comet: Comet,
  cache: Map<string, PackageMeta>,
): Promise<void> {
  const cacheKey = `${name}@${version}`
  const cached = cache.get(cacheKey)
  if (cached) {
    comet.summary = cached.summary
    return
  }

  try {
    const resp = await fetch(`${PYPI_JSON_PATH}/${encodeURIComponent(name)}/${encodeURIComponent(version)}/json`)
    if (!resp.ok) return

    const data: unknown = await resp.json()
    if (!data || typeof data !== 'object') return

    const info = safeRecordGet(data, 'info')
    if (!info || typeof info !== 'object') return

    const summary = safeRecordGet(info, 'summary')
    if (typeof summary === 'string' && summary.length > 0) {
      comet.summary = summary
      cache.set(cacheKey, { summary })
    }
  } catch {
    // Enrichment is best-effort
  }
}
