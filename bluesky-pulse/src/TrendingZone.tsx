import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'
import type { ParsedEvent, FirehoseStats } from './firehose'

// ── Types ──────────────────────────────────────────────────────────────────

interface Bubble {
  tag: string
  x: number
  y: number
  vx: number
  vy: number
  targetRadius: number
  currentRadius: number
  count: number
  prevCount: number
  growthRate: number
  alpha: number
  pulsePhase: number
  birthTime: number
  popScale: number
  dying: boolean
}

interface AmbientMote {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  alpha: number
  baseAlpha: number
  life: number
  maxLife: number
  phase: number
}

// ── Layout & Physics ───────────────────────────────────────────────────────

const MAX_BUBBLES = 9
const MAX_MOTES = 35
const CENTER_GRAVITY = 0.0035
const REPULSION = 3200
const DAMPING = 0.90
const MIN_RADIUS = 30
const MAX_RADIUS = 72
const W = 528
const H = 720

// ── Color system ───────────────────────────────────────────────────────────
// Hot topics glow warm amber/coral; stable topics are cool blue; fading are slate

interface BubbleColors {
  glow: string
  text: string
  accent: string
}

function growthColor(rate: number): BubbleColors {
  if (rate > 5) {
    return { glow: '#ff7040', text: '#fff4ec', accent: '#ffaa70' }
  }
  if (rate > 2) {
    return { glow: '#ffb840', text: '#fff8ed', accent: '#ffd080' }
  }
  if (rate > 0) {
    return { glow: '#50a8e8', text: '#e4f0ff', accent: '#80c0f0' }
  }
  return { glow: '#607890', text: '#a0b0c0', accent: '#708898' }
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`
}

// ── Component ──────────────────────────────────────────────────────────────

export const TrendingZone = forwardRef<
  { addEvent: (event: ParsedEvent) => void },
  { stats: FirehoseStats }
>(function TrendingZone({ stats }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bubblesRef = useRef<Bubble[]>([])
  const motesRef = useRef<AmbientMote[]>([])
  const animFrameRef = useRef(0)
  const lastFrameTimeRef = useRef(0)
  const prevCountsRef = useRef<Map<string, number>>(new Map())

  const addEvent = useCallback((_event: ParsedEvent) => {
    // Hashtag data arrives via stats.hashtagCounts — no per-event work needed
  }, [])

  useImperativeHandle(ref, () => ({ addEvent }), [addEvent])

  // ── Sync bubbles with live hashtag frequencies ───────────────────────────

  useEffect(() => {
    const hashtagCounts = stats.hashtagCounts
    if (hashtagCounts.size === 0) return

    const sorted = [...hashtagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_BUBBLES)

    const bubbles = bubblesRef.current
    const activeTags = new Set(sorted.map((e) => e[0]))
    const prevCounts = prevCountsRef.current

    // Begin fade-out for bubbles no longer in the top list
    for (const bubble of bubbles) {
      if (!activeTags.has(bubble.tag) && !bubble.dying) {
        bubble.dying = true
      }
    }

    // Animate dying bubbles: shrink + fade
    for (const bubble of bubbles) {
      if (bubble.dying) {
        bubble.alpha = Math.max(0, bubble.alpha - 0.025)
        bubble.targetRadius = Math.max(0, bubble.targetRadius - 2)
      }
    }

    // Cull fully transparent bubbles
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i]
      if (b && b.alpha <= 0) {
        bubbles.splice(i, 1)
      }
    }

    // Upsert: update existing bubbles or create new ones
    for (const [tag, count] of sorted) {
      const existing = bubbles.find((b) => b.tag === tag)
      const prev = prevCounts.get(tag) ?? count
      const growth = count - prev

      if (existing) {
        existing.prevCount = existing.count
        existing.count = count
        existing.growthRate = existing.growthRate * 0.65 + growth * 0.35
        existing.dying = false
        existing.targetRadius = Math.max(
          MIN_RADIUS,
          Math.min(MAX_RADIUS, MIN_RADIUS + Math.sqrt(count) * 4.8),
        )
        existing.alpha = Math.min(1, existing.alpha + 0.12)
      } else if (bubbles.length < MAX_BUBBLES) {
        const cx = W / 2
        const cy = H / 2
        bubbles.push({
          tag,
          x: cx + (Math.random() - 0.5) * W * 0.35,
          y: cy + (Math.random() - 0.5) * H * 0.25,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          targetRadius: Math.max(
            MIN_RADIUS,
            Math.min(MAX_RADIUS, MIN_RADIUS + Math.sqrt(count) * 4.8),
          ),
          currentRadius: 5,
          count,
          prevCount: count,
          growthRate: growth,
          alpha: 0.2,
          pulsePhase: Math.random() * Math.PI * 2,
          birthTime: Date.now(),
          popScale: 0,
          dying: false,
        })
      }

      prevCounts.set(tag, count)
    }
  }, [stats.hashtagCounts])

  // ── Animation loop ─────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = W * 2
    canvas.height = H * 2
    ctx.scale(2, 2)

    const cx = W / 2
    const cy = H / 2 + 12

    // Seed ambient motes
    const motes = motesRef.current
    for (let i = motes.length; i < MAX_MOTES; i++) {
      motes.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        radius: 0.4 + Math.random() * 0.9,
        alpha: 0,
        baseAlpha: 0.03 + Math.random() * 0.08,
        life: Math.random() * 10000,
        maxLife: 8000 + Math.random() * 15000,
        phase: Math.random() * Math.PI * 2,
      })
    }

    function render(timestamp: number): void {
      const dt = Math.min(timestamp - (lastFrameTimeRef.current || timestamp), 50)
      lastFrameTimeRef.current = timestamp
      if (!ctx) return

      const dtF = dt / 16.67
      const bubbles = bubblesRef.current

      // ── Background ────────────────────────────────────────────────────
      ctx.fillStyle = '#06080c'
      ctx.fillRect(0, 0, W, H)

      // Soft radial bloom behind bubbles
      const bgGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 320)
      bgGlow.addColorStop(0, 'rgba(25, 55, 95, 0.03)')
      bgGlow.addColorStop(0.5, 'rgba(15, 35, 65, 0.015)')
      bgGlow.addColorStop(1, 'transparent')
      ctx.fillStyle = bgGlow
      ctx.fillRect(0, 0, W, H)

      // ── Ambient motes ─────────────────────────────────────────────────
      for (const m of motesRef.current) {
        m.life += dt
        m.phase += 0.003 * dtF

        m.vx += Math.sin(m.phase * 1.2 + m.y * 0.004) * 0.001 * dtF
        m.vy += Math.cos(m.phase * 0.9 + m.x * 0.004) * 0.001 * dtF
        m.vx *= 0.99
        m.vy *= 0.99
        m.x += m.vx * dtF
        m.y += m.vy * dtF

        if (m.x < -5) m.x = W + 5
        if (m.x > W + 5) m.x = -5
        if (m.y < -5) m.y = H + 5
        if (m.y > H + 5) m.y = -5

        const lr = m.life / m.maxLife
        if (lr < 0.2) m.alpha = m.baseAlpha * (lr / 0.2)
        else if (lr > 0.75) m.alpha = m.baseAlpha * (1 - (lr - 0.75) / 0.25)
        else m.alpha = m.baseAlpha

        if (m.life > m.maxLife) {
          m.x = Math.random() * W
          m.y = Math.random() * H
          m.life = 0
          m.maxLife = 8000 + Math.random() * 15000
          m.phase = Math.random() * Math.PI * 2
        }

        if (m.alpha > 0.005) {
          ctx.beginPath()
          ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2)
          ctx.fillStyle = rgba('#5588bb', m.alpha)
          ctx.fill()
        }
      }

      // ── Physics: gravity + collision ──────────────────────────────────
      for (let i = 0; i < bubbles.length; i++) {
        const a = bubbles[i]
        if (!a) continue

        // Pull toward cluster center
        a.vx += (cx - a.x) * CENTER_GRAVITY * dtF
        a.vy += (cy - a.y) * CENTER_GRAVITY * dtF

        // Push apart when overlapping
        for (let j = i + 1; j < bubbles.length; j++) {
          const b = bubbles[j]
          if (!b) continue

          const dx = a.x - b.x
          const dy = a.y - b.y
          const distSq = dx * dx + dy * dy
          const minGap = a.currentRadius + b.currentRadius + 10

          if (distSq < minGap * minGap && distSq > 1) {
            const dist = Math.sqrt(distSq)
            const force = REPULSION / distSq * dtF
            const fx = (dx / dist) * force
            const fy = (dy / dist) * force
            a.vx += fx; a.vy += fy
            b.vx -= fx; b.vy -= fy
          }
        }

        a.vx *= DAMPING
        a.vy *= DAMPING
        a.x += a.vx * dtF
        a.y += a.vy * dtF

        // Keep within canvas
        const pad = a.currentRadius + 12
        a.x = Math.max(pad, Math.min(W - pad, a.x))
        a.y = Math.max(pad + 38, Math.min(H - pad - 10, a.y))

        // Radius easing
        a.currentRadius += (a.targetRadius - a.currentRadius) * 0.1 * dtF

        // Entry pop spring
        const age = Date.now() - a.birthTime
        if (age < 700) {
          const t = age / 700
          a.popScale = t < 0.4
            ? t * 2.5 * 1.2
            : 1 + 0.2 * Math.cos((t - 0.4) * Math.PI * 1.6) * Math.max(0, 1 - t)
        } else {
          a.popScale = 1
        }
      }

      // ── Render bubbles ────────────────────────────────────────────────
      // Largest first (behind), smallest on top (readable labels in front)
      const sorted = [...bubbles].sort((a, b) => b.currentRadius - a.currentRadius)

      for (const bub of sorted) {
        if (bub.alpha <= 0.01 || bub.currentRadius < 2) continue

        bub.pulsePhase += dt * 0.0025

        const breathAmp = bub.growthRate > 2 ? 0.04 : 0.012
        const breathe = 1 + Math.sin(bub.pulsePhase) * breathAmp
        const scale = breathe * bub.popScale
        const r = bub.currentRadius * scale
        const a = bub.alpha
        const col = growthColor(bub.growthRate)

        // -- Outer halo --
        const haloR = r * 2.4
        const halo = ctx.createRadialGradient(bub.x, bub.y, r * 0.5, bub.x, bub.y, haloR)
        halo.addColorStop(0, rgba(col.glow, a * 0.22))
        halo.addColorStop(0.4, rgba(col.glow, a * 0.08))
        halo.addColorStop(1, 'transparent')
        ctx.fillStyle = halo
        ctx.beginPath()
        ctx.arc(bub.x, bub.y, haloR, 0, Math.PI * 2)
        ctx.fill()

        // -- Glass fill --
        ctx.beginPath()
        ctx.arc(bub.x, bub.y, r, 0, Math.PI * 2)
        const glass = ctx.createRadialGradient(
          bub.x - r * 0.2, bub.y - r * 0.3, 0,
          bub.x, bub.y, r,
        )
        glass.addColorStop(0, rgba(col.glow, a * 0.55))
        glass.addColorStop(0.35, rgba(col.glow, a * 0.30))
        glass.addColorStop(0.7, rgba(col.glow, a * 0.16))
        glass.addColorStop(1, rgba(col.glow, a * 0.09))
        ctx.fillStyle = glass
        ctx.fill()

        // -- Highlight crescent (top-left specular) --
        ctx.save()
        ctx.beginPath()
        ctx.arc(bub.x, bub.y, r, 0, Math.PI * 2)
        ctx.clip()

        const specX = bub.x - r * 0.3
        const specY = bub.y - r * 0.35
        const specR = r * 0.7
        const spec = ctx.createRadialGradient(specX, specY, 0, specX, specY, specR)
        spec.addColorStop(0, rgba('#ffffff', a * 0.2))
        spec.addColorStop(0.5, rgba('#ffffff', a * 0.06))
        spec.addColorStop(1, 'transparent')
        ctx.fillStyle = spec
        ctx.beginPath()
        ctx.arc(specX, specY, specR, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()

        // -- Border ring --
        ctx.beginPath()
        ctx.arc(bub.x, bub.y, r, 0, Math.PI * 2)
        ctx.strokeStyle = rgba(col.glow, a * 0.5)
        ctx.lineWidth = 1.5
        ctx.stroke()

        // -- Growing pulse ring --
        if (bub.growthRate > 2) {
          const pa = (Math.sin(bub.pulsePhase * 3) * 0.5 + 0.5) * a * 0.18
          ctx.beginPath()
          ctx.arc(bub.x, bub.y, r + 4, 0, Math.PI * 2)
          ctx.strokeStyle = rgba(col.glow, pa)
          ctx.lineWidth = 0.7
          ctx.stroke()
        }

        // -- Label --
        ctx.save()
        ctx.globalAlpha = a

        const tagText = '#' + bub.tag
        const maxW = r * 1.65

        let fs = Math.max(11, Math.min(20, r * 0.42))
        ctx.font = `600 ${fs}px "Outfit", sans-serif`
        let tw = ctx.measureText(tagText).width

        while (tw > maxW && fs > 8) {
          fs -= 0.5
          ctx.font = `600 ${fs}px "Outfit", sans-serif`
          tw = ctx.measureText(tagText).width
        }

        let label = tagText
        if (tw > maxW) {
          while (ctx.measureText(label + '\u2026').width > maxW && label.length > 3) {
            label = label.slice(0, -1)
          }
          label += '\u2026'
        }

        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        // Dark backing shadow for contrast
        ctx.shadowColor = 'rgba(0,0,0,0.6)'
        ctx.shadowBlur = 6
        ctx.fillStyle = col.text
        ctx.fillText(label, bub.x, bub.y - 5)

        // Colored glow pass
        ctx.shadowColor = rgba(col.glow, 0.5)
        ctx.shadowBlur = 10
        ctx.fillText(label, bub.x, bub.y - 5)
        ctx.shadowBlur = 0

        // Count beneath
        const cs = Math.max(9, Math.min(12, r * 0.24))
        ctx.font = `400 ${cs}px "JetBrains Mono", monospace`
        ctx.fillStyle = rgba(col.accent, 0.75)
        ctx.shadowColor = 'rgba(0,0,0,0.4)'
        ctx.shadowBlur = 3
        const arrow = bub.growthRate > 0.5 ? ' \u2191' : bub.growthRate < -0.5 ? ' \u2193' : ''
        ctx.fillText(`${bub.count}${arrow}`, bub.x, bub.y + fs * 0.55 + 2)
        ctx.shadowBlur = 0

        ctx.restore()
      }

      // ── Idle state: waiting for data ──────────────────────────────────
      if (bubbles.length === 0) {
        ctx.save()
        const breathe = 0.25 + Math.sin(timestamp * 0.0012) * 0.1

        const dotR = 3 + Math.sin(timestamp * 0.002)
        const dotGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 45)
        dotGlow.addColorStop(0, rgba('#50a8e8', breathe * 0.3))
        dotGlow.addColorStop(0.3, rgba('#50a8e8', breathe * 0.08))
        dotGlow.addColorStop(1, 'transparent')
        ctx.fillStyle = dotGlow
        ctx.beginPath()
        ctx.arc(cx, cy, 45, 0, Math.PI * 2)
        ctx.fill()

        ctx.beginPath()
        ctx.arc(cx, cy, dotR, 0, Math.PI * 2)
        ctx.fillStyle = rgba('#50a8e8', breathe * 0.6)
        ctx.fill()

        ctx.globalAlpha = breathe
        ctx.font = '12px "Outfit", sans-serif'
        ctx.fillStyle = '#607890'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('Listening for trends\u2026', cx, cy + 30)
        ctx.restore()
      }

      // ── Zone header ───────────────────────────────────────────────────
      ctx.save()
      ctx.globalAlpha = 0.25
      ctx.font = '600 9px "JetBrains Mono", monospace'
      ctx.fillStyle = '#607890'
      ctx.textAlign = 'center'
      ctx.letterSpacing = '3px'
      ctx.fillText('TRENDING', cx, 22)
      ctx.restore()

      animFrameRef.current = requestAnimationFrame(render)
    }

    animFrameRef.current = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-[720px]"
      style={{ display: 'block' }}
    />
  )
})
