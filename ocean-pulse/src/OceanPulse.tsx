import { useRef, useEffect, useCallback } from 'react'
import { ALL_COASTLINES } from './coastline'
import type { CoastSegment } from './coastline'

// ─── Types ──────────────────────────────────────────────────────

interface BuoyObservation {
  stn: string
  lat: number
  lon: number
  year: number
  month: number
  day: number
  hour: number
  minute: number
  wdir: number | null    // wind direction (degrees)
  wspd: number | null    // wind speed (m/s)
  gst: number | null     // gust speed
  wvht: number | null    // wave height (m)
  dpd: number | null     // dominant wave period
  apd: number | null     // average wave period
  mwd: number | null     // mean wave direction
  pres: number | null    // pressure (hPa)
  atmp: number | null    // air temp (C)
  wtmp: number | null    // water temp (C)
  dewp: number | null    // dew point
  vis: number | null     // visibility (nmi)
  tide: number | null    // tide (ft)
}

interface AnimBuoy {
  stn: string
  lat: number
  lon: number
  x: number
  y: number
  wvht: number
  wtmp: number
  wspd: number
  wdir: number
  pres: number
  phaseOffset: number  // randomized per buoy for desynchronized pulse
  // interpolation targets
  targetWvht: number
  targetWtmp: number
  targetWspd: number
  targetWdir: number
}

interface DeepParticle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  opacity: number
}

interface WaveLayer {
  offset: number
  amplitude: number
  frequency: number
  speed: number
  opacity: number
}

// ─── Constants ──────────────────────────────────────────────────

const W = 1280
const H = 720
const SAFE = 40

// Map projection bounds — continental US focus
const LAT_MIN = 24
const LAT_MAX = 50
const LON_MIN = -130
const LON_MAX = -65

// Separate projection for Alaska
const AK_LAT_MIN = 50
const AK_LAT_MAX = 62
const AK_LON_MIN = -180
const AK_LON_MAX = -130

// Separate projection for Hawaii
const HI_LAT_MIN = 18
const HI_LAT_MAX = 23
const HI_LON_MIN = -162
const HI_LON_MAX = -154

// Map area on canvas (leave room for overlays)
const MAP_LEFT = SAFE + 10
const MAP_TOP = SAFE + 50
const MAP_RIGHT = W - SAFE - 10
const MAP_BOTTOM = H - SAFE - 40
const MAP_W = MAP_RIGHT - MAP_LEFT
const MAP_H = MAP_BOTTOM - MAP_TOP

// Alaska inset
const AK_LEFT = MAP_LEFT
const AK_TOP = MAP_BOTTOM - 140
const AK_W = 150
const AK_H = 100

// Hawaii inset
const HI_LEFT = MAP_LEFT + 160
const HI_TOP = MAP_BOTTOM - 80
const HI_W = 80
const HI_H = 60

// Data
const POLL_INTERVAL = 5 * 60 * 1000  // 5 minutes
const DATA_URL = 'https://www.ndbc.noaa.gov/data/latest_obs/latest_obs.txt'
const PROXY_URL = 'https://corsproxy.io/?url='

// Temperature color stops (Celsius)
const TEMP_STOPS: readonly (readonly [number, readonly [number, number, number]])[] = [
  [0, [0, 40, 200]],
  [5, [0, 80, 255]],
  [10, [0, 180, 255]],
  [15, [0, 220, 180]],
  [20, [50, 230, 100]],
  [25, [220, 220, 0]],
  [30, [255, 140, 0]],
  [35, [255, 50, 0]],
]

const PARTICLE_COUNT = 120
const WAVE_LAYERS = 5
const TARGET_FPS = 30
const FRAME_MS = 1000 / TARGET_FPS

// ─── Helpers ────────────────────────────────────────────────────

function parseNumOrNull(val: string | undefined): number | null {
  if (!val || val === 'MM' || val === 'mm') return null
  const n = parseFloat(val)
  return isNaN(n) ? null : n
}

function projectConus(lat: number, lon: number): readonly [number, number] {
  const x = MAP_LEFT + ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * MAP_W
  const y = MAP_TOP + ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * MAP_H
  return [x, y]
}

