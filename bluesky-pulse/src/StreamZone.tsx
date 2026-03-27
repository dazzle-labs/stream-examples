import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'
import type { ParsedEvent, FirehoseStats, EventKind } from './firehose'
import { useContainerSize } from './useContainerSize'

interface StreamParticle {
  x: number
  y: number
  vy: number
  kind: EventKind
  size: number
  life: number
  maxLife: number
  opacity: number
  drift: number
}

interface TextOverlay {
  text: string
  x: number
  y: number
  alpha: number
  life: number
  maxLife: number
}

interface EventStyle {
  color: string
  minSize: number
  maxSize: number
}

// Twitter/X SVG paths (24x24 viewBox) — created once for performance
const HEART_PATH = new Path2D('M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z')
const REPLY_PATH = new Path2D('M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z')
const REPOST_PATH = new Path2D('M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z')

// ── Pre-rendered icon cache ──────────────────────────────────────────────
// Instead of calling ctx.fill(Path2D) with save/translate/scale/restore per
// particle every frame, we pre-render each icon kind at discrete sizes to
// offscreen canvases. Each frame becomes a single ctx.drawImage() blit,
// which is significantly faster at 180 particles per frame.

const iconCache = new Map<string, HTMLCanvasElement>()

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step
}

function getOrCreateIcon(kind: EventKind, size: number): HTMLCanvasElement {
  // Snap to nearest 2px to limit cache entries
  const snapped = Math.max(4, roundToStep(size, 2))
  const key = `${kind}-${snapped}`
  const cached = iconCache.get(key)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  // Render at 2x for crispness on high-DPI
  const px = snapped * 2
  canvas.width = px
  canvas.height = px
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.scale(2, 2)

  switch (kind) {
    case 'like': {
      const scale = snapped / 24
      ctx.save()
      ctx.scale(scale, scale)
      ctx.fillStyle = 'rgb(255, 107, 138)'
      ctx.fill(HEART_PATH)
      ctx.restore()
      break
    }
    case 'reply': {
      const scale = snapped / 24
      ctx.save()
      ctx.scale(scale, scale)
      ctx.fillStyle = 'rgb(74, 158, 255)'
      ctx.fill(REPLY_PATH)
      ctx.restore()
      break
    }
    case 'repost': {
      const scale = snapped / 24
      ctx.save()
      ctx.scale(scale, scale)
      ctx.fillStyle = 'rgb(74, 222, 128)'
      ctx.fill(REPOST_PATH)
      ctx.restore()
      break
    }
    case 'post': {
      const s = snapped * 0.4
      const scale = s / 12
      ctx.save()
      // Offset by half the canvas (snapped/2) to center the icon
      ctx.translate(snapped / 2 - s, snapped / 2 - s)
      ctx.scale(scale, scale)
      ctx.beginPath()
      ctx.moveTo(18, 2)
      ctx.lineTo(22, 6)
      ctx.lineTo(8, 20)
      ctx.lineTo(2, 22)
      ctx.lineTo(4, 16)
      ctx.closePath()
      ctx.fillStyle = 'rgb(74, 158, 255)'
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(15, 5)
      ctx.lineTo(19, 9)
      ctx.lineWidth = 1.2
      ctx.strokeStyle = 'rgb(30, 80, 160)'
      ctx.stroke()
      ctx.restore()
      break
    }
    case 'follow': {
      const s = snapped * 0.45
      const cx = snapped / 2
      const cy = snapped / 2
      ctx.save()
      ctx.fillStyle = 'rgb(167, 139, 250)'
      ctx.beginPath()
      ctx.arc(cx - s * 0.15, cy - s * 0.4, s * 0.32, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(cx - s * 0.15, cy + s * 0.55, s * 0.5, s * 0.35, 0, Math.PI, 0)
      ctx.fill()
      const px = cx + s * 0.65
      const py = cy - s * 0.05
      const ps = s * 0.25
      const pw = s * 0.1
      ctx.fillRect(px - ps, py - pw / 2, ps * 2, pw)
      ctx.fillRect(px - pw / 2, py - ps, pw, ps * 2)
      ctx.restore()
      break
    }
  }

  iconCache.set(key, canvas)
  return canvas
}

const EVENT_STYLES: Record<EventKind, EventStyle> = {
  like: { color: '#ff6b8a', minSize: 10, maxSize: 14 },
  post: { color: '#4a9eff', minSize: 16, maxSize: 20 },
  reply: { color: '#4a9eff', minSize: 12, maxSize: 16 },
  repost: { color: '#4ade80', minSize: 12, maxSize: 16 },
  follow: { color: '#a78bfa', minSize: 13, maxSize: 17 },
}

const MAX_PARTICLES = 180
const MAX_TEXT_OVERLAYS = 6
const TEXT_OVERLAY_INTERVAL = 1100
const TEXT_OVERLAY_DURATION = 7000
const PARTICLE_SAMPLE_RATE = 45

export const StreamZone = forwardRef<
  { addEvent: (event: ParsedEvent) => void },
  { stats: FirehoseStats }
>(function StreamZone({ stats: _stats }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<StreamParticle[]>([])
  const textOverlaysRef = useRef<TextOverlay[]>([])
  const eventQueueRef = useRef<ParsedEvent[]>([])
  const lastParticleTimeRef = useRef(0)
  const lastTextTimeRef = useRef(0)
  const animFrameRef = useRef(0)
  const lastFrameTimeRef = useRef(0)
  const sizeRef = useRef({ w: 350, h: 720 })
  const [containerRef, containerSize] = useContainerSize()

  const addEvent = useCallback((event: ParsedEvent) => {
    const queue = eventQueueRef.current
    if (queue.length < 100) {
      queue.push(event)
    }
  }, [])

  useImperativeHandle(ref, () => ({ addEvent }), [addEvent])

  // Resize canvas backing store when container changes
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || containerSize.width === 0 || containerSize.height === 0) return

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    const W = containerSize.width
    const H = containerSize.height

    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)

    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    sizeRef.current = { w: W, h: H }
  }, [containerSize.width, containerSize.height])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Initial sizing
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    const initW = containerSize.width || 350
    const initH = containerSize.height || 720
    canvas.width = Math.round(initW * dpr)
    canvas.height = Math.round(initH * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    sizeRef.current = { w: initW, h: initH }

    function spawnParticle(event: ParsedEvent): void {
      const { w: W } = sizeRef.current
      const particles = particlesRef.current
      if (particles.length >= MAX_PARTICLES) {
        particles.shift()
      }

      const style = EVENT_STYLES[event.kind]
      const size = style.minSize + Math.random() * (style.maxSize - style.minSize)
      const xCenter = W / 2
      const xSpread = Math.min(130, W * 0.37)
      const x = xCenter + (Math.random() - 0.5) * xSpread + Math.sin(Date.now() * 0.001 + Math.random() * 6.28) * 25

      const { h: H } = sizeRef.current
      const vy = 1.0 + Math.random() * 1.8
      // maxLife must be long enough for the particle to traverse from its
      // spawn point (up to y = -30) past the bottom removal threshold
      // (H + 20). Total distance is H + 50. Each frame is ~16.67ms and
      // the particle moves ~vy CSS pixels per frame. Multiply by 1.3 so
      // the fade-out (which starts at 85% of life) doesn't kill it early.
      const traversalMs = ((H + 50) / vy) * 16.67
      const lifeMs = traversalMs * 1.3 + 500

      particles.push({
        x,
        y: -10 - Math.random() * 20,
        vy,
        kind: event.kind,
        size,
        life: 0,
        maxLife: lifeMs,
        opacity: 0.6 + Math.random() * 0.4,
        drift: Math.random() * Math.PI * 2,
      })
    }

    function spawnTextOverlay(event: ParsedEvent): void {
      const { h: H } = sizeRef.current
      const overlays = textOverlaysRef.current
      if (overlays.length >= MAX_TEXT_OVERLAYS) return

      let displayText = event.text.trim()
      if (displayText.length > 120) {
        displayText = displayText.slice(0, 117) + '...'
      }

      // Divide the usable vertical space into zones and find a gap
      const topMargin = 80
      const bottomMargin = 60
      const overlayHeight = 90 // approximate height of a text overlay box
      const usableTop = topMargin
      const usableBottom = H - bottomMargin
      const usableHeight = usableBottom - usableTop

      // Create candidate zones by dividing vertical space
      const zoneCount = MAX_TEXT_OVERLAYS + 1
      const zoneHeight = usableHeight / zoneCount
      const candidateYs: number[] = []
      for (let z = 0; z < zoneCount; z++) {
        candidateYs.push(usableTop + z * zoneHeight + (zoneHeight - overlayHeight) / 2)
      }

      // Filter out candidates that would collide with existing overlays
      const occupiedYs = overlays.map(o => o.y)
      const freeYs = candidateYs.filter(cy => {
        for (const oy of occupiedYs) {
          if (Math.abs(cy - oy) < overlayHeight + 12) return false
        }
        return true
      })

      if (freeYs.length === 0) return

      // Pick a random free zone
      const y = freeYs[Math.floor(Math.random() * freeYs.length)] ?? freeYs[0] ?? usableTop

      overlays.push({
        text: displayText,
        x: 24,
        y,
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

      const { w: W, h: H } = sizeRef.current

      processQueue(timestamp)

      // Solid dark background each frame — no trail/motion blur
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      ctx.clearRect(0, 0, W * dpr, H * dpr)
      ctx.fillStyle = '#06080c'
      ctx.fillRect(0, 0, W, H)

      const dtFactor = dt / 16.67

      // Update and draw stream particles as canvas icons
      const particles = particlesRef.current
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        if (!p) continue

        p.life += dt
        p.y += p.vy * dtFactor

        // Gentle organic drift
        p.x += Math.sin(p.life * 0.002 + p.drift) * 0.2 * dtFactor
        p.x += Math.cos(p.life * 0.0008 + p.drift * 2) * 0.1 * dtFactor

        // Fade in/out — late fade-out so icons stay visible most of the fall
        const lifeRatio = p.life / p.maxLife
        let fadeAlpha = p.opacity
        if (lifeRatio < 0.08) {
          fadeAlpha *= lifeRatio / 0.08
        } else if (lifeRatio > 0.85) {
          fadeAlpha *= 1 - (lifeRatio - 0.85) / 0.15
        }

        if (p.life > p.maxLife || p.y > H + 20) {
          particles.splice(i, 1)
          continue
        }

        // Blit pre-rendered icon from cache — much faster than
        // save/translate/scale/fill(Path2D)/restore per particle
        const icon = getOrCreateIcon(p.kind, p.size)
        ctx.globalAlpha = fadeAlpha
        const halfSize = p.size / 2
        ctx.drawImage(icon, 0, 0, icon.width, icon.height, p.x - halfSize, p.y - halfSize, p.size, p.size)
        ctx.globalAlpha = 1
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

        // Use the SAME font for measuring and rendering
        ctx.font = '500 13.5px "Outfit", sans-serif'
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

        const lineHeight = 21
        const padding = 12
        const bgHeight = lines.length * lineHeight + padding * 2
        const bgWidth = maxWidth + padding * 2

        // Draw background, border, and clip all content to the card bounds
        const cardX = overlay.x - padding
        const cardY = overlay.y - padding

        // Background
        ctx.fillStyle = 'rgba(10, 14, 20, 0.97)'
        ctx.beginPath()
        roundRect(ctx, cardX, cardY, bgWidth, bgHeight, 8)
        ctx.fill()

        // Border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
        ctx.lineWidth = 1
        ctx.beginPath()
        roundRect(ctx, cardX, cardY, bgWidth, bgHeight, 8)
        ctx.stroke()

        // Clip all subsequent draws to the card bounds — canvas overflow:hidden
        ctx.beginPath()
        roundRect(ctx, cardX, cardY, bgWidth, bgHeight, 8)
        ctx.clip()

        // Left accent line
        ctx.fillStyle = 'rgba(0, 133, 255, 0.3)'
        ctx.fillRect(cardX, cardY + 4, 2, bgHeight - 8)

        // Text — clipped to card, so long URLs etc. won't bleed
        ctx.fillStyle = 'rgba(245, 248, 255, 1)'
        ctx.font = '500 13.5px "Outfit", sans-serif'
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
      ctx.textAlign = 'center'
      ctx.font = '700 14px "JetBrains Mono", monospace'

      // Apply letter-spacing uniformly across all passes
      ctx.letterSpacing = '3px'

      // Multi-layer glow for depth and contrast
      ctx.shadowColor = 'rgba(0, 133, 255, 0.8)'
      ctx.shadowBlur = 20
      ctx.globalAlpha = 0.6
      ctx.fillStyle = '#4a9eff'
      ctx.fillText('THE STREAM', W / 2, 24)

      // Second pass: tighter glow for sharpness
      ctx.shadowColor = 'rgba(0, 133, 255, 0.5)'
      ctx.shadowBlur = 8
      ctx.globalAlpha = 0.85
      ctx.fillStyle = '#c8ddf5'
      ctx.fillText('THE STREAM', W / 2, 24)

      // Third pass: crisp white-ish text on top, no shadow
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      ctx.globalAlpha = 0.95
      ctx.fillStyle = '#e2eaf4'
      ctx.fillText('THE STREAM', W / 2, 24)

      ctx.restore()

      animFrameRef.current = requestAnimationFrame(render)
    }

    animFrameRef.current = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={containerRef} className="w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ display: 'block' }}
      />
    </div>
  )
})

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
