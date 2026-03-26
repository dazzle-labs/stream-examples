import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'
import type { ParsedEvent, FirehoseStats } from './firehose'

interface StreamParticle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  color: string
  alpha: number
  life: number
  maxLife: number
  hasImages: boolean
  shimmerPhase: number
}

interface AmbientMote {
  x: number
  y: number
  vy: number
  radius: number
  alpha: number
  phase: number
  color: string
}

interface TextOverlay {
  text: string
  x: number
  y: number
  alpha: number
  life: number
  maxLife: number
}

const LANGUAGE_COLORS: Record<string, string> = {
  en: '#4a9eff',
  ja: '#ff6b9d',
  pt: '#4ade80',
  es: '#fbbf24',
  de: '#e2e8f0',
  other: '#a78bfa',
}

const ALL_COLORS = Object.values(LANGUAGE_COLORS)
const MAX_PARTICLES = 200
const MAX_AMBIENT_MOTES = 40
const MAX_TEXT_OVERLAYS = 2
const TEXT_OVERLAY_INTERVAL = 4000
const TEXT_OVERLAY_DURATION = 4000
const PARTICLE_SAMPLE_RATE = 40

function getParticleRadius(kind: ParsedEvent['kind']): number {
  switch (kind) {
    case 'post': return 3.5 + Math.random() * 1.5
    case 'reply': return 2 + Math.random() * 1
    case 'repost': return 1.2 + Math.random() * 0.6
    case 'like': return 0.8 + Math.random() * 0.5
    case 'follow': return 1 + Math.random() * 0.5
  }
}

export const StreamZone = forwardRef<
  { addEvent: (event: ParsedEvent) => void },
  { stats: FirehoseStats }
