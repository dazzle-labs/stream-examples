import { useEffect, useRef } from 'react'

interface OrbitalCanvasProps {
  trajectoryProgress: number
  isPreLaunch: boolean
  moonOrbitAngle: number
}

// Color palette
const CYAN = '#00e5ff'
const CYAN_DIM = 'rgba(0, 229, 255, 0.3)'
const CYAN_GLOW = 'rgba(0, 229, 255, 0.5)'
const AMBER = '#f5a623'
const AMBER_GLOW = 'rgba(245, 166, 35, 0.6)'
const GRID_COLOR = 'rgba(26, 35, 64, 0.4)'
const STAR_COLOR_WARM = 'rgba(255, 248, 240, 0.8)'
const STAR_COLOR_COOL = 'rgba(200, 220, 255, 0.8)'

interface Star {
  x: number
  y: number
  size: number
  twinkleOffset: number
  twinkleSpeed: number
  brightness: number
  warm: boolean
}

// Pre-generate stars once
let stars: Star[] | null = null
function getStars(width: number, height: number): Star[] {
  if (stars && stars.length > 0) return stars
  stars = []
  for (let i = 0; i < 400; i++) {
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2.2 + 0.4,
      twinkleOffset: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.08 + Math.random() * 0.5,
      brightness: 0.3 + Math.random() * 0.7,
      warm: Math.random() > 0.6,
    })
  }
  return stars
}

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, earthX: number, earthY: number) {
  // Background graph-paper grid
  ctx.strokeStyle = GRID_COLOR
  ctx.lineWidth = 0.3

  const gridSpacing = 40
  for (let y = 0; y < height; y += gridSpacing) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }
  for (let x = 0; x < width; x += gridSpacing) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }

  // Axis crosshair through Earth's center
  ctx.strokeStyle = 'rgba(100, 180, 255, 0.08)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, earthY)
  ctx.lineTo(width, earthY)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(earthX, 0)
  ctx.lineTo(earthX, height)
  ctx.stroke()
}

