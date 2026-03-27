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

// ── Layout ────────────────────────────────────────────────────────────────

const MAX_BUBBLES = 9
const MAX_MOTES = 18

// Reference dimension the original constants were tuned against
const REF_DIM = 528

// Radii as fractions of the container's shorter dimension
const MIN_RADIUS_FRAC = 0.04
const MAX_RADIUS_FRAC = 0.10

// How fast radius eases toward target
const RADIUS_LERP = 0.07

// Physics constants
const CENTER_GRAVITY = 0.002
const DAMPING = 0.92
const MAX_VELOCITY = 2
const OVERLAP_GAP = 4
const BOUNDARY_NUDGE = 0.01

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

// ── Stats formatting ──────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

// ── Component ──────────────────────────────────────────────────────────────

export const TrendingZone = forwardRef<
  { addEvent: (event: ParsedEvent) => void },
  { stats: FirehoseStats }
>(function TrendingZone({ stats }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const bubblesRef = useRef<Bubble[]>([])
  const motesRef = useRef<AmbientMote[]>([])
  const animFrameRef = useRef(0)
  const lastFrameTimeRef = useRef(0)
  const prevCountsRef = useRef<Map<string, number>>(new Map())
  const sizeRef = useRef({ w: REF_DIM, h: 720 })
  const startTimeRef = useRef(Date.now())
  const statsRef = useRef(stats)

  // Keep stats ref in sync so the animation loop can read latest values
  useEffect(() => {
    statsRef.current = stats
  }, [stats])

  const addEvent = useCallback((_event: ParsedEvent) => {
    // Hashtag data arrives via stats.hashtagCounts — no per-event work needed
  }, [])

  useImperativeHandle(ref, () => ({ addEvent }), [addEvent])

  // Resize canvas backing store when container changes
  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      const w = Math.round(width)
      const h = Math.round(height)
      if (w === 0 || h === 0) return

      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)

      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      }

      sizeRef.current = { w, h }
    })

    observer.observe(wrap)
    return () => observer.disconnect()
  }, [])

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

    const { w, h } = sizeRef.current
    const ref = Math.min(w, h)
    const minR = ref * MIN_RADIUS_FRAC
    const maxR = ref * MAX_RADIUS_FRAC
    const radiusScale = ref / REF_DIM

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
        bubble.targetRadius = Math.max(0, bubble.targetRadius - 2 * radiusScale)
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
    const centerX = w / 2
    const centerY = h / 2

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
          minR,
          Math.min(maxR, minR + Math.sqrt(count) * 4.8 * radiusScale),
        )
        existing.alpha = Math.min(1, existing.alpha + 0.12)
      } else if (bubbles.length < MAX_BUBBLES) {
        const newTargetR = Math.max(
          minR,
          Math.min(maxR, minR + Math.sqrt(count) * 4.8 * radiusScale),
        )

        // Spawn near the edge of the cluster at a random angle
        const spawnAngle = Math.random() * Math.PI * 2
        const clusterRadius = bubbles.length > 0
          ? Math.max(...bubbles.filter((b) => !b.dying).map((b) => {
              const dx = b.x - centerX
              const dy = b.y - centerY
              return Math.sqrt(dx * dx + dy * dy) + b.currentRadius
            }), 60 * radiusScale)
          : 60 * radiusScale
        const spawnDist = clusterRadius + newTargetR + OVERLAP_GAP

        bubbles.push({
          tag,
          x: centerX + Math.cos(spawnAngle) * spawnDist,
          y: centerY + Math.sin(spawnAngle) * spawnDist,
          vx: 0,
          vy: 0,
          targetRadius: newTargetR,
          currentRadius: 5 * radiusScale,
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

    // Seed ambient motes using initial container size
    const motes = motesRef.current
    const { w: initW, h: initH } = sizeRef.current
    const initScale = Math.min(initW, initH) / REF_DIM
    for (let i = motes.length; i < MAX_MOTES; i++) {
      motes.push({
        x: Math.random() * initW,
        y: Math.random() * initH,
        vx: (Math.random() - 0.5) * 0.12 * initScale,
        vy: (Math.random() - 0.5) * 0.12 * initScale,
        radius: (0.4 + Math.random() * 0.9) * initScale,
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

      // Read live container dimensions each frame
      const { w: W, h: H } = sizeRef.current
      const ref = Math.min(W, H)
      const s = ref / REF_DIM
      const cx = W / 2
      const cy = H / 2 + 12 * s

      // ── Background ────────────────────────────────────────────────────
      ctx.fillStyle = '#06080c'
      ctx.fillRect(0, 0, W, H)

      // Soft radial bloom behind bubbles
      const bloomRadius = 320 * s
      const bgGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, bloomRadius)
      bgGlow.addColorStop(0, 'rgba(25, 55, 95, 0.03)')
      bgGlow.addColorStop(0.5, 'rgba(15, 35, 65, 0.015)')
      bgGlow.addColorStop(1, 'transparent')
      ctx.fillStyle = bgGlow
      ctx.fillRect(0, 0, W, H)

      // ── Ambient motes ─────────────────────────────────────────────────
      for (const m of motesRef.current) {
        m.life += dt
        m.phase += 0.003 * dtF

        m.vx += Math.sin(m.phase * 1.2 + m.y * 0.004) * 0.001 * s * dtF
        m.vy += Math.cos(m.phase * 0.9 + m.x * 0.004) * 0.001 * s * dtF
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
          m.radius = (0.4 + Math.random() * 0.9) * s
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

      // ── Physics simulation ──────────────────────────────────────────────

      // Step 1: Apply forces, damping, velocity cap, integrate position, lerp radius
      for (const b of bubbles) {
        // Entry pop animation
        const age = Date.now() - b.birthTime
        const entering = age < 700
        if (entering) {
          const t = age / 700
          b.popScale = t < 0.4
            ? t * 2.5 * 1.2
            : 1 + 0.2 * Math.cos((t - 0.4) * Math.PI * 1.6) * Math.max(0, 1 - t)
        } else {
          b.popScale += (1 - b.popScale) * 0.1 * dtF
        }

        // Gentle center gravity
        b.vx += (cx - b.x) * CENTER_GRAVITY * dtF
        b.vy += (cy - b.y) * CENTER_GRAVITY * dtF

        // Damping
        const dampPerFrame = Math.pow(DAMPING, dtF)
        b.vx *= dampPerFrame
        b.vy *= dampPerFrame

        // Velocity cap
        const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy)
        if (speed > MAX_VELOCITY) {
          b.vx = (b.vx / speed) * MAX_VELOCITY
          b.vy = (b.vy / speed) * MAX_VELOCITY
        }

        // Integrate position
        b.x += b.vx * dtF
        b.y += b.vy * dtF

        // Radius easing
        b.currentRadius += (b.targetRadius - b.currentRadius) * RADIUS_LERP * dtF
      }

      // Step 2: Hard overlap resolution -- directly push overlapping pairs apart
      for (let i = 0; i < bubbles.length; i++) {
        const a = bubbles[i]!
        for (let j = i + 1; j < bubbles.length; j++) {
          const b = bubbles[j]!
          const dx = b.x - a.x
          const dy = b.y - a.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          const minDist = a.currentRadius + b.currentRadius + OVERLAP_GAP

          if (dist < minDist) {
            // Compute correction along the connecting axis
            const overlap = minDist - dist
            const halfOverlap = overlap / 2

            if (dist < 0.01) {
              // Bubbles are nearly coincident -- push apart along a random axis
              const angle = Math.random() * Math.PI * 2
              const nx = Math.cos(angle)
              const ny = Math.sin(angle)
              a.x -= nx * halfOverlap
              a.y -= ny * halfOverlap
              b.x += nx * halfOverlap
              b.y += ny * halfOverlap
            } else {
              const nx = dx / dist
              const ny = dy / dist
              a.x -= nx * halfOverlap
              a.y -= ny * halfOverlap
              b.x += nx * halfOverlap
              b.y += ny * halfOverlap

              // Transfer a tiny bit of velocity for a subtle bounce feel
              const relVx = b.vx - a.vx
              const relVy = b.vy - a.vy
              const relDot = relVx * nx + relVy * ny
              if (relDot < 0) {
                const impulse = relDot * 0.15
                a.vx += impulse * nx
                a.vy += impulse * ny
                b.vx -= impulse * nx
                b.vy -= impulse * ny
              }
            }
          }
        }
      }

      // Step 3: Soft boundary -- nudge bubbles back if they drift too far
      for (const b of bubbles) {
        const pad = b.currentRadius + 12 * s
        const topPad = pad + 38 * s
        const bottomPad = pad + 38 * s

        if (b.x < pad) {
          b.x = pad
          b.vx = Math.abs(b.vx) * 0.3
        } else if (b.x > W - pad) {
          b.x = W - pad
          b.vx = -Math.abs(b.vx) * 0.3
        }

        if (b.y < topPad) {
          b.y = topPad
          b.vy = Math.abs(b.vy) * 0.3
        } else if (b.y > H - bottomPad) {
          b.y = H - bottomPad
          b.vy = -Math.abs(b.vy) * 0.3
        }

        // Extra soft nudge if drifting far from center
        const dxC = b.x - cx
        const dyC = b.y - cy
        const distC = Math.sqrt(dxC * dxC + dyC * dyC)
        const maxDrift = ref * 0.4
        if (distC > maxDrift) {
          b.vx -= (dxC / distC) * BOUNDARY_NUDGE * (distC - maxDrift) * dtF
          b.vy -= (dyC / distC) * BOUNDARY_NUDGE * (distC - maxDrift) * dtF
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
        const popScale = breathe * bub.popScale
        const r = bub.currentRadius * popScale
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
        ctx.lineWidth = 1.5 * s
        ctx.stroke()

        // -- Growing pulse ring --
        if (bub.growthRate > 2) {
          const pa = (Math.sin(bub.pulsePhase * 3) * 0.5 + 0.5) * a * 0.18
          ctx.beginPath()
          ctx.arc(bub.x, bub.y, r + 4 * s, 0, Math.PI * 2)
          ctx.strokeStyle = rgba(col.glow, pa)
          ctx.lineWidth = 0.7 * s
          ctx.stroke()
        }

        // -- Label (fade out when bubble is too small to fit text) --
        const labelHideRadius = 20
        const labelFullRadius = 30
        const textOpacity = r <= labelHideRadius
          ? 0
          : r >= labelFullRadius
            ? 1
            : (r - labelHideRadius) / (labelFullRadius - labelHideRadius)

        if (textOpacity > 0) {
          ctx.save()
          ctx.globalAlpha = a * textOpacity

          const tagText = '#' + bub.tag
          const maxLabelW = r * 1.65

          // Font sizes scale with bubble radius (which already scales with container)
          const minFs = 11 * s
          const maxFs = 20 * s
          let fs = Math.max(minFs, Math.min(maxFs, r * 0.42))
          ctx.font = `600 ${fs}px "Outfit", sans-serif`
          let tw = ctx.measureText(tagText).width

          const minFsCap = 8 * s
          while (tw > maxLabelW && fs > minFsCap) {
            fs -= 0.5
            ctx.font = `600 ${fs}px "Outfit", sans-serif`
            tw = ctx.measureText(tagText).width
          }

          let label = tagText
          if (tw > maxLabelW) {
            while (ctx.measureText(label + '\u2026').width > maxLabelW && label.length > 3) {
              label = label.slice(0, -1)
            }
            label += '\u2026'
          }

          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'

          // Dark backing shadow for contrast
          const labelOffset = 5 * s
          ctx.shadowColor = 'rgba(0,0,0,0.6)'
          ctx.shadowBlur = 6 * s
          ctx.fillStyle = col.text
          ctx.fillText(label, bub.x, bub.y - labelOffset)

          // Colored glow pass
          ctx.shadowColor = rgba(col.glow, 0.5)
          ctx.shadowBlur = 10 * s
          ctx.fillText(label, bub.x, bub.y - labelOffset)
          ctx.shadowBlur = 0

          // Count beneath
          const minCs = 9 * s
          const maxCs = 12 * s
          const cs = Math.max(minCs, Math.min(maxCs, r * 0.24))
          ctx.font = `400 ${cs}px "JetBrains Mono", monospace`
          ctx.fillStyle = rgba(col.accent, 0.75)
          ctx.shadowColor = 'rgba(0,0,0,0.4)'
          ctx.shadowBlur = 3 * s
          const arrow = bub.growthRate > 0.5 ? ' \u2191' : bub.growthRate < -0.5 ? ' \u2193' : ''
          ctx.fillText(`${bub.count}${arrow}`, bub.x, bub.y + fs * 0.55 + 2 * s)
          ctx.shadowBlur = 0

          ctx.restore()
        }
      }

      // ── Idle state: waiting for data ──────────────────────────────────
      if (bubbles.length === 0) {
        ctx.save()
        const breathe = 0.25 + Math.sin(timestamp * 0.0012) * 0.1

        const dotR = (3 + Math.sin(timestamp * 0.002)) * s
        const idleGlowR = 45 * s
        const dotGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, idleGlowR)
        dotGlow.addColorStop(0, rgba('#50a8e8', breathe * 0.3))
        dotGlow.addColorStop(0.3, rgba('#50a8e8', breathe * 0.08))
        dotGlow.addColorStop(1, 'transparent')
        ctx.fillStyle = dotGlow
        ctx.beginPath()
        ctx.arc(cx, cy, idleGlowR, 0, Math.PI * 2)
        ctx.fill()

        ctx.beginPath()
        ctx.arc(cx, cy, dotR, 0, Math.PI * 2)
        ctx.fillStyle = rgba('#50a8e8', breathe * 0.6)
        ctx.fill()

        ctx.globalAlpha = breathe
        ctx.font = `${12 * s}px "Outfit", sans-serif`
        ctx.fillStyle = '#607890'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('Listening for trends\u2026', cx, cy + 30 * s)
        ctx.restore()
      }

      // ── Zone header (matches THE STREAM styling) ──────────────────────
      ctx.save()
      ctx.font = '700 14px "JetBrains Mono", monospace'
      ctx.textAlign = 'center'
      ctx.letterSpacing = '3px'

      // Pass 1: outer blue glow
      ctx.globalAlpha = 0.6
      ctx.fillStyle = '#4a9eff'
      ctx.shadowColor = 'rgba(0, 133, 255, 0.8)'
      ctx.shadowBlur = 20
      ctx.fillText('TRENDING', cx, 24)

      // Pass 2: mid glow
      ctx.globalAlpha = 0.85
      ctx.fillStyle = '#c8ddf5'
      ctx.shadowColor = 'rgba(0, 133, 255, 0.5)'
      ctx.shadowBlur = 8
      ctx.fillText('TRENDING', cx, 24)

      // Pass 3: crisp top layer
      ctx.globalAlpha = 0.95
      ctx.fillStyle = '#e2eaf4'
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      ctx.fillText('TRENDING', cx, 24)

      ctx.restore()

      // ── Stats bar at the bottom ────────────────────────────────────
      const st = statsRef.current
      const barH = 32 * s
      const barY = H - barH

      // Dark background strip
      ctx.fillStyle = 'rgba(6, 8, 12, 0.75)'
      ctx.fillRect(0, barY, W, barH)
      // Subtle top border
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)'
      ctx.fillRect(0, barY, W, 1)

      const uptimeSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000)
      const items = [
        { label: 'EVENTS', value: formatNumber(st.totalEvents) },
        { label: 'UPTIME', value: formatUptime(uptimeSeconds) },
        { label: 'BANDWIDTH', value: `~${(st.eventsPerSecond * 0.5).toFixed(0)} KB/s` },
        { label: 'POSTS', value: formatNumber(st.postCount + st.replyCount) },
      ]

      const fs10 = 10 * s
      const sectionW = W / items.length
      const textY = barY + barH / 2

      ctx.save()
      ctx.textBaseline = 'middle'
      for (let i = 0; i < items.length; i++) {
        const item = items[i]!
        const sectionCx = sectionW * i + sectionW / 2

        // Label
        ctx.font = `500 ${fs10 * 0.8}px "JetBrains Mono", monospace`
        ctx.fillStyle = '#506070'
        ctx.textAlign = 'right'
        ctx.fillText(item.label, sectionCx - 4 * s, textY)

        // Value
        ctx.font = `600 ${fs10}px "JetBrains Mono", monospace`
        ctx.fillStyle = '#c0cad8'
        ctx.textAlign = 'left'
        ctx.fillText(item.value, sectionCx + 4 * s, textY)
      }
      ctx.restore()

      animFrameRef.current = requestAnimationFrame(render)
    }

    animFrameRef.current = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [])

  return (
    <div ref={wrapRef} className="w-full h-full" style={{ minHeight: 0 }}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ display: 'block' }}
      />
    </div>
  )
})
