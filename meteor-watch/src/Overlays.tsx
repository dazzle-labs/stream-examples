import { useEffect, useRef, useState, useCallback } from 'react'
import type { MeteorPoint, MeteorStats } from './types'

/* ------------------------------------------------------------------ */
/*  Deterministic hash for noise texture                               */
/* ------------------------------------------------------------------ */

function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263 + 1013904223) | 0
  h = ((h >> 13) ^ h) | 0
  h = (h * 1274126177 + 1013904223) | 0
  return ((h >> 16) & 0xff) / 255
}

/* ------------------------------------------------------------------ */
/*  Galactic plane approximate declination at a given RA               */
/* ------------------------------------------------------------------ */

function galacticPlaneDec(raDeg: number): number {
  // Rough analytic approximation of the galactic plane in equatorial coords.
  // The galactic plane peaks near dec +60 around RA ~280 (Cygnus)
  // and dips to dec -60 near RA ~100 (between Monoceros/Puppis).
  const raRad = (raDeg - 280) * Math.PI / 180
  return 60 * Math.sin(raRad) * -1 + 2
}

/* ------------------------------------------------------------------ */
/*  TitleBar                                                           */
/* ------------------------------------------------------------------ */

export function TitleBar({ stats }: { stats: MeteorStats }) {
  const [utcTime, setUtcTime] = useState(() => formatUTC())
  const [sinceUpdate, setSinceUpdate] = useState('')

  useEffect(() => {
    const tick = () => {
      setUtcTime(formatUTC())
      if (stats.lastUpdated > 0) {
        const agoSec = Math.round((Date.now() - stats.lastUpdated) / 1000)
        if (agoSec < 60) setSinceUpdate(`${agoSec}s ago`)
        else setSinceUpdate(`${Math.floor(agoSec / 60)}m ago`)
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [stats.lastUpdated])

  return (
    <div
      className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between pointer-events-none"
      style={{
        padding: '16px 28px',
        height: 58,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.65) 60%, transparent 100%)',
      }}
    >
      <div className="flex items-center gap-4">
        {/* Pulsing live indicator */}
        <span
          className="inline-block rounded-full animate-live-pulse"
          style={{ width: 9, height: 9, background: 'var(--color-accent)' }}
        />
        <span
          className="font-mono uppercase"
          style={{ fontSize: 15, letterSpacing: '0.22em', fontWeight: 600 }}
        >
          Meteor Watch
        </span>
        {stats.dataAge && (
          <span
            className="font-mono"
            style={{
              fontSize: 11,
              color: 'var(--color-text-dim)',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '2px 8px',
              letterSpacing: '0.04em',
            }}
          >
            {stats.dataAge}
          </span>
        )}
        {/* Signal indicator */}
        <div className="flex items-center gap-1" style={{ marginLeft: 4 }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="animate-signal-tick"
              style={{
                display: 'inline-block',
                width: 2,
                height: 6 + i * 3,
                background: 'var(--color-accent)',
                opacity: 0.4,
                animationDelay: `${i * 0.4}s`,
              }}
            />
          ))}
        </div>
      </div>

      <span
        className="font-mono"
        style={{ fontSize: 14, color: 'var(--color-text-dim)', letterSpacing: '0.06em' }}
      >
        {stats.totalCount.toLocaleString()} meteors tracked
        <span style={{ margin: '0 10px', opacity: 0.3 }}>|</span>
        {sinceUpdate && (<>updated {sinceUpdate}<span style={{ margin: '0 10px', opacity: 0.3 }}>|</span></>)}
        next in {stats.refreshIntervalMin}m
        <span style={{ margin: '0 10px', opacity: 0.3 }}>|</span>
        {utcTime} UTC
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  StatsBar                                                           */
/* ------------------------------------------------------------------ */

export function StatsBar({ stats }: { stats: MeteorStats }) {
  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none font-mono"
      style={{
        height: 40,
        background: 'rgba(0,0,0,0.88)',
        borderTop: '1px solid rgba(245, 158, 11, 0.25)',
      }}
    >
      {/* Amber accent line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background: 'rgba(245, 158, 11, 0.35)',
        }}
      />
      <div
        className="flex items-center justify-center gap-7"
        style={{
          height: '100%',
          fontSize: 12,
          letterSpacing: '0.06em',
        }}
      >
        {stats.showerBreakdown.slice(0, 4).map((s) => (
          <span key={s.name}>
            <span
              style={{
                color: s.name === 'Random' ? 'var(--color-text-dim)' : 'var(--color-accent)',
                fontSize: 11,
              }}
            >
              {s.name.toUpperCase()}
            </span>
            {' '}
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
              {s.count}
            </span>
          </span>
        ))}
        <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
        <span style={{ color: 'var(--color-text-dim)', fontSize: 11 }}>
          AVG SPEED{' '}
          <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
            {stats.avgVelocity} KM/S
          </span>
        </span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  RadiantMap -- cinematic full-screen sky chart with density heatmap  */
/* ------------------------------------------------------------------ */

interface DensityCell {
  count: number
  totalVelocity: number
  showerCounts: Map<number, number>
  newestTime: number
  oldestTime: number
}

interface DetectedCluster {
  centerRA: number
  centerDec: number
  count: number
  avgVelocity: number
  name: string
  isActive: boolean
  radius: number
  oldestTime: number
  newestTime: number
}

interface ComputedDensity {
  grid: DensityCell[][]
  clusters: DetectedCluster[]
  maxCount: number
  globalMinTime: number
  globalMaxTime: number
}

const RA_BINS = 180
const DEC_BINS = 90
const BIN_RA = 360 / RA_BINS   // 2 degrees
const BIN_DEC = 180 / DEC_BINS // 2 degrees

const SKY_REGIONS: readonly { label: string, ra: number, dec: number }[] = [
  { label: 'Orion', ra: 85, dec: 5 },
  { label: 'Gemini', ra: 105, dec: 25 },
  { label: 'Leo', ra: 150, dec: 15 },
  { label: 'Perseus', ra: 50, dec: 42 },
  { label: 'Taurus', ra: 65, dec: 18 },
  { label: 'Aquarius', ra: 335, dec: -12 },
  { label: 'Virgo', ra: 195, dec: -5 },
  { label: 'Scorpius', ra: 250, dec: -30 },
  { label: 'Cygnus', ra: 310, dec: 40 },
  { label: 'Sagittarius', ra: 280, dec: -28 },
  { label: 'Draco', ra: 260, dec: 65 },
  { label: 'Andromeda', ra: 10, dec: 38 },
]

// Known shower radiants for cluster identification (RA, Dec in degrees)
const KNOWN_RADIANTS: readonly { name: string, ra: number, dec: number, iauNo: number }[] = [
  { name: 'Quadrantids', ra: 230, dec: 49, iauNo: 4 },
  { name: 'Lyrids', ra: 271, dec: 34, iauNo: 17 },
  { name: 'Eta Aquariids', ra: 338, dec: -1, iauNo: 31 },
  { name: 'Arietids', ra: 44, dec: 24, iauNo: 6 },
  { name: 'Southern Delta Aquariids', ra: 340, dec: -16, iauNo: 2 },
  { name: 'Perseids', ra: 48, dec: 58, iauNo: 7 },
  { name: 'Orionids', ra: 95, dec: 16, iauNo: 8 },
  { name: 'Southern Taurids', ra: 52, dec: 13, iauNo: 5 },
  { name: 'Northern Taurids', ra: 58, dec: 22, iauNo: 10 },
  { name: 'Leonids', ra: 152, dec: 22, iauNo: 11 },
  { name: 'Geminids', ra: 112, dec: 33, iauNo: 13 },
  { name: 'Ursids', ra: 217, dec: 76, iauNo: 15 },
  { name: 'Capricornids', ra: 307, dec: -10, iauNo: 1 },
  { name: 'Draconids', ra: 262, dec: 54, iauNo: 69 },
]

function densityColor(t: number, recencyFactor: number): [number, number, number, number] {
  // t is 0..1 normalized density, recencyFactor is 0..1 (newer = higher)
  const brightness = 0.5 + recencyFactor * 0.5

  if (t < 0.15) {
    // Dark blue
    const s = t / 0.15
    return [
      40 * s * brightness,
      60 * s * brightness,
      160 * s * brightness,
      s * 0.35 * brightness,
    ]
  }
  if (t < 0.35) {
    // Blue to cyan/teal
    const s = (t - 0.15) / 0.2
    return [
      (40 + 20 * s) * brightness,
      (60 + 120 * s) * brightness,
      (160 + 40 * s) * brightness,
      (0.35 + s * 0.2) * brightness,
    ]
  }
  if (t < 0.6) {
    // Cyan/teal to amber
    const s = (t - 0.35) / 0.25
    return [
      (60 + 185 * s) * brightness,
      (180 - 22 * s) * brightness,
      (200 - 189 * s) * brightness,
      (0.55 + s * 0.15) * brightness,
    ]
  }
  // Amber to white-amber
  const s = (t - 0.6) / 0.4
  return [
    Math.min(255, (245 + 10 * s) * brightness),
    Math.min(255, (158 + 72 * s) * brightness),
    Math.min(255, (11 + 100 * s) * brightness),
    Math.min(1, (0.7 + s * 0.3) * brightness),
  ]
}

// Safe 2D grid access for strict TypeScript with noUncheckedIndexedAccess.
// These throw at runtime if indices are out of bounds, satisfying the type checker
// without type assertions.
function gridAt<T>(arr: T[][], di: number, ri: number): T {
  const row = arr[di]
  if (!row) throw new Error(`Row index ${di} out of bounds`)
  const val = row[ri]
  if (val === undefined) throw new Error(`Col index ${ri} out of bounds`)
  return val
}

function gridSet<T>(arr: T[][], di: number, ri: number, val: T): void {
  const row = arr[di]
  if (!row) throw new Error(`Row index ${di} out of bounds`)
  row[ri] = val
}

function computeDensityGrid(points: readonly MeteorPoint[]): ComputedDensity {
  // Initialize grid
  const grid: DensityCell[][] = Array.from({ length: DEC_BINS }, () =>
    Array.from({ length: RA_BINS }, (): DensityCell => ({
      count: 0,
      totalVelocity: 0,
      showerCounts: new Map(),
      newestTime: 0,
      oldestTime: Infinity,
    })),
  )

  let globalMinTime = Infinity
  let globalMaxTime = -Infinity

  // Bin all points
  for (const p of points) {
    const raIdx = Math.min(RA_BINS - 1, Math.max(0, Math.floor(p.radiantRA / BIN_RA)))
    const decIdx = Math.min(DEC_BINS - 1, Math.max(0, Math.floor((p.radiantDec + 90) / BIN_DEC)))
    const cell = gridAt(grid, decIdx, raIdx)
    cell.count++
    cell.totalVelocity += p.velocity

    const prev = cell.showerCounts.get(p.showerCode) ?? 0
    cell.showerCounts.set(p.showerCode, prev + 1)

    const t = new Date(p.timestamp.replace(' ', 'T') + 'Z').getTime()
    if (t > cell.newestTime) cell.newestTime = t
    if (t < cell.oldestTime) cell.oldestTime = t
    if (t < globalMinTime) globalMinTime = t
    if (t > globalMaxTime) globalMaxTime = t
  }

  // Find max count for normalization
  let maxCount = 0
  for (let di = 0; di < DEC_BINS; di++) {
    for (let ri = 0; ri < RA_BINS; ri++) {
      const c = gridAt(grid, di, ri).count
      if (c > maxCount) maxCount = c
    }
  }

  // Detect anomalous clusters
  const anomalous: boolean[][] = Array.from({ length: DEC_BINS }, () =>
    Array.from({ length: RA_BINS }, () => false),
  )

  for (let di = 0; di < DEC_BINS; di++) {
    for (let ri = 0; ri < RA_BINS; ri++) {
      const cellCount = gridAt(grid, di, ri).count
      if (cellCount <= 5) continue

      // Compute local 5x5 mean
      let sum = 0
      let n = 0
      for (let ddi = -2; ddi <= 2; ddi++) {
        for (let dri = -2; dri <= 2; dri++) {
          const ndi = di + ddi
          const nri = ((ri + dri) % RA_BINS + RA_BINS) % RA_BINS // wrap RA
          if (ndi >= 0 && ndi < DEC_BINS) {
            sum += gridAt(grid, ndi, nri).count
            n++
          }
        }
      }
      const localMean = sum / n
      if (cellCount > localMean * 3 && cellCount > 8) {
        gridSet(anomalous, di, ri, true)
      }
    }
  }

  // Group adjacent anomalous bins via flood fill
  const visited: boolean[][] = Array.from({ length: DEC_BINS }, () =>
    Array.from({ length: RA_BINS }, () => false),
  )
  const clusters: DetectedCluster[] = []

  for (let di = 0; di < DEC_BINS; di++) {
    for (let ri = 0; ri < RA_BINS; ri++) {
      if (!gridAt(anomalous, di, ri) || gridAt(visited, di, ri)) continue

      // Flood fill to collect this cluster
      const cells: [number, number][] = []
      const queue: [number, number][] = [[di, ri]]
      gridSet(visited, di, ri, true)

      while (queue.length > 0) {
        const popped = queue.pop()
        if (!popped) break
        const [cdi, cri] = popped
        cells.push([cdi, cri])

        for (const [ddi, dri] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
          const ndi = cdi + ddi
          const nri = ((cri + dri) % RA_BINS + RA_BINS) % RA_BINS
          if (ndi >= 0 && ndi < DEC_BINS && gridAt(anomalous, ndi, nri) && !gridAt(visited, ndi, nri)) {
            gridSet(visited, ndi, nri, true)
            queue.push([ndi, nri])
          }
        }
      }

      // Compute cluster properties
      let totalCount = 0
      let totalVel = 0
      let raSum = 0
      let decSum = 0
      let clusterOldest = Infinity
      let clusterNewest = 0
      const allShowers = new Map<number, number>()

      for (const [cdi, cri] of cells) {
        const cell = gridAt(grid, cdi, cri)
        totalCount += cell.count
        totalVel += cell.totalVelocity
        raSum += (cri + 0.5) * BIN_RA * cell.count
        decSum += ((cdi + 0.5) * BIN_DEC - 90) * cell.count
        if (cell.oldestTime < clusterOldest) clusterOldest = cell.oldestTime
        if (cell.newestTime > clusterNewest) clusterNewest = cell.newestTime

        for (const [shower, cnt] of cell.showerCounts) {
          allShowers.set(shower, (allShowers.get(shower) ?? 0) + cnt)
        }
      }

      const centerRA = raSum / totalCount
      const centerDec = decSum / totalCount
      const avgVelocity = Math.round(totalVel / totalCount)

      // Find dominant shower
      let dominantShower = -1
      let dominantCount = 0
      for (const [shower, cnt] of allShowers) {
        if (shower >= 0 && cnt > dominantCount) {
          dominantShower = shower
          dominantCount = cnt
        }
      }

      // Match to known radiant for naming
      let name = 'Unknown source'
      if (dominantShower >= 0) {
        const known = KNOWN_RADIANTS.find((k) => k.iauNo === dominantShower)
        if (known) {
          name = known.name
        } else {
          for (const k of KNOWN_RADIANTS) {
            const dra = Math.abs(centerRA - k.ra)
            const ddec = Math.abs(centerDec - k.dec)
            if (dra < 15 && ddec < 10) {
              name = k.name
              break
            }
          }
        }
      } else {
        for (const k of KNOWN_RADIANTS) {
          const dra = Math.min(Math.abs(centerRA - k.ra), 360 - Math.abs(centerRA - k.ra))
          const ddec = Math.abs(centerDec - k.dec)
          if (dra < 15 && ddec < 10) {
            name = k.name
            break
          }
        }
      }

      // Active = has detections within the last 12 hours
      const twelveHoursMs = 12 * 3_600_000
      const isActive = clusterNewest > (Date.now() - twelveHoursMs)

      // Compute radius from cell spread
      let maxDist = 0
      for (const [cdi, cri] of cells) {
        const cellRA = (cri + 0.5) * BIN_RA
        const cellDec = (cdi + 0.5) * BIN_DEC - 90
        const dist = Math.sqrt(
          Math.pow(cellRA - centerRA, 2) + Math.pow(cellDec - centerDec, 2),
        )
        if (dist > maxDist) maxDist = dist
      }

      clusters.push({
        centerRA,
        centerDec,
        count: totalCount,
        avgVelocity,
        name,
        isActive,
        radius: Math.max(maxDist + BIN_RA, 4),
        oldestTime: clusterOldest,
        newestTime: clusterNewest,
      })
    }
  }

  // Sort clusters by count descending
  clusters.sort((a, b) => b.count - a.count)

  return { grid, clusters, maxCount, globalMinTime: globalMinTime, globalMaxTime: globalMaxTime }
}

interface RadiantMapProps {
  points: readonly MeteorPoint[]
  onClusterCountChange?: (count: number) => void
}

export function RadiantMap({ points, onClusterCountChange }: RadiantMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const densityRef = useRef<ComputedDensity | null>(null)
  const prevPointsRef = useRef<readonly MeteorPoint[]>([])

  // Cluster reveal timestamps: keyed by "name-count" to detect new clusters
  const clusterRevealRef = useRef<Map<string, number>>(new Map())

  // Data refresh sweep state
  const sweepRef = useRef<number>(0) // timestamp when sweep started, 0 = inactive

  // Recompute density grid when the points array reference changes
  if (points !== prevPointsRef.current) {
    const hadPoints = prevPointsRef.current.length > 0
    prevPointsRef.current = points
    const prevClusterCount = densityRef.current?.clusters.length ?? 0
    densityRef.current = points.length > 0 ? computeDensityGrid(points) : null
    const newClusterCount = densityRef.current?.clusters.length ?? 0

    // Notify parent of cluster count changes
    if (newClusterCount > prevClusterCount && onClusterCountChange) {
      onClusterCountChange(newClusterCount)
    }

    // Trigger data refresh sweep if this is an update (not initial load)
    if (hadPoints && points.length > 0) {
      sweepRef.current = performance.now()
    }
  }

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = 1280
    const h = 720

    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h

    ctx.clearRect(0, 0, w, h)

    // Background
    ctx.fillStyle = '#050508'
    ctx.fillRect(0, 0, w, h)

    // Very subtle noise grain
    const noiseAlpha = 0.012
    for (let ny = 0; ny < h; ny += 6) {
      for (let nx = 0; nx < w; nx += 6) {
        const v = hash(nx + (time * 0.001) | 0, ny)
        if (v > 0.6) {
          ctx.fillStyle = `rgba(255,255,255,${noiseAlpha * v})`
          ctx.fillRect(nx, ny, 6, 6)
        }
      }
    }

    const padX = 40
    const padTop = 70
    const padBot = 48
    const chartW = w - padX * 2
    const chartH = h - padTop - padBot

    const toXY = (ra: number, dec: number): [number, number] => {
      const x = padX + (1 - ra / 360) * chartW
      const y = padTop + (1 - (dec + 90) / 180) * chartH
      return [x, y]
    }

    // Breathing grid pulse
    const gridBreath = 0.03 + 0.015 * Math.sin(time * 0.001)

    // Grid lines
    ctx.strokeStyle = `rgba(255, 255, 255, ${gridBreath})`
    ctx.lineWidth = 0.5

    for (let ra = 0; ra <= 360; ra += 30) {
      const [x] = toXY(ra, 0)
      ctx.beginPath()
      ctx.moveTo(x, padTop)
      ctx.lineTo(x, padTop + chartH)
      ctx.stroke()
    }

    for (let dec = -75; dec <= 75; dec += 15) {
      const [, y] = toXY(0, dec)
      ctx.beginPath()
      ctx.moveTo(padX, y)
      ctx.lineTo(padX + chartW, y)
      ctx.stroke()
    }

    // Galactic plane band
    ctx.beginPath()
    for (let ra = 0; ra <= 360; ra += 1) {
      const dec = galacticPlaneDec(ra)
      const [x, y] = toXY(ra, dec)
      if (ra === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = 'rgba(100, 80, 160, 0.045)'
    ctx.lineWidth = 40
    ctx.stroke()
    ctx.strokeStyle = 'rgba(140, 110, 200, 0.04)'
    ctx.lineWidth = 12
    ctx.stroke()
    ctx.lineWidth = 1

    // Celestial equator
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
    ctx.lineWidth = 1
    const [, eqY] = toXY(0, 0)
    ctx.beginPath()
    ctx.moveTo(padX, eqY)
    ctx.lineTo(padX + chartW, eqY)
    ctx.stroke()

    // Ecliptic
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.08)'
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    for (let ra = 0; ra <= 360; ra += 1) {
      const eclDec = 23.44 * Math.sin((ra - 90) * Math.PI / 180)
      const [x, y] = toXY(ra, eclDec)
      if (ra === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
    ctx.setLineDash([])

    // Axis labels
    ctx.font = '10px "JetBrains Mono", monospace'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)'
    ctx.textAlign = 'center'

    ctx.save()
    ctx.translate(14, padTop + chartH / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.fillText('NORTH', 0, 0)
    ctx.restore()

    const [, northY] = toXY(0, 80)
    ctx.textAlign = 'left'
    ctx.fillText('+80\u00B0', padX + 4, northY + 3)

    const [, southY] = toXY(0, -80)
    ctx.fillText('-80\u00B0', padX + 4, southY + 3)

    // Constellation labels with crosshair markers
    ctx.textAlign = 'center'
    for (const region of SKY_REGIONS) {
      const [x, y] = toXY(region.ra, region.dec)

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(x - 6, y)
      ctx.lineTo(x + 6, y)
      ctx.moveTo(x, y - 6)
      ctx.lineTo(x, y + 6)
      ctx.stroke()

      ctx.font = '13px "Inter", sans-serif'
      const textWidth = ctx.measureText(region.label).width
      ctx.fillStyle = 'rgba(5, 5, 8, 0.6)'
      ctx.fillRect(x - textWidth / 2 - 3, y - 20, textWidth + 6, 16)

      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
      ctx.fillText(region.label, x, y - 8)
    }

    // Density heatmap rendering
    const density = densityRef.current
    if (density && density.maxCount > 0) {
      const { grid, clusters, maxCount, globalMinTime, globalMaxTime } = density
      const timeSpan = globalMaxTime - globalMinTime || 1
      const breathePhase = Math.sin(time * 0.0015) * 0.5 + 0.5

      // Render density cells with additive blending for organic glow
      ctx.globalCompositeOperation = 'lighter'

      // Each cell is rendered as an oversized, soft rectangle for smooth blending
      // We render at 1.5x cell size with lower alpha so adjacent cells blend together
      const cellPixelW = chartW / RA_BINS
      const cellPixelH = chartH / DEC_BINS
      const oversize = 1.5

      for (let di = 0; di < DEC_BINS; di++) {
        for (let ri = 0; ri < RA_BINS; ri++) {
          const cell = gridAt(grid, di, ri)
          if (cell.count === 0) continue

          const t = cell.count / maxCount
          const recency = cell.newestTime > 0
            ? (cell.newestTime - globalMinTime) / timeSpan
            : 0.5

          // Newest cells breathe
          const breatheFactor = recency > 0.8
            ? 0.75 + 0.25 * breathePhase
            : 1.0

          const [r, g, b, a] = densityColor(t, recency)
          const finalAlpha = Math.min(1, a * breatheFactor * 0.7)

          // Cell center in RA/Dec
          const cellRA = (ri + 0.5) * BIN_RA
          const cellDec = (di + 0.5) * BIN_DEC - 90
          const [cx, cy] = toXY(cellRA, cellDec)

          // Render oversized soft rectangle
          const rw = cellPixelW * oversize
          const rh = cellPixelH * oversize

          // Use radial gradient for organic look
          const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rw, rh) * 0.7)
          grad.addColorStop(0, `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${finalAlpha})`)
          grad.addColorStop(0.6, `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${finalAlpha * 0.4})`)
          grad.addColorStop(1, `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, 0)`)
          ctx.fillStyle = grad
          ctx.fillRect(cx - rw, cy - rh, rw * 2, rh * 2)

          // For high-density cells, add a brighter core
          if (t > 0.5) {
            const coreAlpha = (t - 0.5) * 0.6 * breatheFactor
            const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rw, rh) * 0.3)
            coreGrad.addColorStop(0, `rgba(255, 240, 200, ${coreAlpha})`)
            coreGrad.addColorStop(1, `rgba(255, 240, 200, 0)`)
            ctx.fillStyle = coreGrad
            ctx.fillRect(cx - rw * 0.5, cy - rh * 0.5, rw, rh)
          }
        }
      }

      ctx.globalCompositeOperation = 'source-over'

      // Render cluster highlights with reveal animation
      const clusterPulse = Math.sin(time * 0.002) * 0.5 + 0.5
      const revealMap = clusterRevealRef.current

      for (let ci = 0; ci < Math.min(clusters.length, 6); ci++) {
        const cluster = clusters[ci]
        if (!cluster) continue

        // Track reveal time per cluster
        const clusterKey = `${cluster.name}-${cluster.centerRA.toFixed(0)}-${cluster.centerDec.toFixed(0)}`
        if (!revealMap.has(clusterKey)) {
          revealMap.set(clusterKey, time)
        }
        const revealTime = revealMap.get(clusterKey) ?? time
        const revealAge = (time - revealTime) / 1000 // seconds since reveal

        const [cx, cy] = toXY(cluster.centerRA, cluster.centerDec)

        // Convert radius from degrees to pixels (approximate)
        const radiusPixelsX = (cluster.radius / 360) * chartW
        const radiusPixelsY = (cluster.radius / 180) * chartH
        const radiusPx = Math.max(radiusPixelsX, radiusPixelsY, 12)

        // Animated ring: arc grows from 0 to 2*PI over first 3 seconds
        const ringProgress = Math.min(1, revealAge / 3)
        const ringArc = ringProgress * Math.PI * 2

        // Dashed circle around cluster
        const ringAlpha = cluster.isActive
          ? 0.5 + 0.3 * clusterPulse
          : 0.25 + 0.1 * clusterPulse
        const ringColor = cluster.isActive
          ? `rgba(255, 200, 50, ${ringAlpha})`
          : `rgba(245, 158, 11, ${ringAlpha})`

        ctx.strokeStyle = ringColor
        ctx.lineWidth = cluster.isActive ? 1.5 : 1
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.ellipse(cx, cy, radiusPx, radiusPx * 0.8, 0, 0, ringArc)
        ctx.stroke()
        ctx.setLineDash([])

        // Only show labels after ring starts appearing
        if (ringProgress < 0.1) continue

        // Callout line and label
        const labelOffsetX = 20 + radiusPx
        const labelOffsetY = -10 - ci * 6
        const labelX = cx + labelOffsetX
        const labelY = cy + labelOffsetY

        // Clamp label to stay within chart bounds
        const clampedLabelX = Math.min(Math.max(labelX, padX + 60), padX + chartW - 180)
        const clampedLabelY = Math.min(Math.max(labelY, padTop + 20), padTop + chartH - 50)

        // Callout line with fade-in
        const calloutAlpha = Math.min(1, ringProgress * 2)
        ctx.strokeStyle = `rgba(245, 158, 11, ${(0.2 + 0.1 * clusterPulse) * calloutAlpha})`
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(cx + radiusPx * 0.7, cy - radiusPx * 0.3)
        ctx.lineTo(clampedLabelX, clampedLabelY + 8)
        ctx.stroke()

        // Label content
        const labelLine1 = cluster.name.toUpperCase()
        const labelLine2 = `${cluster.count} meteors  ${cluster.avgVelocity} km/s`
        const labelLine3 = formatTimeWindow(cluster.oldestTime, cluster.newestTime)

        ctx.font = '10px "JetBrains Mono", monospace'
        const line1W = ctx.measureText(labelLine1).width
        const line2W = ctx.measureText(labelLine2).width
        const line3W = ctx.measureText(labelLine3).width
        const panelW = Math.max(line1W, line2W, line3W) + 16
        const panelH = 44

        ctx.fillStyle = 'rgba(5, 5, 8, 0.85)'
        ctx.fillRect(clampedLabelX - 4, clampedLabelY - 4, panelW, panelH)

        // Amber accent bar on left of panel
        ctx.fillStyle = cluster.isActive
          ? `rgba(255, 200, 50, ${0.6 + 0.3 * clusterPulse})`
          : 'rgba(245, 158, 11, 0.5)'
        ctx.fillRect(clampedLabelX - 4, clampedLabelY - 4, 2, panelH)

        // Label text
        ctx.textAlign = 'left'
        ctx.fillStyle = cluster.isActive
          ? `rgba(255, 220, 80, ${0.8 + 0.2 * clusterPulse})`
          : 'rgba(245, 200, 120, 0.8)'
        ctx.fillText(labelLine1, clampedLabelX + 4, clampedLabelY + 8)

        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
        ctx.fillText(labelLine2, clampedLabelX + 4, clampedLabelY + 20)

        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
        ctx.font = '9px "JetBrains Mono", monospace'
        ctx.fillText(labelLine3, clampedLabelX + 4, clampedLabelY + 33)

        // "ACTIVE" badge
        if (cluster.isActive && revealAge > 2) {
          const badgeX = clampedLabelX + panelW + 4
          const badgeText = 'ACTIVE'
          ctx.font = '8px "JetBrains Mono", monospace'
          const badgeW = ctx.measureText(badgeText).width + 8

          ctx.fillStyle = `rgba(255, 180, 30, ${0.15 + 0.1 * clusterPulse})`
          ctx.fillRect(badgeX, clampedLabelY - 2, badgeW, 14)
          ctx.strokeStyle = `rgba(255, 200, 50, ${0.4 + 0.2 * clusterPulse})`
          ctx.lineWidth = 0.5
          ctx.strokeRect(badgeX, clampedLabelY - 2, badgeW, 14)

          ctx.fillStyle = `rgba(255, 220, 80, ${0.8 + 0.2 * clusterPulse})`
          ctx.fillText(badgeText, badgeX + 4, clampedLabelY + 8)
        }
      }
    }

    // Corner brackets (camera viewfinder style)
    const bracketLen = 24
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
    ctx.lineWidth = 1

    ctx.beginPath()
    ctx.moveTo(padX, padTop + bracketLen)
    ctx.lineTo(padX, padTop)
    ctx.lineTo(padX + bracketLen, padTop)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(padX + chartW - bracketLen, padTop)
    ctx.lineTo(padX + chartW, padTop)
    ctx.lineTo(padX + chartW, padTop + bracketLen)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(padX, padTop + chartH - bracketLen)
    ctx.lineTo(padX, padTop + chartH)
    ctx.lineTo(padX + bracketLen, padTop + chartH)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(padX + chartW - bracketLen, padTop + chartH)
    ctx.lineTo(padX + chartW, padTop + chartH)
    ctx.lineTo(padX + chartW, padTop + chartH - bracketLen)
    ctx.stroke()

    // Legend (top right) with density color scale
    ctx.globalCompositeOperation = 'source-over'

    const legendX = w - 240
    const legendY = padTop + 14

    ctx.fillStyle = 'rgba(5, 5, 8, 0.7)'
    ctx.fillRect(legendX - 10, legendY - 10, 200, 88)

    ctx.font = '10px "JetBrains Mono", monospace'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
    ctx.textAlign = 'left'
    ctx.fillText('RADIANT DENSITY', legendX, legendY + 4)

    // Draw color scale bar
    const scaleY = legendY + 14
    const scaleW = 140
    const scaleH = 8
    for (let i = 0; i < scaleW; i++) {
      const t = i / scaleW
      const [r, g, b, a] = densityColor(t, 0.8)
      ctx.fillStyle = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`
      ctx.fillRect(legendX + i, scaleY, 1, scaleH)
    }

    // Scale labels
    ctx.font = '8px "JetBrains Mono", monospace'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.textAlign = 'left'
    ctx.fillText('LOW', legendX, scaleY + 18)
    ctx.textAlign = 'right'
    ctx.fillText('HIGH', legendX + scaleW, scaleY + 18)

    // Cluster indicator
    ctx.textAlign = 'left'
    ctx.font = '10px "JetBrains Mono", monospace'
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)'
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.arc(legendX + 6, scaleY + 34, 5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)'
    ctx.fillText('Detected cluster', legendX + 18, scaleY + 37)

    // Brightness hint
    ctx.font = '8px "JetBrains Mono", monospace'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)'
    ctx.fillText('BRIGHTER = NEWER DATA', legendX, scaleY + 52)

    // ── Post-processing ──

    // Bloom: for top-5% density cells, draw a large blurred radial glow
    if (density && density.maxCount > 0) {
      const { grid: dGrid, maxCount: dMax } = density
      const bloomThreshold = 0.95
      ctx.globalCompositeOperation = 'lighter'

      for (let di = 0; di < DEC_BINS; di++) {
        for (let ri = 0; ri < RA_BINS; ri++) {
          const cell = gridAt(dGrid, di, ri)
          if (cell.count === 0) continue
          const t = cell.count / dMax
          if (t < bloomThreshold) continue

          const cellRA = (ri + 0.5) * BIN_RA
          const cellDec = (di + 0.5) * BIN_DEC - 90
          const [bx, by] = toXY(cellRA, cellDec)

          const cellPixW = chartW / RA_BINS
          const cellPixH = chartH / DEC_BINS
          const bloomRadius = Math.max(cellPixW, cellPixH) * 3

          const bloomGrad = ctx.createRadialGradient(bx, by, 0, bx, by, bloomRadius)
          bloomGrad.addColorStop(0, 'rgba(255, 220, 160, 0.02)')
          bloomGrad.addColorStop(0.5, 'rgba(255, 180, 100, 0.008)')
          bloomGrad.addColorStop(1, 'rgba(255, 160, 80, 0)')
          ctx.fillStyle = bloomGrad
          ctx.fillRect(bx - bloomRadius, by - bloomRadius, bloomRadius * 2, bloomRadius * 2)
        }
      }
      ctx.globalCompositeOperation = 'source-over'
    }

    // Data refresh sweep: horizontal scan line sweeping left-to-right over 1 second
    const sweepStart = sweepRef.current
    if (sweepStart > 0) {
      const sweepAge = (time - sweepStart) / 1000
      if (sweepAge < 1) {
        const sweepX = padX + sweepAge * chartW
        const sweepAlpha = 0.15 * (1 - sweepAge)

        ctx.strokeStyle = `rgba(34, 211, 238, ${sweepAlpha})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(sweepX, padTop)
        ctx.lineTo(sweepX, padTop + chartH)
        ctx.stroke()

        // Trailing glow
        const trailGrad = ctx.createLinearGradient(sweepX - 40, 0, sweepX, 0)
        trailGrad.addColorStop(0, 'rgba(34, 211, 238, 0)')
        trailGrad.addColorStop(1, `rgba(34, 211, 238, ${sweepAlpha * 0.3})`)
        ctx.fillStyle = trailGrad
        ctx.fillRect(sweepX - 40, padTop, 40, chartH)
      } else {
        sweepRef.current = 0
      }
    }

    // Canvas vignette (secondary layer, subtle)
    const vigGrad = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.75)
    vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)')
    vigGrad.addColorStop(1, 'rgba(0, 0, 0, 0.15)')
    ctx.fillStyle = vigGrad
    ctx.fillRect(0, 0, w, h)

    // Dithering: faint 1-bit noise to reduce color banding
    // Sparse sampling (every 8px) for performance
    for (let ny = 0; ny < h; ny += 8) {
      for (let nx = 0; nx < w; nx += 8) {
        const v = hash(nx + ((time * 0.003) | 0), ny + ((time * 0.002) | 0))
        // +-1/255 noise, rendered as very faint white or black dots
        if (v > 0.5) {
          ctx.fillStyle = `rgba(255, 255, 255, ${(v - 0.5) * 0.008})`
        } else {
          ctx.fillStyle = `rgba(0, 0, 0, ${(0.5 - v) * 0.008})`
        }
        ctx.fillRect(nx, ny, 8, 8)
      }
    }

    // Request next frame
    animRef.current = requestAnimationFrame(draw)
  }, [points])

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [draw])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0"
      style={{ width: 1280, height: 720 }}
    />
  )
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatTimeWindow(oldest: number, newest: number): string {
  const fmtDate = (ms: number): string => {
    const d = new Date(ms)
    const mon = d.toLocaleString('en', { month: 'short', timeZone: 'UTC' })
    return `${mon} ${d.getUTCDate()}`
  }
  const spanMs = newest - oldest
  const spanHours = Math.round(spanMs / 3_600_000)
  if (spanHours < 24) {
    return `${fmtDate(newest)}, active ${spanHours}h`
  }
  const spanDays = Math.round(spanHours / 24)
  return `${fmtDate(oldest)} – ${fmtDate(newest)} (${spanDays}d)`
}

function formatUTC(): string {
  const now = new Date()
  const hh = String(now.getUTCHours()).padStart(2, '0')
  const mm = String(now.getUTCMinutes()).padStart(2, '0')
  const ss = String(now.getUTCSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}