function drawStars(ctx: CanvasRenderingContext2D, width: number, height: number, time: number) {
  const starList = getStars(width, height)
  for (const star of starList) {
    // ~20% of stars have noticeable twinkle, rest are steady
    const shouldTwinkle = star.twinkleSpeed > 0.35
    const twinkle = shouldTwinkle
      ? star.brightness * (0.4 + 0.6 * ((Math.sin(time * star.twinkleSpeed + star.twinkleOffset) + 1) / 2))
      : star.brightness
    ctx.globalAlpha = twinkle
    ctx.fillStyle = star.warm ? STAR_COLOR_WARM : STAR_COLOR_COOL
    ctx.beginPath()
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

function drawEarth(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number) {
  // Outer atmosphere glow — soft blue halo
  const outerGlow = ctx.createRadialGradient(cx, cy, radius, cx, cy, radius + 18)
  outerGlow.addColorStop(0, 'rgba(80, 160, 255, 0.35)')
  outerGlow.addColorStop(0.4, 'rgba(60, 130, 255, 0.15)')
  outerGlow.addColorStop(1, 'rgba(40, 100, 255, 0)')
  ctx.fillStyle = outerGlow
  ctx.beginPath()
  ctx.arc(cx, cy, radius + 18, 0, Math.PI * 2)
  ctx.fill()

  // Wider diffuse glow
  const diffuseGlow = ctx.createRadialGradient(cx, cy, radius * 0.5, cx, cy, radius * 2.2)
  diffuseGlow.addColorStop(0, 'rgba(60, 130, 255, 0.12)')
  diffuseGlow.addColorStop(0.5, 'rgba(40, 100, 200, 0.05)')
  diffuseGlow.addColorStop(1, 'rgba(30, 60, 150, 0)')
  ctx.fillStyle = diffuseGlow
  ctx.beginPath()
  ctx.arc(cx, cy, radius * 2.2, 0, Math.PI * 2)
  ctx.fill()

  // Earth body — base ocean blue
  const earthBase = ctx.createRadialGradient(
    cx - radius * 0.35, cy - radius * 0.35, radius * 0.05,
    cx + radius * 0.1, cy + radius * 0.1, radius,
  )
  earthBase.addColorStop(0, '#6aafe8')
  earthBase.addColorStop(0.25, '#4a90d9')
  earthBase.addColorStop(0.5, '#2a6db5')
  earthBase.addColorStop(0.75, '#1a4a7a')
  earthBase.addColorStop(1, '#0d2844')
  ctx.fillStyle = earthBase
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.fill()

  // Continent-like patches — darker green-brown areas
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.clip()

  // Large continent patch (upper-right, like Africa/Europe)
  const cont1 = ctx.createRadialGradient(
    cx + radius * 0.15, cy - radius * 0.1, 0,
    cx + radius * 0.15, cy - radius * 0.1, radius * 0.45,
  )
  cont1.addColorStop(0, 'rgba(60, 100, 50, 0.35)')
  cont1.addColorStop(0.5, 'rgba(80, 110, 60, 0.2)')
  cont1.addColorStop(1, 'rgba(60, 100, 50, 0)')
  ctx.fillStyle = cont1
  ctx.beginPath()
  ctx.arc(cx + radius * 0.15, cy - radius * 0.1, radius * 0.45, 0, Math.PI * 2)
  ctx.fill()

  // Second continent patch (left, like Americas)
  const cont2 = ctx.createRadialGradient(
    cx - radius * 0.35, cy + radius * 0.05, 0,
    cx - radius * 0.35, cy + radius * 0.05, radius * 0.35,
  )
  cont2.addColorStop(0, 'rgba(70, 110, 55, 0.3)')
  cont2.addColorStop(0.6, 'rgba(80, 100, 50, 0.15)')
  cont2.addColorStop(1, 'rgba(50, 80, 40, 0)')
  ctx.fillStyle = cont2
  ctx.beginPath()
  ctx.arc(cx - radius * 0.35, cy + radius * 0.05, radius * 0.35, 0, Math.PI * 2)
  ctx.fill()

  // Third patch (lower, like Antarctica/Australia)
  const cont3 = ctx.createRadialGradient(
    cx + radius * 0.3, cy + radius * 0.4, 0,
    cx + radius * 0.3, cy + radius * 0.4, radius * 0.25,
  )
  cont3.addColorStop(0, 'rgba(100, 120, 80, 0.25)')
  cont3.addColorStop(1, 'rgba(80, 100, 60, 0)')
  ctx.fillStyle = cont3
  ctx.beginPath()
  ctx.arc(cx + radius * 0.3, cy + radius * 0.4, radius * 0.25, 0, Math.PI * 2)
  ctx.fill()

  // Ice cap highlights
  const polar = ctx.createRadialGradient(
    cx - radius * 0.05, cy - radius * 0.75, 0,
    cx - radius * 0.05, cy - radius * 0.75, radius * 0.35,
  )
  polar.addColorStop(0, 'rgba(220, 240, 255, 0.2)')
  polar.addColorStop(1, 'rgba(200, 220, 240, 0)')
  ctx.fillStyle = polar
  ctx.beginPath()
  ctx.arc(cx - radius * 0.05, cy - radius * 0.75, radius * 0.35, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()

  // Specular highlight (upper-left, sphere illusion)
  const specular = ctx.createRadialGradient(
    cx - radius * 0.35, cy - radius * 0.35, 0,
    cx - radius * 0.2, cy - radius * 0.2, radius * 0.6,
  )
  specular.addColorStop(0, 'rgba(180, 220, 255, 0.25)')
  specular.addColorStop(0.5, 'rgba(140, 190, 255, 0.08)')
  specular.addColorStop(1, 'rgba(100, 160, 255, 0)')
  ctx.fillStyle = specular
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.fill()

  // Shadow on lower-right (terminator darkening)
  const shadow = ctx.createRadialGradient(
    cx + radius * 0.5, cy + radius * 0.5, radius * 0.2,
    cx + radius * 0.3, cy + radius * 0.3, radius * 1.1,
  )
  shadow.addColorStop(0, 'rgba(0, 5, 20, 0.5)')
  shadow.addColorStop(0.5, 'rgba(0, 5, 20, 0.25)')
  shadow.addColorStop(1, 'rgba(0, 5, 20, 0)')
  ctx.fillStyle = shadow
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.fill()

  // Atmosphere rim — bright edge
  ctx.strokeStyle = 'rgba(100, 180, 255, 0.45)'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.arc(cx, cy, radius + 1, 0, Math.PI * 2)
  ctx.stroke()

  // Second thinner rim
  ctx.strokeStyle = 'rgba(120, 200, 255, 0.2)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2)
  ctx.stroke()

  // Label
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
  ctx.font = '11px "IBM Plex Sans", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('EARTH', cx, cy + radius + 24)
}

function drawMoon(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number) {
  // Silver glow halo
  const moonGlow = ctx.createRadialGradient(cx, cy, radius * 0.6, cx, cy, radius * 2.5)
  moonGlow.addColorStop(0, 'rgba(200, 205, 215, 0.2)')
  moonGlow.addColorStop(0.5, 'rgba(180, 185, 195, 0.08)')
  moonGlow.addColorStop(1, 'rgba(160, 165, 175, 0)')
  ctx.fillStyle = moonGlow
  ctx.beginPath()
  ctx.arc(cx, cy, radius * 2.5, 0, Math.PI * 2)
  ctx.fill()

  // Moon body — base grey with light/shadow
  const moonBase = ctx.createRadialGradient(
    cx - radius * 0.25, cy - radius * 0.25, radius * 0.05,
    cx + radius * 0.1, cy + radius * 0.1, radius,
  )
  moonBase.addColorStop(0, '#d8d8e0')
  moonBase.addColorStop(0.3, '#c0c0c8')
  moonBase.addColorStop(0.6, '#a0a0a8')
  moonBase.addColorStop(1, '#505058')
  ctx.fillStyle = moonBase
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.fill()

  // Crater details — multiple dark spots
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.clip()

  const craters: Array<{ dx: number, dy: number, r: number, alpha: number }> = [
    { dx: 0.3, dy: -0.2, r: 0.18, alpha: 0.35 },
    { dx: -0.25, dy: 0.3, r: 0.14, alpha: 0.3 },
    { dx: 0.1, dy: 0.45, r: 0.1, alpha: 0.25 },
    { dx: -0.4, dy: -0.15, r: 0.12, alpha: 0.3 },
    { dx: 0.35, dy: 0.2, r: 0.08, alpha: 0.2 },
    { dx: -0.1, dy: -0.4, r: 0.15, alpha: 0.25 },
    { dx: 0.0, dy: 0.1, r: 0.2, alpha: 0.2 },
    { dx: -0.35, dy: 0.1, r: 0.09, alpha: 0.25 },
  ]

  for (const crater of craters) {
    const craterGrad = ctx.createRadialGradient(
      cx + crater.dx * radius, cy + crater.dy * radius, 0,
      cx + crater.dx * radius, cy + crater.dy * radius, crater.r * radius,
    )
    craterGrad.addColorStop(0, `rgba(60, 60, 68, ${crater.alpha})`)
    craterGrad.addColorStop(0.7, `rgba(70, 70, 78, ${crater.alpha * 0.5})`)
    craterGrad.addColorStop(1, 'rgba(80, 80, 88, 0)')
    ctx.fillStyle = craterGrad
    ctx.beginPath()
    ctx.arc(cx + crater.dx * radius, cy + crater.dy * radius, crater.r * radius, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()

  // Specular highlight
  const moonSpec = ctx.createRadialGradient(
    cx - radius * 0.3, cy - radius * 0.3, 0,
    cx - radius * 0.15, cy - radius * 0.15, radius * 0.5,
  )
  moonSpec.addColorStop(0, 'rgba(240, 240, 250, 0.2)')
  moonSpec.addColorStop(1, 'rgba(200, 200, 210, 0)')
  ctx.fillStyle = moonSpec
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.fill()

  // Rim
  ctx.strokeStyle = 'rgba(180, 185, 200, 0.35)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(cx, cy, radius + 0.5, 0, Math.PI * 2)
  ctx.stroke()

  // Label
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
  ctx.font = '11px "IBM Plex Sans", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('MOON', cx, cy + radius + 22)
}

function drawOrbitRings(ctx: CanvasRenderingContext2D, cx: number, cy: number, earthRadius: number) {
  // Concentric orbital altitude reference rings around Earth (close to Earth)
  const rings = [1.4, 1.8, 2.2, 2.6]
  for (const frac of rings) {
    const r = earthRadius * frac
    ctx.strokeStyle = 'rgba(100, 150, 255, 0.05)'
    ctx.lineWidth = 0.8
    ctx.setLineDash([3, 8])
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.setLineDash([])
}

// Compute a point on the free-return trajectory using a parametric curve
// progress: 0 = Earth, 0.5 = near Moon, 1.0 = back to Earth
function trajectoryPoint(
  progress: number,
  earthX: number,
  earthY: number,
  moonX: number,
  moonY: number,
): { x: number, y: number } {
  const t = progress
  const midX = (earthX + moonX) / 2
  const midY = (earthY + moonY) / 2
  const dx = moonX - earthX
  const dy = moonY - earthY

  // Perpendicular direction for arc sweep
  const perpX = -dy
  const perpY = dx

  if (t <= 0.5) {
    // Outbound leg: Earth to Moon — sweeps wide above
    const s = t / 0.5
    const cp1x = earthX + dx * 0.3 + perpX * 0.18
    const cp1y = earthY + dy * 0.3 + perpY * 0.18
    const cp2x = midX + perpX * 0.15
    const cp2y = midY + perpY * 0.15
    const u = 1 - s
    const x = u * u * u * earthX + 3 * u * u * s * cp1x + 3 * u * s * s * cp2x + s * s * s * moonX
    const y = u * u * u * earthY + 3 * u * u * s * cp1y + 3 * u * s * s * cp2y + s * s * s * moonY
    return { x, y }
  } else {
    // Return leg: Moon back to Earth — loops behind Moon, curves below
    const s = (t - 0.5) / 0.5
    const loopExtend = 0.15
    const cp1x = moonX + (moonX - earthX) * loopExtend - perpX * 0.15
    const cp1y = moonY + (moonY - earthY) * loopExtend - perpY * 0.15
    const cp2x = midX - perpX * 0.18
    const cp2y = midY - perpY * 0.18
    const u = 1 - s
    const x = u * u * u * moonX + 3 * u * u * s * cp1x + 3 * u * s * s * cp2x + s * s * s * earthX
    const y = u * u * u * moonY + 3 * u * u * s * cp1y + 3 * u * s * s * cp2y + s * s * s * earthY
    return { x, y }
  }
}

function drawTrajectory(
  ctx: CanvasRenderingContext2D,
  earthX: number,
  earthY: number,
  moonX: number,
  moonY: number,
  progress: number,
  isPreLaunch: boolean,
  time: number,
) {
  const steps = 300

  // Draw full planned trajectory path — dashed line
  ctx.save()
  ctx.strokeStyle = CYAN_DIM
  ctx.lineWidth = 2
  ctx.setLineDash([8, 6])
  ctx.beginPath()
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const pt = trajectoryPoint(t, earthX, earthY, moonX, moonY)
    if (i === 0) ctx.moveTo(pt.x, pt.y)
    else ctx.lineTo(pt.x, pt.y)
  }
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()

  // Tick marks along trajectory at 10% intervals
  for (let tick = 1; tick <= 9; tick++) {
    const t = tick / 10
    const pt = trajectoryPoint(t, earthX, earthY, moonX, moonY)
    // Small cross mark
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.2)'
    ctx.lineWidth = 1
    const sz = 3
    ctx.beginPath()
    ctx.moveTo(pt.x - sz, pt.y)
    ctx.lineTo(pt.x + sz, pt.y)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(pt.x, pt.y - sz)
    ctx.lineTo(pt.x, pt.y + sz)
    ctx.stroke()
  }

  if (isPreLaunch) return

  // Draw traveled portion — bright solid cyan with glow
  ctx.save()
  ctx.strokeStyle = CYAN
  ctx.lineWidth = 2.5
  ctx.shadowColor = CYAN_GLOW
  ctx.shadowBlur = 12
  ctx.beginPath()
  const travelSteps = Math.floor(progress * steps)
  for (let i = 0; i <= travelSteps; i++) {
    const t = i / steps
    const pt = trajectoryPoint(t, earthX, earthY, moonX, moonY)
    if (i === 0) ctx.moveTo(pt.x, pt.y)
    else ctx.lineTo(pt.x, pt.y)
  }
  ctx.stroke()
  ctx.shadowBlur = 0
  ctx.restore()

  // Spacecraft dot
  const craftPos = trajectoryPoint(progress, earthX, earthY, moonX, moonY)

  // Pulsing glow
  const pulseSize = 4 + Math.sin(time * 1.2) * 1.5
  const glowGradient = ctx.createRadialGradient(craftPos.x, craftPos.y, 0, craftPos.x, craftPos.y, pulseSize * 5)
  glowGradient.addColorStop(0, AMBER_GLOW)
  glowGradient.addColorStop(1, 'rgba(245, 166, 35, 0)')
  ctx.fillStyle = glowGradient
  ctx.beginPath()
  ctx.arc(craftPos.x, craftPos.y, pulseSize * 5, 0, Math.PI * 2)
  ctx.fill()

  // Core dot
  ctx.fillStyle = AMBER
  ctx.shadowColor = AMBER
  ctx.shadowBlur = 14
  ctx.beginPath()
  ctx.arc(craftPos.x, craftPos.y, pulseSize, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0

  // Label
  ctx.fillStyle = AMBER
  ctx.font = 'bold 10px "IBM Plex Mono", monospace'
  ctx.textAlign = 'left'
  ctx.fillText('ORION', craftPos.x + 14, craftPos.y - 10)
}

function drawDistanceMarker(
  ctx: CanvasRenderingContext2D,
  earthX: number,
  earthY: number,
  moonX: number,
  moonY: number,
) {
  // Dashed line between Earth and Moon with distance label
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)'
  ctx.lineWidth = 1
  ctx.setLineDash([3, 8])
  ctx.beginPath()
  ctx.moveTo(earthX, earthY)
  ctx.lineTo(moonX, moonY)
  ctx.stroke()
  ctx.setLineDash([])

  const midX = (earthX + moonX) / 2
  const midY = (earthY + moonY) / 2
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)'
  ctx.font = '9px "IBM Plex Mono", monospace'
  ctx.textAlign = 'center'
  ctx.fillText('384,400 km', midX, midY + 16)
}

export function OrbitalCanvas({ trajectoryProgress, isPreLaunch, moonOrbitAngle }: OrbitalCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const timeRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height

    // Earth position — left side of canvas to maximize Earth-Moon gap
    const earthX = width * 0.22
    const earthY = height * 0.5
    const earthRadius = 150

    // Moon position — right of center, clear of the telemetry panel overlay
    const moonCenterX = width * 0.75
    const moonCenterY = height * 0.5
    const moonOrbitDrift = 30
    const moonX = moonCenterX + Math.cos(moonOrbitAngle) * moonOrbitDrift
    const moonY = moonCenterY + Math.sin(moonOrbitAngle) * moonOrbitDrift * 0.5
    const moonRadius = 32

    const render = () => {
      timeRef.current += 1 / 30
      const time = timeRef.current

      ctx.clearRect(0, 0, width, height)

      // Background
      ctx.fillStyle = '#0a0e1a'
      ctx.fillRect(0, 0, width, height)

      drawGrid(ctx, width, height, earthX, earthY)
      drawStars(ctx, width, height, time)
      drawOrbitRings(ctx, earthX, earthY, earthRadius)
      drawDistanceMarker(ctx, earthX, earthY, moonX, moonY)
      drawTrajectory(ctx, earthX, earthY, moonX, moonY, trajectoryProgress, isPreLaunch, time)
      drawEarth(ctx, earthX, earthY, earthRadius)
      drawMoon(ctx, moonX, moonY, moonRadius)

      animRef.current = requestAnimationFrame(render)
    }

    animRef.current = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animRef.current)
    }
  }, [trajectoryProgress, isPreLaunch, moonOrbitAngle])

  return (
    <canvas
      ref={canvasRef}
      width={1280}
      height={720}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  )
}