function projectAlaska(lat: number, lon: number): readonly [number, number] {
  const x = AK_LEFT + ((lon - AK_LON_MIN) / (AK_LON_MAX - AK_LON_MIN)) * AK_W
  const y = AK_TOP + ((AK_LAT_MAX - lat) / (AK_LAT_MAX - AK_LAT_MIN)) * AK_H
  return [x, y]
}

function projectHawaii(lat: number, lon: number): readonly [number, number] {
  const x = HI_LEFT + ((lon - HI_LON_MIN) / (HI_LON_MAX - HI_LON_MIN)) * HI_W
  const y = HI_TOP + ((HI_LAT_MAX - lat) / (HI_LAT_MAX - HI_LAT_MIN)) * HI_H
  return [x, y]
}

function projectBuoy(lat: number, lon: number): readonly [number, number] | null {
  // Alaska
  if (lat >= AK_LAT_MIN && lon < -130) {
    return projectAlaska(lat, lon)
  }
  // Hawaii
  if (lat >= HI_LAT_MIN && lat <= HI_LAT_MAX && lon >= HI_LON_MIN && lon <= HI_LON_MAX) {
    return projectHawaii(lat, lon)
  }
  // CONUS
  if (lat >= LAT_MIN && lat <= LAT_MAX && lon >= LON_MIN && lon <= LON_MAX) {
    return projectConus(lat, lon)
  }
  return null
}

function tempToColor(temp: number): readonly [number, number, number] {
  if (temp <= TEMP_STOPS[0]![0]) return TEMP_STOPS[0]![1]
  const lastStop = TEMP_STOPS[TEMP_STOPS.length - 1]
  if (!lastStop) return [0, 100, 255]
  if (temp >= lastStop[0]) return lastStop[1]

  for (let i = 0; i < TEMP_STOPS.length - 1; i++) {
    const lo = TEMP_STOPS[i]!
    const hi = TEMP_STOPS[i + 1]!
    if (temp >= lo[0] && temp <= hi[0]) {
      const t = (temp - lo[0]) / (hi[0] - lo[0])
      return [
        Math.round(lo[1][0] + (hi[1][0] - lo[1][0]) * t),
        Math.round(lo[1][1] + (hi[1][1] - lo[1][1]) * t),
        Math.round(lo[1][2] + (hi[1][2] - lo[1][2]) * t),
      ]
    }
  }
  return [0, 150, 255]
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a
  if (diff > 180) diff -= 360
  if (diff < -180) diff += 360
  return a + diff * t
}

function parseBuoyData(text: string): BuoyObservation[] {
  const lines = text.split('\n')
  const results: BuoyObservation[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    // Skip header lines (start with # or contain non-numeric first field)
    if (line.startsWith('#')) continue

    const parts = line.trim().split(/\s+/)
    if (parts.length < 22) continue

    const stn = parts[0]
    const lat = parseFloat(parts[1] ?? '')
    const lon = parseFloat(parts[2] ?? '')

    if (!stn || isNaN(lat) || isNaN(lon)) continue
    // Skip if lat/lon is 0,0 (invalid)
    if (lat === 0 && lon === 0) continue

    const wdir = parseNumOrNull(parts[8])
    const wspd = parseNumOrNull(parts[9])
    const gst = parseNumOrNull(parts[10])
    const wvht = parseNumOrNull(parts[11])
    const dpd = parseNumOrNull(parts[12])
    const apd = parseNumOrNull(parts[13])
    const mwd = parseNumOrNull(parts[14])
    const pres = parseNumOrNull(parts[15])
    const atmp = parseNumOrNull(parts[17])
    const wtmp = parseNumOrNull(parts[18])
    const dewp = parseNumOrNull(parts[19])
    const vis = parseNumOrNull(parts[20])
    const tide = parseNumOrNull(parts[21])

    // Skip if no useful data
    if (wvht === null && wtmp === null && wspd === null) continue

    results.push({
      stn,
      lat,
      lon,
      year: parseInt(parts[3] ?? '0', 10),
      month: parseInt(parts[4] ?? '0', 10),
      day: parseInt(parts[5] ?? '0', 10),
      hour: parseInt(parts[6] ?? '0', 10),
      minute: parseInt(parts[7] ?? '0', 10),
      wdir,
      wspd,
      gst,
      wvht,
      dpd,
      apd,
      mwd,
      pres,
      atmp,
      wtmp,
      dewp,
      vis,
      tide,
    })
  }

  return results
}

