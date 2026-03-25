import type {
  SpaceWeatherData,
  LightningFlash,
  SolarWindParticle,
  Star,
  AuroraCoordinate,
} from './types'
import {
  projectLatLon,
  projectLatLonElevated,
} from './projection'
import type { ProjectionParams } from './projection'
import { CONTINENT_PATHS } from './continents'

const WIDTH = 1280
const HEIGHT = 720
const GLOBE_RADIUS = 320
const GLOBE_CX = WIDTH / 2
const GLOBE_CY = HEIGHT / 2 - 10
const ROTATION_SPEED = 0.0004

// Pre-computed constants
const TWO_PI = Math.PI * 2

// Zoom cycle: start normal -> zoom out to show solar wind -> zoom back in
// Phase 1 (0-8s): hold at normal radius
// Phase 2 (8-20s): ease out to small radius (wide view showing solar wind)
// Phase 3 (20-35s): hold at wide view
// Phase 4 (35-47s): ease back in to normal radius
// Then repeat
const ZOOM_NORMAL_RADIUS = GLOBE_RADIUS     // 320 -- fills the view
const ZOOM_WIDE_RADIUS = 180                // zoomed out -- Earth smaller, solar wind visible
const ZOOM_CYCLE_MS = 50000                 // full cycle duration

function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

// --- Sprite cache helpers ---

function createGlowSprite(
  size: number,
  stops: Array<[number, string]>,
): OffscreenCanvas {
  const dim = Math.ceil(size * 2)
  const oc = new OffscreenCanvas(dim, dim)
  const octx = oc.getContext('2d')
  if (!octx) return oc
  const grad = octx.createRadialGradient(size, size, 0, size, size, size)
  for (const [offset, color] of stops) {
    grad.addColorStop(offset, color)
  }
  octx.fillStyle = grad
  octx.fillRect(0, 0, dim, dim)
  return oc
}

// Aurora size buckets for sprite caching
const AURORA_SIZE_BUCKETS = [10, 16, 24]

function getAuroraSizeBucket(glowSize: number): number {
  for (let i = 0; i < AURORA_SIZE_BUCKETS.length; i++) {
    const bucket = AURORA_SIZE_BUCKETS[i]
    if (bucket !== undefined && glowSize <= bucket) return i
  }
  return AURORA_SIZE_BUCKETS.length - 1
}

function quantizeColor(c: number, step: number): number {
  return Math.round(c / step) * step
}

function auroraKeyStr(r: number, g: number, b: number, sizeIdx: number): string {
  return `${r},${g},${b},${sizeIdx}`
}

// --- Star generation ---

function generateStars(count: number): Array<Star> {
  const stars: Array<Star> = []
  for (let i = 0; i < count; i++) {
    const isFeatureStar = i < 12 // First 12 are bright feature stars
    stars.push({
      x: Math.random() * WIDTH,
      y: Math.random() * HEIGHT,
      brightness: isFeatureStar
        ? 0.8 + Math.random() * 0.2
        : 0.2 + Math.random() * 0.7,
      twinklePhase: Math.random() * TWO_PI,
      twinkleSpeed: 0.3 + Math.random() * 2.5,
      size: isFeatureStar
        ? 2.0 + Math.random() * 2.0
        : 0.5 + Math.random() * 2.0,
    })
  }
  return stars
}

// --- Fallback aurora ---

function generateFallbackAurora(): Array<AuroraCoordinate> {
  const coords: Array<AuroraCoordinate> = []
  // Northern auroral oval: ~60-76 lat
  for (let lon = -180; lon <= 180; lon += 2) {
    for (let lat = 60; lat <= 76; lat += 1.5) {
      const distFromPeak = Math.abs(lat - 68)
      const probability = Math.max(0, 65 - distFromPeak * 7)
      if (probability > 0) {
        coords.push([lon, lat, probability])
      }
    }
  }
  // Southern auroral oval: ~-76 to -60 lat
  for (let lon = -180; lon <= 180; lon += 2) {
    for (let lat = -76; lat <= -60; lat += 1.5) {
      const distFromPeak = Math.abs(lat + 68)
      const probability = Math.max(0, 65 - distFromPeak * 7)
      if (probability > 0) {
        coords.push([lon, lat, probability])
      }
    }
  }
  return coords
}

function downsampleAurora(
  coords: Array<AuroraCoordinate>,
  step: number,
): Array<AuroraCoordinate> {
  const result: Array<AuroraCoordinate> = []
  for (let i = 0; i < coords.length; i += step) {
    const coord = coords[i]
    if (coord && coord[2] > 2) {
      result.push(coord)
    }
  }
  return result
}

function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get 2D context')
  return ctx
}

// --- Impact flash type (solar wind particle hitting atmosphere) ---
interface ImpactFlash {
  x: number
  y: number
  startTime: number
  duration: number
}

