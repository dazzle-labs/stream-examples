import { useRef, useEffect, useCallback } from 'react'
import { getTrajectoryPoints, getCurrentTrajectoryIndex } from '../data/mission'
import { getRealMET, liveState } from '../data/live'

interface Star {
  x: number
  y: number
  size: number
  brightness: number
  twinkleSpeed: number
  twinkleOffset: number
}

function createStars(count: number, width: number, height: number): Star[] {
  const stars: Star[] = []
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.5 + 0.3,
      brightness: Math.random() * 0.6 + 0.4,
      twinkleSpeed: Math.random() * 0.003 + 0.001,
      twinkleOffset: Math.random() * Math.PI * 2,
    })
  }
  return stars
}

export function OrbitalCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const starsRef = useRef<Star[]>([])
  const trajectoryRef = useRef(getTrajectoryPoints())
  const frameRef = useRef(0)

  const draw = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, time: number) => {
    ctx.clearRect(0, 0, width, height)

    // Background gradient
    const bgGrad = ctx.createRadialGradient(width * 0.15, height * 0.5, 0, width * 0.15, height * 0.5, width * 0.8)
    bgGrad.addColorStop(0, 'rgba(5, 15, 40, 1)')
    bgGrad.addColorStop(0.5, 'rgba(2, 5, 16, 1)')
    bgGrad.addColorStop(1, 'rgba(1, 2, 8, 1)')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, width, height)

    // Stars
    if (starsRef.current.length === 0) {
      starsRef.current = createStars(300, width, height)
    }
    for (const star of starsRef.current) {
      const twinkle = Math.sin(time * star.twinkleSpeed + star.twinkleOffset) * 0.3 + 0.7
      const alpha = star.brightness * twinkle
      ctx.fillStyle = `rgba(200, 220, 255, ${alpha})`
      ctx.beginPath()
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2)
      ctx.fill()
    }

    const met = getRealMET()
    const trajectory = trajectoryRef.current
    const currentIndex = getCurrentTrajectoryIndex(met)
    const horizons = liveState.horizons
    const dsn = liveState.dsn
    const earthDistKm = horizons ? horizons.earthDistanceKm : (dsn ? dsn.rangeKm : 0)
    const moonDistKm = horizons ? Math.round(Math.abs(384400 - horizons.rangeKm)) : 0

    // Coordinate system: Earth at (0,0), Moon at (1,0) in normalized trajectory coords
    // Map to canvas: Earth on left, Moon on right at center height
    // Offset Earth right to avoid overlap with left panel, Moon left to avoid right panel
    const earthX = width * 0.30
    const earthY = height * 0.55
    const scale = width * 0.44          // 1 normalized unit = this many pixels
    const moonX = earthX + scale        // Moon at normalized x=1.0
    const moonY = earthY                // Moon at same y (y=0 in trajectory coords)

    // Draw Earth
    const earthRadius = 28
    const earthGlow = ctx.createRadialGradient(earthX, earthY, earthRadius * 0.8, earthX, earthY, earthRadius * 3)
    earthGlow.addColorStop(0, 'rgba(70, 130, 255, 0.15)')
    earthGlow.addColorStop(0.5, 'rgba(40, 100, 220, 0.05)')
    earthGlow.addColorStop(1, 'rgba(30, 80, 200, 0)')
    ctx.fillStyle = earthGlow
    ctx.beginPath()
    ctx.arc(earthX, earthY, earthRadius * 3, 0, Math.PI * 2)
    ctx.fill()

    // Earth atmosphere ring
    const atmGrad = ctx.createRadialGradient(earthX, earthY, earthRadius - 2, earthX, earthY, earthRadius + 4)
    atmGrad.addColorStop(0, 'rgba(100, 180, 255, 0)')
    atmGrad.addColorStop(0.7, 'rgba(100, 180, 255, 0.2)')
    atmGrad.addColorStop(1, 'rgba(100, 180, 255, 0)')
    ctx.fillStyle = atmGrad
    ctx.beginPath()
    ctx.arc(earthX, earthY, earthRadius + 4, 0, Math.PI * 2)
    ctx.fill()

    // Earth body
    const earthBodyGrad = ctx.createRadialGradient(earthX - 8, earthY - 8, 0, earthX, earthY, earthRadius)
    earthBodyGrad.addColorStop(0, '#5b9df5')
    earthBodyGrad.addColorStop(0.4, '#3b7dd8')
    earthBodyGrad.addColorStop(0.7, '#1a5fb4')
    earthBodyGrad.addColorStop(1, '#0d3b6e')
    ctx.fillStyle = earthBodyGrad
    ctx.beginPath()
    ctx.arc(earthX, earthY, earthRadius, 0, Math.PI * 2)
    ctx.fill()

    // Earth label
    ctx.fillStyle = 'rgba(100, 180, 255, 0.7)'
    ctx.font = '11px "Orbitron", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('EARTH', earthX, earthY + earthRadius + 18)

    // Draw Moon
    const moonRadius = 12
    const moonGlow = ctx.createRadialGradient(moonX, moonY, moonRadius * 0.5, moonX, moonY, moonRadius * 2.5)
    moonGlow.addColorStop(0, 'rgba(220, 220, 200, 0.12)')
    moonGlow.addColorStop(1, 'rgba(200, 200, 180, 0)')
    ctx.fillStyle = moonGlow
    ctx.beginPath()
    ctx.arc(moonX, moonY, moonRadius * 2.5, 0, Math.PI * 2)
    ctx.fill()

    const moonBodyGrad = ctx.createRadialGradient(moonX - 3, moonY - 3, 0, moonX, moonY, moonRadius)
    moonBodyGrad.addColorStop(0, '#e0ddd0')
    moonBodyGrad.addColorStop(0.5, '#c0bdb0')
    moonBodyGrad.addColorStop(1, '#8a8778')
    ctx.fillStyle = moonBodyGrad
    ctx.beginPath()
    ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2)
    ctx.fill()

    // Moon craters (subtle)
    ctx.fillStyle = 'rgba(100, 98, 88, 0.3)'
    ctx.beginPath()
    ctx.arc(moonX + 3, moonY - 2, 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(moonX - 4, moonY + 3, 2, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = 'rgba(200, 200, 180, 0.7)'
    ctx.font = '11px "Orbitron", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('MOON', moonX, moonY + moonRadius + 18)

    // Draw trajectory (completed path)
    if (trajectory.length > 1 && currentIndex > 0) {
      ctx.beginPath()
      const firstPoint = trajectory[0]!
      ctx.moveTo(earthX + firstPoint.x * scale, earthY - firstPoint.y * scale)

      const drawUpTo = Math.min(currentIndex, trajectory.length - 1)
      for (let i = 1; i <= drawUpTo; i++) {
        const pt = trajectory[i]!
        ctx.lineTo(earthX + pt.x * scale, earthY - pt.y * scale)
      }

      const grad = ctx.createLinearGradient(earthX, earthY, moonX, moonY)
      grad.addColorStop(0, 'rgba(0, 229, 255, 0.1)')
      grad.addColorStop(0.5, 'rgba(0, 229, 255, 0.5)')
      grad.addColorStop(1, 'rgba(0, 229, 255, 0.8)')
      ctx.strokeStyle = grad
      ctx.lineWidth = 2
      ctx.stroke()
    }

    // Draw remaining trajectory (dashed, dimmer)
    if (trajectory.length > 1 && currentIndex < trajectory.length - 1) {
      ctx.beginPath()
      const startPt = trajectory[Math.max(0, currentIndex)]!
      ctx.moveTo(earthX + startPt.x * scale, earthY - startPt.y * scale)

      for (let i = currentIndex + 1; i < trajectory.length; i++) {
        const pt = trajectory[i]!
        ctx.lineTo(earthX + pt.x * scale, earthY - pt.y * scale)
      }

      ctx.strokeStyle = 'rgba(0, 229, 255, 0.12)'
      ctx.lineWidth = 1
      ctx.setLineDash([6, 8])
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Draw Orion spacecraft
    const safeIndex = Math.min(currentIndex, trajectory.length - 1)
    const currentPt = trajectory[safeIndex]!
    const orionX = earthX + currentPt.x * scale
    const orionY = earthY - currentPt.y * scale

    // Spacecraft glow
    const orionGlow = ctx.createRadialGradient(orionX, orionY, 0, orionX, orionY, 20)
    orionGlow.addColorStop(0, 'rgba(0, 229, 255, 0.6)')
    orionGlow.addColorStop(0.3, 'rgba(0, 229, 255, 0.2)')
    orionGlow.addColorStop(1, 'rgba(0, 229, 255, 0)')
    ctx.fillStyle = orionGlow
    ctx.beginPath()
    ctx.arc(orionX, orionY, 20, 0, Math.PI * 2)
    ctx.fill()

    // Pulsing ring
    const pulseSize = 8 + Math.sin(time * 0.005) * 4
    ctx.strokeStyle = `rgba(0, 229, 255, ${0.4 + Math.sin(time * 0.005) * 0.2})`
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(orionX, orionY, pulseSize, 0, Math.PI * 2)
    ctx.stroke()

    // Spacecraft dot
    ctx.fillStyle = '#00e5ff'
    ctx.beginPath()
    ctx.arc(orionX, orionY, 4, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(orionX, orionY, 2, 0, Math.PI * 2)
    ctx.fill()

    // Label
    ctx.fillStyle = '#00e5ff'
    ctx.font = 'bold 11px "Orbitron", sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('ORION', orionX + 14, orionY - 8)

    // Distance lines (subtle dashed lines from Orion to Earth and Moon)
    ctx.setLineDash([3, 6])
    ctx.lineWidth = 0.5

    // To Earth
    ctx.strokeStyle = 'rgba(100, 180, 255, 0.2)'
    ctx.beginPath()
    ctx.moveTo(orionX, orionY)
    ctx.lineTo(earthX, earthY)
    ctx.stroke()

    // To Moon
    ctx.strokeStyle = 'rgba(200, 200, 180, 0.2)'
    ctx.beginPath()
    ctx.moveTo(orionX, orionY)
    ctx.lineTo(moonX, moonY)
    ctx.stroke()

    ctx.setLineDash([])

    // Distance annotations on the lines
    const earthMidX = (orionX + earthX) / 2
    const earthMidY = (orionY + earthY) / 2
    ctx.fillStyle = 'rgba(100, 180, 255, 0.5)'
    ctx.font = '9px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    if (earthDistKm > 100) {
      ctx.fillText(`${earthDistKm.toLocaleString()} km`, earthMidX, earthMidY - 6)
    }

    const moonMidX = (orionX + moonX) / 2
    const moonMidY = (orionY + moonY) / 2
    ctx.fillStyle = 'rgba(200, 200, 180, 0.5)'
    if (moonDistKm > 0 && moonDistKm < 300_000) {
      ctx.fillText(`${moonDistKm.toLocaleString()} km`, moonMidX, moonMidY - 6)
    }

    // Scan line effect
    const scanY = (time * 0.05) % height
    const scanGrad = ctx.createLinearGradient(0, scanY - 30, 0, scanY + 30)
    scanGrad.addColorStop(0, 'rgba(0, 229, 255, 0)')
    scanGrad.addColorStop(0.5, 'rgba(0, 229, 255, 0.02)')
    scanGrad.addColorStop(1, 'rgba(0, 229, 255, 0)')
    ctx.fillStyle = scanGrad
    ctx.fillRect(0, scanY - 30, width, 60)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    let running = true
    const animate = (time: number) => {
      if (!running) return
      draw(ctx, rect.width, rect.height, time)
      frameRef.current = requestAnimationFrame(animate)
    }
    frameRef.current = requestAnimationFrame(animate)

    return () => {
      running = false
      cancelAnimationFrame(frameRef.current)
    }
  }, [draw])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ imageRendering: 'auto' }}
    />
  )
}