function projectCoastSegment(
  segment: CoastSegment,
  projectFn: (lat: number, lon: number) => readonly [number, number],
): readonly (readonly [number, number])[] {
  return segment.map(([lat, lon]) => projectFn(lat, lon))
}

// ─── Component ──────────────────────────────────────────────────

export function OceanPulse() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const buoysRef = useRef<AnimBuoy[]>([])
  const particlesRef = useRef<DeepParticle[]>([])
  const wavesRef = useRef<WaveLayer[]>([])
  const statsRef = useRef({ stationCount: 0, avgWvht: 0, maxWspd: 0, lastUpdate: '' })
  const coastProjectedRef = useRef<readonly (readonly (readonly [number, number])[])[]>([])
  const frameRef = useRef(0)
  const lastFrameTimeRef = useRef(0)
  const dataLoadedRef = useRef(false)
  const fetchErrorRef = useRef(false)

  // ─── Initialize coastline projections ───────────────────────

  const initCoasts = useCallback(() => {
    const projected: (readonly (readonly [number, number])[])[] = []

    for (const segment of ALL_COASTLINES) {
      // Determine which projection to use based on first point
      const firstPoint = segment[0]
      if (!firstPoint) continue

      const [lat, lon] = firstPoint

      if (lat >= AK_LAT_MIN && lon < -130) {
        projected.push(projectCoastSegment(segment, projectAlaska))
      } else if (lat >= HI_LAT_MIN && lat <= HI_LAT_MAX && lon >= HI_LON_MIN) {
        projected.push(projectCoastSegment(segment, projectHawaii))
      } else {
        projected.push(projectCoastSegment(segment, projectConus))
      }
    }

    coastProjectedRef.current = projected
  }, [])

  // ─── Initialize ambient particles ──────────────────────────

  const initParticles = useCallback(() => {
    const particles: DeepParticle[] = []
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.15 + 0.05,
        size: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.15 + 0.03,
      })
    }
    particlesRef.current = particles
  }, [])

  // ─── Initialize wave layers ─────────────────────────────────

  const initWaves = useCallback(() => {
    const layers: WaveLayer[] = []
    for (let i = 0; i < WAVE_LAYERS; i++) {
      layers.push({
        offset: Math.random() * Math.PI * 2,
        amplitude: 8 + Math.random() * 15,
        frequency: 0.003 + Math.random() * 0.004,
        speed: 0.0003 + Math.random() * 0.0005,
        opacity: 0.015 + Math.random() * 0.02,
      })
    }
    wavesRef.current = layers
  }, [])

  // ─── Fetch + parse buoy data ────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      // Try direct first, then CORS proxy
      let text: string
      try {
        const resp = await fetch(DATA_URL, { cache: 'no-store' })
        text = await resp.text()
      } catch {
        const resp = await fetch(PROXY_URL + encodeURIComponent(DATA_URL), { cache: 'no-store' })
        text = await resp.text()
      }

      const observations = parseBuoyData(text)
      fetchErrorRef.current = false

      // Project and create anim buoys
      const newBuoys: AnimBuoy[] = []
      let totalWvht = 0
      let wvhtCount = 0
      let maxWspd = 0

      for (const obs of observations) {
        const pos = projectBuoy(obs.lat, obs.lon)
        if (!pos) continue

        const [x, y] = pos
        // Skip if off-canvas
        if (x < 0 || x > W || y < 0 || y > H) continue

        const wvht = obs.wvht ?? 0
        const wtmp = obs.wtmp ?? 15
        const wspd = obs.wspd ?? 0
        const wdir = obs.wdir ?? 0
        const pres = obs.pres ?? 1013

        if (obs.wvht !== null) {
          totalWvht += wvht
          wvhtCount++
        }
        if (wspd > maxWspd) maxWspd = wspd

        // Check if buoy already exists
        const existing = buoysRef.current.find(b => b.stn === obs.stn)
        if (existing) {
          existing.targetWvht = wvht
          existing.targetWtmp = wtmp
          existing.targetWspd = wspd
          existing.targetWdir = wdir
          existing.x = x
          existing.y = y
          newBuoys.push(existing)
        } else {
          newBuoys.push({
            stn: obs.stn,
            lat: obs.lat,
            lon: obs.lon,
            x,
            y,
            wvht,
            wtmp,
            wspd,
            wdir,
            pres,
            phaseOffset: Math.random() * Math.PI * 2,
            targetWvht: wvht,
            targetWtmp: wtmp,
            targetWspd: wspd,
            targetWdir: wdir,
          })
        }
      }

      buoysRef.current = newBuoys
      dataLoadedRef.current = true

      // Update stats
      const now = new Date()
      statsRef.current = {
        stationCount: newBuoys.length,
        avgWvht: wvhtCount > 0 ? totalWvht / wvhtCount : 0,
        maxWspd,
        lastUpdate: now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
      }
    } catch {
      fetchErrorRef.current = true
      // Generate demo data if fetch fails completely
      if (!dataLoadedRef.current) {
        generateDemoData()
      }
    }
  }, [])

  // ─── Demo data fallback ─────────────────────────────────────

  const generateDemoData = useCallback(() => {
    const demoStations: readonly (readonly [string, number, number])[] = [
      ['46001', 56.3, -148.0],
      ['46002', 42.5, -130.3],
      ['46005', 46.1, -131.0],
      ['46006', 40.8, -137.5],
      ['46011', 34.9, -120.9],
      ['46012', 37.4, -122.7],
      ['46013', 38.2, -123.3],
      ['46014', 39.2, -124.0],
      ['46015', 42.8, -124.8],
      ['46022', 40.7, -124.5],
      ['46025', 33.7, -119.1],
      ['46026', 37.8, -122.8],
      ['46027', 41.9, -124.4],
      ['46028', 35.7, -121.9],
      ['46029', 46.1, -124.5],
      ['46041', 47.3, -124.7],
      ['46042', 36.8, -122.4],
      ['46047', 32.4, -119.5],
      ['46050', 44.6, -124.5],
      ['46053', 34.3, -119.8],
      ['46054', 34.3, -120.5],
      ['46059', 38.0, -130.0],
      ['46069', 33.7, -120.2],
      ['46071', 34.5, -120.8],
      ['46086', 32.5, -118.0],
      ['41001', 34.7, -72.7],
      ['41002', 32.3, -75.4],
      ['41004', 32.5, -79.1],
      ['41008', 31.4, -80.9],
      ['41009', 28.5, -80.2],
      ['41010', 28.9, -78.5],
      ['41013', 33.4, -77.7],
      ['41025', 35.0, -75.4],
      ['41036', 34.2, -76.9],
      ['41040', 14.6, -53.3],
      ['41043', 21.1, -64.8],
      ['41044', 21.6, -58.7],
      ['41046', 23.8, -69.0],
      ['41047', 27.5, -71.5],
      ['41048', 31.8, -69.6],
      ['41049', 27.5, -63.0],
      ['44005', 43.2, -69.1],
      ['44007', 43.5, -70.1],
      ['44008', 40.5, -69.2],
      ['44009', 38.5, -74.7],
      ['44011', 41.1, -66.6],
      ['44013', 42.3, -70.7],
      ['44014', 36.6, -74.8],
      ['44017', 40.7, -72.0],
      ['44020', 41.4, -70.2],
      ['44025', 40.3, -73.2],
      ['44027', 44.3, -67.3],
      ['42001', 25.9, -89.7],
      ['42002', 26.1, -93.6],
      ['42003', 26.0, -85.9],
      ['42012', 30.1, -87.6],
      ['42019', 27.9, -95.4],
      ['42020', 26.9, -96.7],
      ['42035', 29.2, -94.4],
      ['42036', 28.5, -84.5],
      ['42039', 28.8, -86.0],
      ['42040', 29.2, -88.2],
      ['42055', 22.0, -94.0],
      ['42056', 19.9, -85.1],
      ['42057', 16.9, -81.4],
      ['42058', 14.8, -75.1],
      ['42059', 15.0, -67.5],
      ['42060', 16.4, -63.3],
      ['51000', 23.5, -153.9],
      ['51001', 23.4, -162.3],
      ['51002', 17.1, -157.8],
      ['51003', 19.2, -160.6],
      ['51004', 17.5, -152.5],
      ['51101', 24.4, -162.1],
    ]

    const buoys: AnimBuoy[] = []
    for (const [stn, lat, lon] of demoStations) {
      const pos = projectBuoy(lat, lon)
      if (!pos) continue
      const [x, y] = pos
      if (x < 0 || x > W || y < 0 || y > H) continue

      buoys.push({
        stn,
        lat,
        lon,
        x,
        y,
        wvht: Math.random() * 4 + 0.5,
        wtmp: Math.random() * 25 + 5,
        wspd: Math.random() * 15 + 1,
        wdir: Math.random() * 360,
        pres: 1010 + Math.random() * 10,
        phaseOffset: Math.random() * Math.PI * 2,
        targetWvht: Math.random() * 4 + 0.5,
        targetWtmp: Math.random() * 25 + 5,
        targetWspd: Math.random() * 15 + 1,
        targetWdir: Math.random() * 360,
      })
    }

    buoysRef.current = buoys
    dataLoadedRef.current = true
    statsRef.current = {
      stationCount: buoys.length,
      avgWvht: 1.8,
      maxWspd: 14.2,
      lastUpdate: 'DEMO DATA',
    }
  }, [])

  // ─── Render frame ───────────────────────────────────────────

  const render = useCallback((ctx: CanvasRenderingContext2D, time: number) => {
    const buoys = buoysRef.current
    const particles = particlesRef.current
    const waves = wavesRef.current
    const coasts = coastProjectedRef.current
    const stats = statsRef.current

    // Clear
    ctx.fillStyle = '#050a14'
    ctx.fillRect(0, 0, W, H)

    // ─── Background wave layers ──────────────────────────────
    for (const wave of waves) {
      const t = time * wave.speed + wave.offset
      ctx.strokeStyle = `rgba(0, 120, 200, ${wave.opacity})`
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let x = 0; x <= W; x += 4) {
        const y = H / 2 + Math.sin(x * wave.frequency + t) * wave.amplitude
                  + Math.sin(x * wave.frequency * 0.7 + t * 1.3) * wave.amplitude * 0.5
        if (x === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }
      ctx.stroke()
    }

    // ─── Deep particles ──────────────────────────────────────
    for (const p of particles) {
      p.x += p.vx
      p.y += p.vy
      if (p.x < 0) p.x = W
      if (p.x > W) p.x = 0
      if (p.y < 0) p.y = H
      if (p.y > H) p.y = 0

      const flicker = 0.7 + 0.3 * Math.sin(time * 0.001 + p.x * 0.01)
      ctx.fillStyle = `rgba(60, 140, 220, ${p.opacity * flicker})`
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
    }

    // ─── Coastlines ──────────────────────────────────────────
    ctx.strokeStyle = 'rgba(30, 55, 80, 0.6)'
    ctx.lineWidth = 1.2
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'

    for (const segment of coasts) {
      if (segment.length < 2) continue
      ctx.beginPath()
      const first = segment[0]!
      ctx.moveTo(first[0], first[1])
      for (let i = 1; i < segment.length; i++) {
        const pt = segment[i]!
        ctx.lineTo(pt[0], pt[1])
      }
      ctx.stroke()
    }

    // Subtle fill for coastline (land mass hint)
    ctx.fillStyle = 'rgba(15, 25, 40, 0.3)'
    for (const segment of coasts) {
      if (segment.length < 3) continue
      ctx.beginPath()
      const first = segment[0]!
      ctx.moveTo(first[0], first[1])
      for (let i = 1; i < segment.length; i++) {
        const pt = segment[i]!
        ctx.lineTo(pt[0], pt[1])
      }
      ctx.closePath()
      ctx.fill()
    }

    // ─── Inset borders (Alaska / Hawaii) ─────────────────────
    ctx.strokeStyle = 'rgba(30, 55, 80, 0.3)'
    ctx.lineWidth = 0.5
    ctx.setLineDash([3, 3])
    ctx.strokeRect(AK_LEFT - 5, AK_TOP - 5, AK_W + 10, AK_H + 10)
    ctx.strokeRect(HI_LEFT - 5, HI_TOP - 5, HI_W + 10, HI_H + 10)
    ctx.setLineDash([])

    // Inset labels
    ctx.font = '8px IBM Plex Mono, monospace'
    ctx.fillStyle = 'rgba(100, 140, 180, 0.4)'
    ctx.fillText('AK', AK_LEFT, AK_TOP - 8)
    ctx.fillText('HI', HI_LEFT, HI_TOP - 8)

    // ─── Buoys ───────────────────────────────────────────────
    const interpSpeed = 0.02
    for (const b of buoys) {
      // Smooth interpolation toward targets
      b.wvht = lerp(b.wvht, b.targetWvht, interpSpeed)
      b.wtmp = lerp(b.wtmp, b.targetWtmp, interpSpeed)
      b.wspd = lerp(b.wspd, b.targetWspd, interpSpeed)
      b.wdir = lerpAngle(b.wdir, b.targetWdir, interpSpeed)

      // Pulse based on wave height
      const pulsePhase = Math.sin(time * 0.0015 + b.phaseOffset) * 0.5 + 0.5
      const baseRadius = 2 + Math.min(b.wvht, 8) * 1.2
      const pulseAmount = 0.3 + Math.min(b.wvht, 6) * 0.12
      const radius = baseRadius * (1 + pulseAmount * pulsePhase)

      // Temperature color
      const [r, g, bl] = tempToColor(b.wtmp)

      // Outer glow (bioluminescence)
      const glowRadius = radius * 4
      const gradient = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, glowRadius)
      const glowAlpha = 0.12 + pulsePhase * 0.08
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${bl}, ${glowAlpha})`)
      gradient.addColorStop(0.3, `rgba(${r}, ${g}, ${bl}, ${glowAlpha * 0.4})`)
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${bl}, 0)`)
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(b.x, b.y, glowRadius, 0, Math.PI * 2)
      ctx.fill()

      // Core dot
      const coreAlpha = 0.6 + pulsePhase * 0.4
      ctx.fillStyle = `rgba(${r}, ${g}, ${bl}, ${coreAlpha})`
      ctx.beginPath()
      ctx.arc(b.x, b.y, radius, 0, Math.PI * 2)
      ctx.fill()

      // Bright center
      ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + pulsePhase * 0.3})`
      ctx.beginPath()
      ctx.arc(b.x, b.y, radius * 0.3, 0, Math.PI * 2)
      ctx.fill()

      // Wind indicator
      if (b.wspd > 0.5) {
        const windLen = 12 + Math.min(b.wspd, 20) * 1.4
        const windRad = (b.wdir - 90) * (Math.PI / 180)
        const wx = b.x + Math.cos(windRad) * (radius + 4)
        const wy = b.y + Math.sin(windRad) * (radius + 4)
        const ex = wx + Math.cos(windRad) * windLen
        const ey = wy + Math.sin(windRad) * windLen

        ctx.strokeStyle = `rgba(${r}, ${g}, ${bl}, ${0.4 + pulsePhase * 0.2})`
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(wx, wy)
        ctx.lineTo(ex, ey)
        ctx.stroke()

        // Arrowhead
        const aLen = 6
        const aAngle = 0.6
        ctx.beginPath()
        ctx.moveTo(ex, ey)
        ctx.lineTo(
          ex - Math.cos(windRad - aAngle) * aLen,
          ey - Math.sin(windRad - aAngle) * aLen,
        )
        ctx.moveTo(ex, ey)
        ctx.lineTo(
          ex - Math.cos(windRad + aAngle) * aLen,
          ey - Math.sin(windRad + aAngle) * aLen,
        )
        ctx.stroke()
      }
    }

    // ─── Overlays ────────────────────────────────────────────

    // Title (top-left)
    ctx.font = '500 22px IBM Plex Mono, monospace'
    ctx.fillStyle = 'rgba(180, 210, 240, 0.85)'
    ctx.fillText('OCEAN PULSE', SAFE, SAFE + 20)

    ctx.font = '300 11px IBM Plex Mono, monospace'
    ctx.fillStyle = 'rgba(100, 140, 180, 0.6)'
    ctx.fillText('NOAA NDBC  \u00b7  LIVE BUOY OBSERVATIONS', SAFE, SAFE + 38)

    // Live indicator
    const livePulse = Math.sin(time * 0.003) * 0.5 + 0.5
    ctx.fillStyle = `rgba(255, 60, 60, ${0.5 + livePulse * 0.5})`
    ctx.beginPath()
    ctx.arc(SAFE + 218, SAFE + 14, 3, 0, Math.PI * 2)
    ctx.fill()

    ctx.font = '500 9px IBM Plex Mono, monospace'
    ctx.fillStyle = `rgba(255, 100, 100, ${0.5 + livePulse * 0.5})`
    ctx.fillText('LIVE', SAFE + 225, SAFE + 17)

    // Stats (top-right)
    ctx.textAlign = 'right'
    ctx.font = '400 11px IBM Plex Mono, monospace'
    ctx.fillStyle = 'rgba(100, 140, 180, 0.6)'
    ctx.fillText(`${stats.stationCount} STATIONS`, W - SAFE, SAFE + 16)

    ctx.fillStyle = 'rgba(80, 180, 255, 0.6)'
    ctx.fillText(
      `AVG WAVE: ${stats.avgWvht.toFixed(1)}m`,
      W - SAFE,
      SAFE + 32,
    )

    ctx.fillStyle = 'rgba(255, 160, 60, 0.6)'
    ctx.fillText(
      `MAX WIND: ${stats.maxWspd.toFixed(1)} m/s`,
      W - SAFE,
      SAFE + 48,
    )
    ctx.textAlign = 'left'

    // Last update (bottom-right)
    ctx.textAlign = 'right'
    ctx.font = '300 10px IBM Plex Mono, monospace'
    ctx.fillStyle = 'rgba(80, 110, 140, 0.5)'
    ctx.fillText(stats.lastUpdate, W - SAFE, H - SAFE + 10)
    ctx.textAlign = 'left'

    // ─── Legend panel (bottom-right) ──────────────────────────
    // All legends grouped in a single panel, sized for TV readability
    const panelW = 340
    const panelH = 150
    const panelX = W - SAFE - panelW
    const panelY = H - SAFE - panelH - 10

    // Panel background with subtle border
    ctx.fillStyle = 'rgba(5, 10, 20, 0.75)'
    ctx.fillRect(panelX, panelY, panelW, panelH)
    ctx.strokeStyle = 'rgba(40, 70, 110, 0.4)'
    ctx.lineWidth = 1
    ctx.strokeRect(panelX, panelY, panelW, panelH)

    const padX = 16
    const innerLeft = panelX + padX
    const barW = panelW - padX * 2

    // ── Water Temperature color scale ─────────────────────
    const tempLabelY = panelY + 24
    const tempBarY = panelY + 32
    const tempBarH = 14

    ctx.font = '500 16px IBM Plex Mono, monospace'
    ctx.fillStyle = 'rgba(180, 210, 240, 0.85)'
    ctx.fillText('WATER TEMP (\u00b0C)', innerLeft, tempLabelY)

    // Gradient bar
    const gradientBar = ctx.createLinearGradient(innerLeft, 0, innerLeft + barW, 0)
    gradientBar.addColorStop(0, 'rgb(0, 40, 200)')
    gradientBar.addColorStop(0.15, 'rgb(0, 80, 255)')
    gradientBar.addColorStop(0.3, 'rgb(0, 180, 255)')
    gradientBar.addColorStop(0.45, 'rgb(0, 220, 180)')
    gradientBar.addColorStop(0.6, 'rgb(50, 230, 100)')
    gradientBar.addColorStop(0.75, 'rgb(220, 220, 0)')
    gradientBar.addColorStop(0.88, 'rgb(255, 140, 0)')
    gradientBar.addColorStop(1, 'rgb(255, 50, 0)')
    ctx.fillStyle = gradientBar
    ctx.fillRect(innerLeft, tempBarY, barW, tempBarH)

    // Temperature labels
    ctx.font = '400 14px IBM Plex Mono, monospace'
    ctx.fillStyle = 'rgba(180, 210, 240, 0.8)'
    ctx.textAlign = 'center'
    const tempLabels = [0, 10, 20, 30]
    for (const t of tempLabels) {
      const tx = innerLeft + (t / 35) * barW
      ctx.fillText(`${t}\u00b0`, tx, tempBarY + tempBarH + 16)
    }
    ctx.textAlign = 'left'

    // ── Wave Height size legend ───────────────────────────
    const waveY = panelY + 80

    ctx.font = '500 16px IBM Plex Mono, monospace'
    ctx.fillStyle = 'rgba(180, 210, 240, 0.85)'
    ctx.fillText('WAVE HEIGHT', innerLeft, waveY)

    // Sample dots at increasing sizes to show wave height mapping
    ctx.font = '400 14px IBM Plex Mono, monospace'
    ctx.fillStyle = 'rgba(180, 210, 240, 0.7)'
    const waveSamples: readonly (readonly [string, number])[] = [
      ['1m', 2 + 1 * 1.2],
      ['3m', 2 + 3 * 1.2],
      ['6m', 2 + 6 * 1.2],
    ]
    let dotX = innerLeft + 10
    for (const [label, radius] of waveSamples) {
      // Draw sample dot
      ctx.fillStyle = 'rgba(0, 180, 255, 0.6)'
      ctx.beginPath()
      ctx.arc(dotX, waveY + 20, radius, 0, Math.PI * 2)
      ctx.fill()
      // Bright center
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
      ctx.beginPath()
      ctx.arc(dotX, waveY + 20, radius * 0.3, 0, Math.PI * 2)
      ctx.fill()
      // Label below
      ctx.fillStyle = 'rgba(180, 210, 240, 0.7)'
      ctx.textAlign = 'center'
      ctx.fillText(label, dotX, waveY + 40)
      dotX += 70
    }

    // ── Wind Speed legend ─────────────────────────────────
    ctx.textAlign = 'left'
    const windLegX = innerLeft + 220
    ctx.font = '500 16px IBM Plex Mono, monospace'
    ctx.fillStyle = 'rgba(180, 210, 240, 0.85)'
    ctx.fillText('WIND', windLegX, waveY)

    // Wind arrow sample
    const arrowBaseX = windLegX + 20
    const arrowBaseY = waveY + 20
    const arrowLen = 36
    ctx.strokeStyle = 'rgba(0, 180, 255, 0.7)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(arrowBaseX, arrowBaseY)
    ctx.lineTo(arrowBaseX + arrowLen, arrowBaseY)
    ctx.stroke()
    // Arrowhead
    ctx.beginPath()
    ctx.moveTo(arrowBaseX + arrowLen, arrowBaseY)
    ctx.lineTo(arrowBaseX + arrowLen - 9, arrowBaseY - 6)
    ctx.moveTo(arrowBaseX + arrowLen, arrowBaseY)
    ctx.lineTo(arrowBaseX + arrowLen - 9, arrowBaseY + 6)
    ctx.stroke()

    ctx.font = '400 13px IBM Plex Mono, monospace'
    ctx.fillStyle = 'rgba(180, 210, 240, 0.65)'
    ctx.textAlign = 'center'
    ctx.fillText('direction', arrowBaseX + arrowLen / 2, arrowBaseY + 22)
    ctx.textAlign = 'left'

    // ─── Fetch error indicator ───────────────────────────────
    if (fetchErrorRef.current) {
      ctx.font = '300 9px IBM Plex Mono, monospace'
      ctx.fillStyle = 'rgba(255, 180, 60, 0.6)'
      ctx.fillText('CORS PROXY  \u00b7  DEMO MODE', SAFE, H - SAFE + 10)
    }
  }, [])

  // ─── Animation loop ─────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // HiDPI support
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr
    canvas.height = H * dpr
    canvas.style.width = `${W}px`
    canvas.style.height = `${H}px`
    ctx.scale(dpr, dpr)

    // Initialize
    initCoasts()
    initParticles()
    initWaves()

    // First fetch
    void fetchData()

    // Poll interval
    const pollId = setInterval(() => { void fetchData() }, POLL_INTERVAL)

    // Render loop
    let animId = 0
    const loop = (timestamp: number) => {
      // Throttle to ~30fps
      const elapsed = timestamp - lastFrameTimeRef.current
      if (elapsed >= FRAME_MS) {
        lastFrameTimeRef.current = timestamp - (elapsed % FRAME_MS)
        frameRef.current++
        render(ctx, timestamp)
      }
      animId = requestAnimationFrame(loop)
    }
    animId = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(animId)
      clearInterval(pollId)
    }
  }, [initCoasts, initParticles, initWaves, fetchData, render])

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0"
      style={{ width: W, height: H }}
    />
  )
}