export function createRenderer(canvas: HTMLCanvasElement): {
  render: (data: SpaceWeatherData, time: number) => void
  destroy: () => void
  getLightningCount: () => number
} {
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = getContext(canvas)

  const stars = generateStars(500)
  let lightningFlashes: Array<LightningFlash> = []
  let solarParticles: Array<SolarWindParticle> = []
  let impactFlashes: Array<ImpactFlash> = []
  let lastTime = 0
  let startTime = -1

  const fallbackAurora = generateFallbackAurora()
  // More aggressive downsampling for fallback -- step 3 instead of 1
  const fallbackAuroraDownsampled = downsampleAurora(fallbackAurora, 3)

  let cachedAuroraSource: Array<AuroraCoordinate> = []
  let cachedAuroraDownsampled: Array<AuroraCoordinate> = []

  // FPS counter state
  let frameCount = 0
  let lastFpsTime = 0
  let currentFps = 0

  // --- Pre-rendered sprite caches ---

  // Feature star glow sprites (one per unique size bucket)
  const featureStarSprites = new Map<number, OffscreenCanvas>()

  function getFeatureStarSprite(size: number): OffscreenCanvas {
    const bucketKey = Math.round(size * 2)
    let sprite = featureStarSprites.get(bucketKey)
    if (sprite) return sprite
    const glowRadius = size * 3
    sprite = createGlowSprite(glowRadius, [
      [0, 'rgba(200, 220, 255, 0.4)'],
      [0.5, 'rgba(150, 180, 255, 0.1)'],
      [1, 'rgba(0, 0, 0, 0)'],
    ])
    featureStarSprites.set(bucketKey, sprite)
    return sprite
  }

  // Aurora glow sprites cache
  const auroraBaseSprites = new Map<string, OffscreenCanvas>()

  function getAuroraBaseSprite(r: number, g: number, b: number, sizeIdx: number): OffscreenCanvas {
    const qr = quantizeColor(r, 32)
    const qg = quantizeColor(g, 32)
    const qb = quantizeColor(b, 32)
    const key = auroraKeyStr(qr, qg, qb, sizeIdx)
    let sprite = auroraBaseSprites.get(key)
    if (sprite) return sprite
    const bucketSize = AURORA_SIZE_BUCKETS[sizeIdx] ?? 24
    sprite = createGlowSprite(bucketSize, [
      [0, `rgba(${qr}, ${qg}, ${qb}, 0.6)`],
      [0.3, `rgba(${qr}, ${qg}, ${qb}, 0.3)`],
      [0.6, `rgba(${qr}, ${qg}, ${qb}, 0.1)`],
      [1, 'rgba(0, 0, 0, 0)'],
    ])
    auroraBaseSprites.set(key, sprite)
    return sprite
  }

  // Aurora curtain sprites cache
  const auroraCurtainSprites = new Map<string, OffscreenCanvas>()

  function getAuroraCurtainSprite(r: number, g: number, b: number): OffscreenCanvas {
    const qr = quantizeColor(r, 32)
    const qg = quantizeColor(g, 32)
    const qb = quantizeColor(b, 32)
    const key = `${qr},${qg},${qb}`
    let sprite = auroraCurtainSprites.get(key)
    if (sprite) return sprite
    const curtainW = 12
    sprite = createGlowSprite(curtainW, [
      [0, `rgba(${qr}, ${qg}, ${qb}, 0.5)`],
      [0.3, `rgba(${qr}, ${qg}, ${qb}, 0.25)`],
      [0.6, `rgba(${qr}, ${qg}, ${qb}, 0.08)`],
      [1, 'rgba(0, 0, 0, 0)'],
    ])
    auroraCurtainSprites.set(key, sprite)
    return sprite
  }

  // Aurora high curtain sprites cache
  const auroraHighSprites = new Map<string, OffscreenCanvas>()

  function getAuroraHighSprite(r: number, g: number, b: number): OffscreenCanvas {
    const qr = quantizeColor(r, 32)
    const qg = quantizeColor(g, 32)
    const qb = quantizeColor(b, 32)
    const key = `h${qr},${qg},${qb}`
    let sprite = auroraHighSprites.get(key)
    if (sprite) return sprite
    const sz = 22
    sprite = createGlowSprite(sz, [
      [0, `rgba(${qr}, ${qg}, ${qb}, 0.35)`],
      [0.5, `rgba(${qr}, ${qg}, ${qb}, 0.12)`],
      [1, 'rgba(0, 0, 0, 0)'],
    ])
    auroraHighSprites.set(key, sprite)
    return sprite
  }

  // Aurora top layer sprite (single purple color)
  const auroraTopSprite = createGlowSprite(15, [
    [0, 'rgba(160, 80, 255, 0.2)'],
    [1, 'rgba(0, 0, 0, 0)'],
  ])

  // Particle head glow sprite
  const particleHeadSprite = createGlowSprite(18, [
    [0, 'rgba(255, 230, 120, 0.95)'],
    [0.25, 'rgba(255, 190, 70, 0.55)'],
    [0.55, 'rgba(255, 140, 30, 0.18)'],
    [1, 'rgba(255, 100, 0, 0)'],
  ])

  // Impact flash sprite
  const impactFlashSprite = createGlowSprite(35, [
    [0, 'rgba(255, 200, 100, 0.6)'],
    [0.4, 'rgba(255, 150, 60, 0.25)'],
    [1, 'rgba(0, 0, 0, 0)'],
  ])

  // Lightning core sprite
  const lightningCoreSprite = createGlowSprite(12, [
    [0, 'rgba(255, 255, 255, 1.0)'],
    [0.3, 'rgba(240, 250, 255, 0.67)'],
    [0.6, 'rgba(200, 230, 255, 0.33)'],
    [1, 'rgba(0, 0, 0, 0)'],
  ])

  // Lightning halo sprite
  const lightningHaloSprite = createGlowSprite(40, [
    [0, 'rgba(180, 220, 255, 0.4)'],
    [0.3, 'rgba(120, 180, 255, 0.2)'],
    [0.6, 'rgba(60, 120, 220, 0.08)'],
    [1, 'rgba(0, 0, 0, 0)'],
  ])

  // Cached background gradient (never changes)
  const bgCanvas = new OffscreenCanvas(WIDTH, HEIGHT)
  const bgCtx = bgCanvas.getContext('2d')
  if (bgCtx) {
    const bgGrad = bgCtx.createRadialGradient(
      GLOBE_CX, GLOBE_CY, 0,
      GLOBE_CX, GLOBE_CY, WIDTH * 0.8,
    )
    bgGrad.addColorStop(0, '#030810')
    bgGrad.addColorStop(0.5, '#020508')
    bgGrad.addColorStop(1, '#000000')
    bgCtx.fillStyle = bgGrad
    bgCtx.fillRect(0, 0, WIDTH, HEIGHT)
  }

  function getZoomRadius(time: number): number {
    if (startTime < 0) return ZOOM_NORMAL_RADIUS
    const elapsed = time - startTime
    const cycleTime = elapsed % ZOOM_CYCLE_MS

    // Phase 1 (0-8s): hold at normal
    if (cycleTime < 8000) return ZOOM_NORMAL_RADIUS
    // Phase 2 (8-20s): ease out to wide
    if (cycleTime < 20000) {
      const t = easeInOutCubic((cycleTime - 8000) / 12000)
      return lerp(ZOOM_NORMAL_RADIUS, ZOOM_WIDE_RADIUS, t)
    }
    // Phase 3 (20-35s): hold at wide
    if (cycleTime < 35000) return ZOOM_WIDE_RADIUS
    // Phase 4 (35-47s): ease back in to normal
    if (cycleTime < 47000) {
      const t = easeInOutCubic((cycleTime - 35000) / 12000)
      return lerp(ZOOM_WIDE_RADIUS, ZOOM_NORMAL_RADIUS, t)
    }
    // Phase 5 (47-50s): hold at normal before next cycle
    return ZOOM_NORMAL_RADIUS
  }

  function getProjectionParams(time: number): ProjectionParams {
    const effectiveRadius = getZoomRadius(time)
    return {
      cx: GLOBE_CX,
      cy: GLOBE_CY,
      radius: effectiveRadius,
      rotation: time * ROTATION_SPEED,
    }
  }

  // =================== STARS ===================
  function drawStars(time: number, effectiveRadius: number) {
    const exclusionR = effectiveRadius + 50
    const globeExclusionR2 = exclusionR * exclusionR

    for (const star of stars) {
      const dx = star.x - GLOBE_CX
      const dy = star.y - GLOBE_CY
      if (dx * dx + dy * dy < globeExclusionR2) continue

      const shouldTwinkle = star.twinkleSpeed > 1.8
      const twinkle = shouldTwinkle
        ? 0.3 + 0.7 * Math.sin(time * 0.001 * star.twinkleSpeed + star.twinklePhase)
        : 0.7 + 0.3 * Math.sin(time * 0.0003 * star.twinkleSpeed + star.twinklePhase)
      const alpha = star.brightness * twinkle

      if (alpha < 0.02) continue

      ctx.globalAlpha = alpha

      // Feature stars get a pre-rendered glow sprite instead of per-frame gradient
      if (star.size > 2.5) {
        const sprite = getFeatureStarSprite(star.size)
        const glowRadius = star.size * 3
        ctx.drawImage(
          sprite,
          star.x - glowRadius,
          star.y - glowRadius,
          glowRadius * 2,
          glowRadius * 2,
        )
      }

      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(star.x, star.y, star.size, 0, TWO_PI)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  // =================== ATMOSPHERE GLOW (behind globe, unclipped) ===================
  function drawAtmosphereGlow(params: ProjectionParams) {
    ctx.globalCompositeOperation = 'screen'

    const sunAngle = params.rotation + Math.PI
    const daySideOffsetX = Math.cos(sunAngle) * params.radius * 0.15

    // Layer 1: outermost faint haze
    const outerHaze = ctx.createRadialGradient(
      params.cx + daySideOffsetX * 0.5, params.cy, params.radius * 0.7,
      params.cx, params.cy, params.radius * 1.35,
    )
    outerHaze.addColorStop(0, 'rgba(0, 0, 0, 0)')
    outerHaze.addColorStop(0.5, 'rgba(15, 40, 80, 0.04)')
    outerHaze.addColorStop(0.75, 'rgba(25, 60, 120, 0.06)')
    outerHaze.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = outerHaze
    ctx.beginPath()
    ctx.arc(params.cx, params.cy, params.radius * 1.35, 0, TWO_PI)
    ctx.fill()

    // Layer 2: mid glow
    const midGlow = ctx.createRadialGradient(
      params.cx + daySideOffsetX * 0.3, params.cy, params.radius * 0.85,
      params.cx, params.cy, params.radius * 1.18,
    )
    midGlow.addColorStop(0, 'rgba(0, 0, 0, 0)')
    midGlow.addColorStop(0.3, 'rgba(30, 70, 140, 0.06)')
    midGlow.addColorStop(0.7, 'rgba(40, 90, 170, 0.10)')
    midGlow.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = midGlow
    ctx.beginPath()
    ctx.arc(params.cx, params.cy, params.radius * 1.18, 0, TWO_PI)
    ctx.fill()

    // Layer 3: inner bright edge
    const innerEdge = ctx.createRadialGradient(
      params.cx + daySideOffsetX * 0.6, params.cy, params.radius * 0.94,
      params.cx, params.cy, params.radius * 1.06,
    )
    innerEdge.addColorStop(0, 'rgba(0, 0, 0, 0)')
    innerEdge.addColorStop(0.3, 'rgba(60, 130, 220, 0.10)')
    innerEdge.addColorStop(0.7, 'rgba(80, 160, 240, 0.14)')
    innerEdge.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = innerEdge
    ctx.beginPath()
    ctx.arc(params.cx, params.cy, params.radius * 1.06, 0, TWO_PI)
    ctx.fill()

    ctx.globalCompositeOperation = 'source-over'
  }

  // =================== GLOBE SURFACE (drawn inside globe clip) ===================
  function drawGlobeSurface(params: ProjectionParams) {
    const surfaceGradient = ctx.createRadialGradient(
      params.cx - params.radius * 0.35, params.cy - params.radius * 0.35,
      0,
      params.cx, params.cy, params.radius,
    )
    surfaceGradient.addColorStop(0, '#122a45')
    surfaceGradient.addColorStop(0.4, '#0c1e35')
    surfaceGradient.addColorStop(0.75, '#071428')
    surfaceGradient.addColorStop(1, '#030a14')
    ctx.fillStyle = surfaceGradient
    ctx.beginPath()
    ctx.arc(params.cx, params.cy, params.radius, 0, TWO_PI)
    ctx.fill()

    // Specular highlight
    ctx.globalCompositeOperation = 'screen'
    const specX = params.cx - params.radius * 0.28
    const specY = params.cy - params.radius * 0.28
    const specGrad = ctx.createRadialGradient(
      specX, specY, 0,
      specX, specY, params.radius * 0.5,
    )
    specGrad.addColorStop(0, 'rgba(120, 160, 220, 0.12)')
    specGrad.addColorStop(0.3, 'rgba(80, 120, 180, 0.06)')
    specGrad.addColorStop(0.7, 'rgba(40, 70, 120, 0.02)')
    specGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = specGrad
    ctx.fillRect(
      params.cx - params.radius,
      params.cy - params.radius,
      params.radius * 2,
      params.radius * 2,
    )
    ctx.globalCompositeOperation = 'source-over'

    // Limb darkening
    const limbDark = ctx.createRadialGradient(
      params.cx, params.cy, params.radius * 0.5,
      params.cx, params.cy, params.radius,
    )
    limbDark.addColorStop(0, 'rgba(0, 0, 0, 0)')
    limbDark.addColorStop(0.6, 'rgba(0, 0, 0, 0)')
    limbDark.addColorStop(0.85, 'rgba(0, 0, 0, 0.15)')
    limbDark.addColorStop(1, 'rgba(0, 0, 0, 0.45)')
    ctx.fillStyle = limbDark
    ctx.fillRect(
      params.cx - params.radius,
      params.cy - params.radius,
      params.radius * 2,
      params.radius * 2,
    )
  }

  // =================== DAY/NIGHT TERMINATOR ===================
  function drawDayNightTerminator(params: ProjectionParams) {
    const sunAngle = params.rotation + Math.PI
    const gradX = params.cx + Math.cos(sunAngle) * params.radius * 0.55
    const dayGradient = ctx.createRadialGradient(
      gradX, params.cy, 0,
      params.cx, params.cy, params.radius,
    )
    dayGradient.addColorStop(0, 'rgba(30, 55, 110, 0.25)')
    dayGradient.addColorStop(0.5, 'rgba(15, 30, 60, 0.12)')
    dayGradient.addColorStop(0.8, 'rgba(5, 12, 25, 0.04)')
    dayGradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = dayGradient
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
  }

  // =================== CONTINENTS ===================
  function drawContinents(params: ProjectionParams) {
    ctx.strokeStyle = 'rgba(60, 140, 170, 0.35)'
    ctx.lineWidth = 0.8
    for (const path of CONTINENT_PATHS) {
      if (path.length < 2) continue
      ctx.beginPath()
      let started = false
      for (const coord of path) {
        const projected = projectLatLon(coord[1], coord[0], params)
        if (!projected.visible) {
          started = false
          continue
        }
        if (!started) {
          ctx.moveTo(projected.x, projected.y)
          started = true
        } else {
          ctx.lineTo(projected.x, projected.y)
        }
      }
      ctx.stroke()
    }
  }

  // =================== GRATICULE ===================
  function drawGraticule(params: ProjectionParams) {
    ctx.strokeStyle = 'rgba(30, 70, 110, 0.12)'
    ctx.lineWidth = 0.5

    for (let lat = -60; lat <= 60; lat += 30) {
      ctx.beginPath()
      let started = false
      for (let lon = -180; lon <= 180; lon += 5) {
        const p = projectLatLon(lat, lon, params)
        if (!p.visible) {
          started = false
          continue
        }
        if (!started) {
          ctx.moveTo(p.x, p.y)
          started = true
        } else {
          ctx.lineTo(p.x, p.y)
        }
      }
      ctx.stroke()
    }

    for (let lon = -180; lon < 180; lon += 30) {
      ctx.beginPath()
      let started = false
      for (let lat = -90; lat <= 90; lat += 5) {
        const p = projectLatLon(lat, lon, params)
        if (!p.visible) {
          started = false
          continue
        }
        if (!started) {
          ctx.moveTo(p.x, p.y)
          started = true
        } else {
          ctx.lineTo(p.x, p.y)
        }
      }
      ctx.stroke()
    }
  }

  // =================== ATMOSPHERE RIM ===================
  function drawAtmosphereRim(params: ProjectionParams) {
    ctx.globalCompositeOperation = 'screen'

    const rimGlow = ctx.createRadialGradient(
      params.cx, params.cy, params.radius * 0.95,
      params.cx, params.cy, params.radius * 1.12,
    )
    rimGlow.addColorStop(0, 'rgba(40, 120, 200, 0.0)')
    rimGlow.addColorStop(0.2, 'rgba(60, 140, 220, 0.08)')
    rimGlow.addColorStop(0.5, 'rgba(50, 120, 200, 0.05)')
    rimGlow.addColorStop(0.8, 'rgba(30, 80, 160, 0.02)')
    rimGlow.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = rimGlow
    ctx.beginPath()
    ctx.arc(params.cx, params.cy, params.radius * 1.12, 0, TWO_PI)
    ctx.fill()

    ctx.strokeStyle = 'rgba(100, 180, 240, 0.10)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(params.cx, params.cy, params.radius, 0, TWO_PI)
    ctx.stroke()

    ctx.globalCompositeOperation = 'source-over'
  }

  // =================== AURORA HELPERS ===================

  interface AuroraPrecomputed {
    lon: number
    effectiveLat: number
    intensity: number
    r: number
    g: number
    b: number
    projectedX: number
    projectedY: number
  }

  function prepareAuroraPoints(
    auroraData: Array<AuroraCoordinate>,
    params: ProjectionParams,
    time: number,
    kpIndex: number,
  ): Array<AuroraPrecomputed> {
    const useRealData = auroraData.length > 0
    let auroraPoints: Array<AuroraCoordinate>

    if (useRealData) {
      if (auroraData !== cachedAuroraSource) {
        cachedAuroraSource = auroraData
        // More aggressive downsampling: step 4 instead of 2
        cachedAuroraDownsampled = downsampleAurora(auroraData, 4)
      }
      auroraPoints = cachedAuroraDownsampled
    } else {
      auroraPoints = fallbackAuroraDownsampled
    }

    if (auroraPoints.length === 0) return []

    const kpBoost = 0.3 + (kpIndex / 9) * 1.0
    const kpLatExtension = kpIndex >= 5 ? (kpIndex - 4) * 2 : 0
    const result: Array<AuroraPrecomputed> = []

    // Pre-compute time-based shimmer values
    const t002 = time * 0.002
    const t005 = time * 0.005
    const t008 = time * 0.008

    for (const coord of auroraPoints) {
      const lon = coord[0]
      const lat = coord[1]
      const probability = coord[2]

      if (lon === undefined || lat === undefined || probability === undefined) continue

      const effectiveLat = lat > 0
        ? lat - kpLatExtension
        : lat + kpLatExtension

      const projected = projectLatLon(effectiveLat, lon, params)
      if (!projected.visible) continue

      const shimmer1 = 0.5 + 0.5 * Math.sin(t002 + lon * 0.1 + lat * 0.08)
      const shimmer2 = 0.5 + 0.5 * Math.sin(t005 + lon * 0.06 - lat * 0.12)
      const shimmer3 = 0.5 + 0.5 * Math.sin(t008 + lon * 0.15 + lat * 0.03)
      const shimmer = 0.3 + 0.7 * (shimmer1 * 0.45 + shimmer2 * 0.35 + shimmer3 * 0.2)

      const intensity = (probability / 100) * shimmer * projected.depth * kpBoost
      if (intensity < 0.005) continue

      const absLat = Math.abs(effectiveLat)
      const purpleMix = Math.max(0, Math.min(1, 1 - (absLat - 58) / 14))

      const r = Math.round(purpleMix * 136 + (1 - purpleMix) * 0)
      const g = Math.round(purpleMix * 85 + (1 - purpleMix) * 255)
      const b = Math.round(purpleMix * 255 + (1 - purpleMix) * 136)

      result.push({
        lon,
        effectiveLat,
        intensity,
        r,
        g,
        b,
        projectedX: projected.x,
        projectedY: projected.y,
      })
    }

    return result
  }

  // =================== AURORA BASE GLOW ===================
  function drawAuroraBase(points: Array<AuroraPrecomputed>) {
    if (points.length === 0) return

    ctx.globalCompositeOperation = 'lighter'

    for (const pt of points) {
      const baseGlowSize = 8 + pt.intensity * 16
      const sizeIdx = getAuroraSizeBucket(baseGlowSize)
      const sprite = getAuroraBaseSprite(pt.r, pt.g, pt.b, sizeIdx)
      const bucketSize = AURORA_SIZE_BUCKETS[sizeIdx] ?? 24

      ctx.globalAlpha = Math.min(1, pt.intensity)
      ctx.drawImage(
        sprite,
        pt.projectedX - bucketSize,
        pt.projectedY - bucketSize,
        bucketSize * 2,
        bucketSize * 2,
      )
    }

    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }

  // =================== AURORA CURTAINS ===================
  function drawAuroraCurtains(
    points: Array<AuroraPrecomputed>,
    params: ProjectionParams,
    kpIndex: number,
  ) {
    if (points.length === 0) return

    ctx.globalCompositeOperation = 'lighter'

    for (const pt of points) {
      if (pt.intensity <= 0.04) continue

      const curtainHeight = 12 + pt.intensity * 30
      const curtainWidth = 4 + pt.intensity * 8
      const elevAmount = 0.03 + pt.intensity * 0.06

      const elevated = projectLatLonElevated(pt.effectiveLat, pt.lon, elevAmount, params)
      if (elevated.visible) {
        const sprite = getAuroraCurtainSprite(pt.r, pt.g, pt.b)
        const spriteW = curtainWidth * 2
        const spriteH = curtainHeight * 2
        ctx.globalAlpha = Math.min(1, pt.intensity)
        ctx.drawImage(
          sprite,
          elevated.x - curtainWidth,
          elevated.y - curtainHeight,
          spriteW,
          spriteH,
        )
      }

      // Higher curtain layer for intense aurora
      if (pt.intensity > 0.2) {
        const highElevAmount = elevAmount * 2.0
        const highElev = projectLatLonElevated(pt.effectiveLat, pt.lon, highElevAmount, params)
        if (highElev.visible) {
          const highGlowSize = 6 + pt.intensity * 16
          const highR = Math.min(255, pt.r + 40)
          const highG = Math.max(0, pt.g - 40)
          const highB = Math.min(255, pt.b + 30)
          const sprite = getAuroraHighSprite(highR, highG, highB)
          ctx.globalAlpha = Math.min(1, pt.intensity)
          ctx.drawImage(
            sprite,
            highElev.x - highGlowSize,
            highElev.y - highGlowSize,
            highGlowSize * 2,
            highGlowSize * 2,
          )
        }
      }

      // Third layer -- tippy top glow for Kp >= 5 storms
      if (pt.intensity > 0.4 && kpIndex >= 5) {
        const topElevAmount = elevAmount * 3.2
        const topElev = projectLatLonElevated(pt.effectiveLat, pt.lon, topElevAmount, params)
        if (topElev.visible) {
          const topGlowSize = 5 + pt.intensity * 10
          ctx.globalAlpha = Math.min(1, pt.intensity)
          ctx.drawImage(
            auroraTopSprite,
            topElev.x - topGlowSize,
            topElev.y - topGlowSize,
            topGlowSize * 2,
            topGlowSize * 2,
          )
        }
      }
    }

    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }

  // =================== LIGHTNING ===================
  function updateLightning(time: number, dt: number) {
    lightningFlashes = lightningFlashes.filter(
      f => time - f.startTime < f.duration,
    )

    const isBurst = Math.sin(time * 0.0003) > 0.85
    const baseRate = isBurst ? 8 : 4
    const flashesPerFrame = baseRate * (dt / 1000)
    const newFlashCount = Math.floor(flashesPerFrame) + (Math.random() < (flashesPerFrame % 1) ? 1 : 0)

    for (let i = 0; i < newFlashCount; i++) {
      const zone = Math.random()
      let lat: number
      if (zone < 0.5) {
        lat = -10 + Math.random() * 25
      } else if (zone < 0.75) {
        lat = 25 + Math.random() * 20
      } else {
        lat = -45 + Math.random() * 15
      }

      const lon = -180 + Math.random() * 360

      lightningFlashes.push({
        lat,
        lon,
        startTime: time,
        duration: 200 + Math.random() * 200,
        intensity: 0.8 + Math.random() * 0.2,
      })
    }
  }

  // Lightning uses pre-rendered sprites for core/halo
  function drawLightning(params: ProjectionParams, time: number) {
    ctx.globalCompositeOperation = 'lighter'

    for (const flash of lightningFlashes) {
      const projected = projectLatLon(flash.lat, flash.lon, params)
      if (!projected.visible) continue

      const elapsed = time - flash.startTime
      const progress = elapsed / flash.duration

      let alpha: number
      if (progress < 0.03) {
        alpha = progress / 0.03
      } else if (progress < 0.12) {
        alpha = 1
      } else {
        alpha = 1 - (progress - 0.12) / 0.88
      }
      alpha *= flash.intensity * projected.depth

      if (alpha < 0.01) continue

      // Bright white core -- pre-rendered sprite
      const coreSize = 8 + alpha * 4
      ctx.globalAlpha = alpha
      ctx.drawImage(
        lightningCoreSprite,
        projected.x - coreSize,
        projected.y - coreSize,
        coreSize * 2,
        coreSize * 2,
      )

      // Larger halo -- pre-rendered sprite
      const haloSize = 25 + alpha * 15
      ctx.drawImage(
        lightningHaloSprite,
        projected.x - haloSize,
        projected.y - haloSize,
        haloSize * 2,
        haloSize * 2,
      )

      // Electric arc branches
      if (alpha > 0.3) {
        const branchCount = 3 + Math.floor(flash.intensity * 3)
        ctx.globalAlpha = alpha * 0.6
        ctx.strokeStyle = 'rgba(160, 210, 255, 1)'
        ctx.lineWidth = 1.2
        const seed = flash.startTime
        for (let b = 0; b < branchCount; b++) {
          const angle = (seed * 0.01 + b * (TWO_PI / branchCount)) % TWO_PI
          const branchLen = 10 + (((seed * (b + 1)) % 20))
          ctx.beginPath()
          ctx.moveTo(projected.x, projected.y)
          let bx = projected.x
          let by = projected.y
          const segments = 2 + (b % 2)
          for (let s = 1; s <= segments; s++) {
            const frac = s / segments
            const jitter = ((seed * s * (b + 3)) % 10 - 5) * 0.08
            bx = projected.x + Math.cos(angle + jitter) * branchLen * frac
            by = projected.y + Math.sin(angle + jitter) * branchLen * frac
            ctx.lineTo(bx, by)
          }
          ctx.stroke()
        }
      }

      // Expanding afterglow ring
      if (progress > 0.1 && progress < 0.6) {
        const ringProgress = (progress - 0.1) / 0.5
        const ringRadius = coreSize + ringProgress * 25
        const ringAlpha = alpha * (1 - ringProgress) * 0.25
        if (ringAlpha > 0.01) {
          ctx.globalAlpha = ringAlpha
          ctx.strokeStyle = 'rgba(160, 210, 255, 1)'
          ctx.lineWidth = 1.5 - ringProgress * 1.2
          ctx.beginPath()
          ctx.arc(projected.x, projected.y, ringRadius, 0, TWO_PI)
          ctx.stroke()
        }
      }
    }

    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }

  // =================== SOLAR WIND PARTICLES ===================
  // Physically-motivated solar wind + magnetosphere interaction
  function updateSolarParticles(
    data: SpaceWeatherData,
    time: number,
    dt: number,
    effectiveRadius: number,
  ) {
    const speed = data.solarWind.speed
    const density = data.solarWind.density
    const bz = data.solarWind.bz

    solarParticles = solarParticles.filter(p => p.life < p.maxLife)
    impactFlashes = impactFlashes.filter(f => time - f.startTime < f.duration)

    // Bow shock standoff distance scales with dynamic pressure
    const dynamicPressure = density * (speed / 400) * (speed / 400)
    const bowShockRadius = effectiveRadius * Math.max(1.8, 3.2 - dynamicPressure * 0.12)
    const magnetopauseRadius = bowShockRadius * 0.75

    // Southward Bz enables reconnection
    const reconnectionFactor = Math.max(0, Math.min(1, -bz / 10))

    const spawnRate = Math.max(12, Math.min(density * 3, 50)) * (dt / 1000)
    const spawnCount = Math.floor(spawnRate) + (Math.random() < (spawnRate % 1) ? 1 : 0)

    for (let i = 0; i < spawnCount; i++) {
      const y = GLOBE_CY + (Math.random() - 0.5) * effectiveRadius * 3.2
      const speedFactor = speed / 400
      solarParticles.push({
        x: -30 - Math.random() * 50,
        y,
        vx: speedFactor * (2.5 + Math.random() * 1.5),
        vy: (Math.random() - 0.5) * 0.5,
        life: 0,
        maxLife: 450 + Math.random() * 350,
        size: 1.0 + Math.random() * 3.0,
      })
    }

    const impactDist = effectiveRadius * 1.02
    const doubleEffectiveRadius = effectiveRadius * 2

    for (const p of solarParticles) {
      const dx = GLOBE_CX - p.x
      const dy = GLOBE_CY - p.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      const latFraction = dy / doubleEffectiveRadius
      const absLatFraction = Math.abs(latFraction)

      if (dist < bowShockRadius) {
        const normalizedDist = dist / bowShockRadius
        const invDist = 1 / dist

        // Bow shock deceleration
        if (dist > magnetopauseRadius) {
          const shockDepth = 1 - (dist - magnetopauseRadius) / (bowShockRadius - magnetopauseRadius)
          p.vx *= 1 - shockDepth * 0.02
        }

        // Magnetic field line curvature
        const polewardForce = absLatFraction * 0.06 * (1 - normalizedDist)
        p.vy += (dy > 0 ? -1 : 1) * polewardForce

        // Equatorial deflection
        if (absLatFraction < 0.35 && dist < magnetopauseRadius * 1.3) {
          const deflectStrength = 0.12 * (1 - absLatFraction / 0.35) * (1 - normalizedDist)
          p.vx -= dx * invDist * deflectStrength
          p.vy += (dy > 0 ? -1 : 1) * deflectStrength * 0.6
        }

        // Cusp funneling (reconnection-driven)
        if (absLatFraction > 0.4 && reconnectionFactor > 0.05) {
          const cuspAttraction = reconnectionFactor * 0.04 * (1 - normalizedDist)
          const cuspTarget = GLOBE_CY + (dy > 0 ? -1 : 1) * effectiveRadius * 0.65
          const toCusp = cuspTarget - p.y
          p.vy += Math.sign(toCusp) * cuspAttraction * Math.min(1, Math.abs(toCusp) / effectiveRadius)
          p.vx += dx * invDist * cuspAttraction * 0.5
        }

        // General magnetospheric deflection near inner boundary
        if (dist < magnetopauseRadius) {
          const innerDeflect = 0.08 * (1 - dist / magnetopauseRadius)
          const invDistInner = 1 / dist
          p.vx -= dx * invDistInner * innerDeflect
          p.vy += (dy > 0 ? -1 : 1) * innerDeflect * 0.8
        }
      }

      p.x += p.vx
      p.y += p.vy
      p.life += 1

      const distToCenter = Math.sqrt(
        (p.x - GLOBE_CX) ** 2 + (p.y - GLOBE_CY) ** 2,
      )
      if (distToCenter < impactDist) {
        const impactChance = absLatFraction > 0.4 ? 0.5 : 0.15
        if (Math.random() < impactChance) {
          impactFlashes.push({
            x: p.x,
            y: p.y,
            startTime: time,
            duration: 300 + Math.random() * 200,
          })
        }
        p.life = p.maxLife
      }

      if (p.x > WIDTH + 50 || p.y < -100 || p.y > HEIGHT + 100) {
        p.life = p.maxLife
      }
    }
  }

  function drawSolarParticles(time: number) {
    ctx.globalCompositeOperation = 'lighter'

    for (const p of solarParticles) {
      const lifeRatio = p.life / p.maxLife
      let alpha: number
      if (lifeRatio < 0.05) {
        alpha = lifeRatio / 0.05
      } else if (lifeRatio > 0.7) {
        alpha = (1 - lifeRatio) / 0.3
      } else {
        alpha = 1
      }

      if (alpha < 0.01) continue

      // Trail -- simple filled rect instead of per-frame linear gradient
      const trailLen = Math.min(p.vx * 10, 40)
      if (trailLen > 2) {
        ctx.globalAlpha = alpha * 0.35
        ctx.fillStyle = 'rgb(255, 185, 60)'
        ctx.fillRect(
          p.x - trailLen,
          p.y - p.size * 0.35,
          trailLen,
          p.size * 0.7,
        )
      }

      // Particle head -- pre-rendered sprite
      const headSize = p.size * 4.5
      ctx.globalAlpha = alpha
      ctx.drawImage(
        particleHeadSprite,
        p.x - headSize,
        p.y - headSize,
        headSize * 2,
        headSize * 2,
      )
    }

    // Impact flashes -- pre-rendered sprite
    for (const flash of impactFlashes) {
      const elapsed = time - flash.startTime
      const progress = elapsed / flash.duration
      const flashAlpha = progress < 0.1
        ? progress / 0.1
        : 1 - (progress - 0.1) / 0.9
      if (flashAlpha < 0.01) continue

      const flashSize = 15 + progress * 20
      ctx.globalAlpha = flashAlpha
      ctx.drawImage(
        impactFlashSprite,
        flash.x - flashSize,
        flash.y - flashSize,
        flashSize * 2,
        flashSize * 2,
      )
    }

    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }

  // =================== GLOBE EDGE ===================
  function drawGlobeEdge(params: ProjectionParams) {
    ctx.strokeStyle = 'rgba(50, 100, 160, 0.12)'
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.arc(params.cx, params.cy, params.radius, 0, TWO_PI)
    ctx.stroke()
  }

  // =================== FPS COUNTER ===================
  function drawFpsCounter() {
    ctx.globalAlpha = 0.4
    ctx.font = '10px monospace'
    ctx.fillStyle = '#aaaaaa'
    ctx.textAlign = 'right'
    ctx.fillText(`${currentFps} fps`, WIDTH - 8, HEIGHT - 8)
    ctx.textAlign = 'left'
    ctx.globalAlpha = 1
  }

  // =================== MAIN RENDER LOOP ===================
  function render(data: SpaceWeatherData, time: number) {
    if (startTime < 0) startTime = time

    const dt = lastTime === 0 ? 16 : time - lastTime
    lastTime = time

    // FPS measurement
    frameCount++
    if (time - lastFpsTime > 1000) {
      currentFps = frameCount
      frameCount = 0
      lastFpsTime = time
    }

    const params = getProjectionParams(time)

    // Clear
    ctx.clearRect(0, 0, WIDTH, HEIGHT)

    // Deep space background -- pre-rendered
    ctx.drawImage(bgCanvas, 0, 0)

    // Background stars
    drawStars(time, params.radius)

    // Solar wind particles (behind globe)
    updateSolarParticles(data, time, dt, params.radius)
    drawSolarParticles(time)

    // Atmosphere glow (behind and around globe -- unclipped)
    drawAtmosphereGlow(params)

    // Precompute aurora points (used in both clipped and unclipped passes)
    const auroraPoints = prepareAuroraPoints(data.aurora, params, time, data.kpIndex)

    // -- All on-globe layers clipped to globe circle --
    ctx.save()
    ctx.beginPath()
    ctx.arc(params.cx, params.cy, params.radius - 2, 0, TWO_PI)
    ctx.clip()

    // Globe surface (ocean, specular, limb darkening)
    drawGlobeSurface(params)

    // Day/night terminator shading
    drawDayNightTerminator(params)

    // Grid lines
    drawGraticule(params)

    // Continent outlines
    drawContinents(params)

    // Aurora base glow on the globe surface
    drawAuroraBase(auroraPoints)

    // Lightning flashes
    updateLightning(time, dt)
    drawLightning(params, time)

    // -- End globe clip --
    ctx.restore()

    // Aurora curtains extend above the globe surface (unclipped)
    drawAuroraCurtains(auroraPoints, params, data.kpIndex)

    // Atmosphere rim
    drawAtmosphereRim(params)

    // Globe edge
    drawGlobeEdge(params)

    // FPS counter overlay
    drawFpsCounter()
  }

  function destroy() {
    lightningFlashes = []
    solarParticles = []
    impactFlashes = []
  }

  return { render, destroy, getLightningCount: () => lightningFlashes.length }
}