>(function StreamZone({ stats: _stats }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<StreamParticle[]>([])
  const ambientMotesRef = useRef<AmbientMote[]>([])
  const textOverlaysRef = useRef<TextOverlay[]>([])
  const eventQueueRef = useRef<ParsedEvent[]>([])
  const lastParticleTimeRef = useRef(0)
  const lastTextTimeRef = useRef(0)
  const animFrameRef = useRef(0)
  const lastFrameTimeRef = useRef(0)

  const addEvent = useCallback((event: ParsedEvent) => {
    const queue = eventQueueRef.current
    if (queue.length < 100) {
      queue.push(event)
    }
  }, [])

  useImperativeHandle(ref, () => ({ addEvent }), [addEvent])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = 350
    const H = 720

    canvas.width = W * 2
    canvas.height = H * 2
    ctx.scale(2, 2)

    // Initialize ambient motes - always-visible background particles
    const motes = ambientMotesRef.current
    for (let i = 0; i < MAX_AMBIENT_MOTES; i++) {
      motes.push({
        x: 40 + Math.random() * (W - 80),
        y: Math.random() * H,
        vy: 0.2 + Math.random() * 0.5,
        radius: 0.3 + Math.random() * 1.2,
        alpha: 0.05 + Math.random() * 0.15,
        phase: Math.random() * Math.PI * 2,
        color: ALL_COLORS[Math.floor(Math.random() * ALL_COLORS.length)] ?? '#4a9eff',
      })
    }

    function spawnParticle(event: ParsedEvent): void {
      const particles = particlesRef.current
      if (particles.length >= MAX_PARTICLES) {
        particles.shift()
      }

      const color = LANGUAGE_COLORS[event.language] ?? LANGUAGE_COLORS['other'] ?? '#a78bfa'
      const radius = getParticleRadius(event.kind)
      const xCenter = W / 2
      const xSpread = 130
      const x = xCenter + (Math.random() - 0.5) * xSpread + Math.sin(Date.now() * 0.001 + Math.random() * 6.28) * 25

      particles.push({
        x,
        y: -10 - Math.random() * 20,
        vx: (Math.random() - 0.5) * 0.4,
        vy: 1.0 + Math.random() * 1.8,
        radius,
        color,
        alpha: 0.6 + Math.random() * 0.4,
        life: 0,
        maxLife: 350 + Math.random() * 250,
        hasImages: event.hasImages,
        shimmerPhase: Math.random() * Math.PI * 2,
      })
    }

    function spawnTextOverlay(event: ParsedEvent): void {
      const overlays = textOverlaysRef.current
      if (overlays.length >= MAX_TEXT_OVERLAYS) return

      let displayText = event.text.trim()
      if (displayText.length > 120) {
        displayText = displayText.slice(0, 117) + '...'
      }

      overlays.push({
        text: displayText,
        x: 24,
        y: 120 + Math.random() * 440,
        alpha: 0,
        life: 0,
        maxLife: TEXT_OVERLAY_DURATION,
      })
    }

    function processQueue(now: number): void {
      const queue = eventQueueRef.current
      if (queue.length === 0) return

      const timeSinceLastParticle = now - lastParticleTimeRef.current
      const minInterval = 1000 / PARTICLE_SAMPLE_RATE

      if (timeSinceLastParticle >= minInterval) {
        const event = queue.shift()
        if (event) {
          spawnParticle(event)
          lastParticleTimeRef.current = now

          const timeSinceLastText = now - lastTextTimeRef.current
          if (
            timeSinceLastText > TEXT_OVERLAY_INTERVAL &&
            (event.kind === 'post' || event.kind === 'reply') &&
            event.text.length > 30 &&
            (event.hashtags.length > 0 || event.language === 'en')
          ) {
            spawnTextOverlay(event)
            lastTextTimeRef.current = now
          }
        }
      }
    }

    function render(timestamp: number): void {
      const dt = Math.min(timestamp - (lastFrameTimeRef.current || timestamp), 50)
      lastFrameTimeRef.current = timestamp

      if (!ctx) return

      processQueue(timestamp)

      // Clear with trail effect for that glowing persistence
      ctx.fillStyle = 'rgba(6, 8, 12, 0.14)'
      ctx.fillRect(0, 0, W, H)

      // Ambient glow at top (source of the stream)
      const topGlow = ctx.createRadialGradient(W / 2, -30, 0, W / 2, -30, 200)
      topGlow.addColorStop(0, 'rgba(0, 133, 255, 0.04)')
      topGlow.addColorStop(0.5, 'rgba(74, 158, 255, 0.015)')
      topGlow.addColorStop(1, 'transparent')
      ctx.fillStyle = topGlow
      ctx.fillRect(0, 0, W, 220)

      // Subtle vertical flow lines (light streaks)
      const flowTime = timestamp * 0.0003
      for (let i = 0; i < 5; i++) {
        const fx = 80 + i * 50 + Math.sin(flowTime + i * 1.3) * 30
        const flowGrad = ctx.createLinearGradient(fx, 0, fx, H)
        flowGrad.addColorStop(0, 'rgba(0, 133, 255, 0.008)')
        flowGrad.addColorStop(0.3, 'rgba(0, 133, 255, 0.015)')
        flowGrad.addColorStop(0.7, 'rgba(0, 133, 255, 0.008)')
        flowGrad.addColorStop(1, 'transparent')
        ctx.fillStyle = flowGrad
        ctx.fillRect(fx - 15, 0, 30, H)
      }

      const dtFactor = dt / 16.67

      // Draw ambient motes (always visible background particles)
      for (const mote of motes) {
        mote.y += mote.vy * dtFactor
        mote.phase += 0.01 * dtFactor
        mote.x += Math.sin(mote.phase) * 0.15 * dtFactor

        if (mote.y > H + 10) {
          mote.y = -10
          mote.x = 40 + Math.random() * (W - 80)
        }

        ctx.beginPath()
        ctx.arc(mote.x, mote.y, mote.radius, 0, Math.PI * 2)
        ctx.fillStyle = colorWithAlpha(mote.color, mote.alpha)
        ctx.fill()
      }

      // Update and draw stream particles
      const particles = particlesRef.current
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        if (!p) continue

        p.life += dt
        p.x += p.vx * dtFactor
        p.y += p.vy * dtFactor

        // Gentle organic drift
        p.x += Math.sin(p.life * 0.002 + p.shimmerPhase) * 0.2 * dtFactor
        p.x += Math.cos(p.life * 0.0008 + p.shimmerPhase * 2) * 0.1 * dtFactor

        // Fade in/out
        const lifeRatio = p.life / p.maxLife
        let fadeAlpha = p.alpha
        if (lifeRatio < 0.08) {
          fadeAlpha *= lifeRatio / 0.08
        } else if (lifeRatio > 0.65) {
          fadeAlpha *= 1 - (lifeRatio - 0.65) / 0.35
        }

        if (p.life > p.maxLife || p.y > H + 20) {
          particles.splice(i, 1)
          continue
        }

        // Outer glow
        const glowSize = p.radius * 5
        const glowGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowSize)
        glowGrad.addColorStop(0, colorWithAlpha(p.color, fadeAlpha * 0.25))
        glowGrad.addColorStop(0.4, colorWithAlpha(p.color, fadeAlpha * 0.08))
        glowGrad.addColorStop(1, 'transparent')
        ctx.fillStyle = glowGrad
        ctx.fillRect(p.x - glowSize, p.y - glowSize, glowSize * 2, glowSize * 2)

        // Core particle
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = colorWithAlpha(p.color, fadeAlpha * 0.9)
        ctx.fill()

        // Hot white center
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius * 0.35, 0, Math.PI * 2)
        ctx.fillStyle = colorWithAlpha('#ffffff', fadeAlpha * 0.5)
        ctx.fill()

        // Golden shimmer for posts with images
        if (p.hasImages) {
          const shimmerAlpha = (Math.sin(p.life * 0.008 + p.shimmerPhase) * 0.5 + 0.5) * fadeAlpha * 0.4
          const shimSize = p.radius * 7
          const shimGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, shimSize)
          shimGrad.addColorStop(0, colorWithAlpha('#fbbf24', shimmerAlpha * 0.6))
          shimGrad.addColorStop(0.5, colorWithAlpha('#fbbf24', shimmerAlpha * 0.15))
          shimGrad.addColorStop(1, 'transparent')
          ctx.fillStyle = shimGrad
          ctx.fillRect(p.x - shimSize, p.y - shimSize, shimSize * 2, shimSize * 2)
        }
      }

      // Draw text overlays
      const overlays = textOverlaysRef.current
      for (let i = overlays.length - 1; i >= 0; i--) {
        const overlay = overlays[i]
        if (!overlay) continue

        overlay.life += dt

        const ratio = overlay.life / overlay.maxLife
        if (ratio < 0.15) {
          overlay.alpha = ratio / 0.15
        } else if (ratio > 0.75) {
          overlay.alpha = 1 - (ratio - 0.75) / 0.25
        } else {
          overlay.alpha = 1
        }

        if (overlay.life > overlay.maxLife) {
          overlays.splice(i, 1)
          continue
        }

        ctx.save()
        ctx.globalAlpha = overlay.alpha * 0.9

        ctx.font = '12px "Outfit", sans-serif'
        ctx.fillStyle = '#e8ecf2'

        // Word wrap
        const maxWidth = W - 48
        const words = overlay.text.split(' ')
        const lines: string[] = []
        let currentLine = ''

        for (const word of words) {
          const testLine = currentLine ? currentLine + ' ' + word : word
          const metrics = ctx.measureText(testLine)
          if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine)
            currentLine = word
          } else {
            currentLine = testLine
          }
        }
        if (currentLine) lines.push(currentLine)

        const lineHeight = 18
        const padding = 10
        const bgHeight = lines.length * lineHeight + padding * 2
        const bgWidth = maxWidth + padding * 2

        // Frosted glass background
        ctx.fillStyle = 'rgba(6, 8, 12, 0.8)'
        ctx.beginPath()
        roundRect(ctx, overlay.x - padding, overlay.y - padding, bgWidth, bgHeight, 8)
        ctx.fill()

        // Accent border
        ctx.strokeStyle = 'rgba(0, 133, 255, 0.15)'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        roundRect(ctx, overlay.x - padding, overlay.y - padding, bgWidth, bgHeight, 8)
        ctx.stroke()

        // Left accent line
        ctx.fillStyle = 'rgba(0, 133, 255, 0.3)'
        ctx.fillRect(overlay.x - padding, overlay.y - padding + 4, 2, bgHeight - 8)

        // Text
        ctx.fillStyle = 'rgba(232, 236, 242, 0.85)'
        ctx.font = '11.5px "Outfit", sans-serif'
        for (let li = 0; li < lines.length; li++) {
          const line = lines[li]
          if (line !== undefined) {
            ctx.fillText(line, overlay.x + 2, overlay.y + 12 + li * lineHeight)
          }
        }

        ctx.restore()
      }

      // "THE STREAM" label at top
      ctx.save()
      ctx.globalAlpha = 0.25
      ctx.font = '600 9px "JetBrains Mono", monospace'
      ctx.fillStyle = '#6b7a8d'
      ctx.textAlign = 'center'
      ctx.fillText('THE STREAM', W / 2, 20)
      ctx.restore()

      animFrameRef.current = requestAnimationFrame(render)
    }

    animFrameRef.current = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="w-[350px] h-[720px]"
      style={{ display: 'block' }}
    />
  )
})

function colorWithAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
