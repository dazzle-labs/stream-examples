import { useRef, useEffect } from 'react'

// Particle state lives outside React to avoid re-init on re-render
interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  hue: number
  phase: number
}

interface EdgeFlourish {
  x: number
  y: number
  side: number
  offset: number
  speed: number
  phase: number
  size: number
}

const particles: Particle[] = []
const edgeFlourishes: EdgeFlourish[] = []
let initialized = false

function initParticles() {
  if (initialized) return
  initialized = true
  for (let i = 0; i < 600; i++) {
    particles.push({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.0003,
      vy: (Math.random() - 0.5) * 0.0003,
      size: Math.random() * 2.5 + 0.5,
      hue: 210 + Math.random() * 80,
      phase: Math.random() * Math.PI * 2,
    })
  }
  for (let i = 0; i < 80; i++) {
    const side = Math.floor(Math.random() * 4)
    let x: number, y: number
    if (side === 0) { x = Math.random(); y = 0 }
    else if (side === 1) { x = Math.random(); y = 1 }
    else if (side === 2) { x = 0; y = Math.random() }
    else { x = 1; y = Math.random() }
    edgeFlourishes.push({
      x, y, side,
      offset: Math.random() * 0.05,
      speed: 0.001 + Math.random() * 0.003,
      phase: Math.random() * Math.PI * 2,
      size: 1 + Math.random() * 2,
    })
  }
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, hue: number, spacing: number) {
  ctx.save()
  const pulse = 0.6 + 0.4 * Math.sin(t * 0.002)
  for (let x = 0; x < w; x += spacing) {
    const distFromCenter = Math.abs(x - w / 2) / (w / 2)
    const lineAlpha = (1 - distFromCenter * 0.7) * pulse
    ctx.strokeStyle = `hsla(${hue}, 60%, 40%, ${0.04 * lineAlpha})`
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
  }
  for (let y = 0; y < h; y += spacing) {
    const distFromCenter = Math.abs(y - h / 2) / (h / 2)
    const lineAlpha = (1 - distFromCenter * 0.7) * pulse
    ctx.strokeStyle = `hsla(${hue}, 60%, 40%, ${0.04 * lineAlpha})`
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
  }
  ctx.restore()
}

export function HelloWorld() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    initParticles()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = 1280
    const H = 720
    canvas.width = W
    canvas.height = H

    let raf: number
    let frame = 0

    const loop = () => {
      frame++
      const t = frame
      const cx = W / 2
      const cy = H / 2

      // Background gradient
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.7)
      bg.addColorStop(0, '#0f0a2e')
      bg.addColorStop(0.5, '#0a0720')
      bg.addColorStop(1, '#030210')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      // Grid
      drawGrid(ctx, W, H, t, 240, 60)

      // Particles
      for (const p of particles) {
        p.x += p.vx + Math.sin(t * 0.001 + p.phase) * 0.00005
        p.y += p.vy + Math.cos(t * 0.001 + p.phase) * 0.00005
        if (p.x < 0) p.x += 1; if (p.x > 1) p.x -= 1
        if (p.y < 0) p.y += 1; if (p.y > 1) p.y -= 1

        const px = p.x * W
        const py = p.y * H
        const pulse = 0.5 + 0.5 * Math.sin(t * 0.004 + p.phase)
        const distToCenter = Math.hypot(px - cx, py - cy) / Math.max(W, H)
        const brightness = 0.4 + 0.6 * (1 - distToCenter)

        ctx.beginPath()
        ctx.arc(px, py, p.size * (0.7 + pulse * 0.5), 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${p.hue + pulse * 30}, 80%, ${50 + pulse * 25}%, ${brightness * (0.4 + pulse * 0.4)})`
        ctx.fill()
      }

      // Connection lines
      ctx.lineWidth = 0.4
      for (let i = 0; i < particles.length; i += 3) {
        const a = particles[i]!
        const ax = a.x * W, ay = a.y * H
        for (let j = i + 3; j < particles.length; j += 4) {
          const b = particles[j]!
          const bx = b.x * W, by = b.y * H
          const d = Math.hypot(ax - bx, ay - by)
          if (d < 90) {
            ctx.beginPath()
            ctx.moveTo(ax, ay); ctx.lineTo(bx, by)
            ctx.strokeStyle = `rgba(150, 130, 255, ${(1 - d / 90) * 0.12})`
            ctx.stroke()
          }
        }
      }

      // Edge flourishes
      for (const f of edgeFlourishes) {
        const wave = Math.sin(t * f.speed + f.phase) * f.offset
        let fx = f.x, fy = f.y
        if (f.side === 0 || f.side === 1) fx += wave
        else fy += wave
        const px = Math.max(0, Math.min(1, fx)) * W
        const py = Math.max(0, Math.min(1, fy)) * H
        const pulse = 0.5 + 0.5 * Math.sin(t * 0.005 + f.phase)
        ctx.beginPath()
        ctx.arc(px, py, f.size * pulse, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(260, 80%, 70%, ${0.3 + pulse * 0.3})`
        ctx.fill()
      }

      // Central glow
      const coreGlow = ctx.createRadialGradient(cx, cy - 20, 0, cx, cy - 20, 300)
      coreGlow.addColorStop(0, 'rgba(120, 90, 255, 0.08)')
      coreGlow.addColorStop(0.5, 'rgba(100, 60, 220, 0.03)')
      coreGlow.addColorStop(1, 'transparent')
      ctx.fillStyle = coreGlow
      ctx.fillRect(0, 0, W, H)

      // Horizontal data line accents
      for (let i = 0; i < 6; i++) {
        const ly = 100 + i * 100
        const lx = 60 + Math.sin(t * 0.002 + i) * 30
        const lw = 40 + Math.sin(t * 0.003 + i * 2) * 20
        ctx.fillStyle = `hsla(${220 + i * 15}, 70%, 60%, 0.08)`
        ctx.fillRect(lx, ly, lw, 1.5)
        ctx.fillRect(W - lx - lw, ly + 20, lw, 1.5)
      }

      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="relative w-full h-full">
      {/* Canvas particle background */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />

      {/* Corner branding — DOM overlay */}
      <CornerBranding />

      {/* Hero text — DOM overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        {/* Top accent line */}
        <div className="w-[200px] h-[1.5px] bg-purple mb-[18px] opacity-40" />

        <h1
          className="text-[92px] font-bold text-white leading-none"
          style={{
            textShadow: '0 0 30px #8b7cf8, 0 0 60px #8b7cf8, 0 0 10px rgba(139,124,248,0.5)',
          }}
        >
          Hello, World
        </h1>

        <p
          className="mt-[22px] text-[17px] font-normal tracking-[7px] text-purple-light/80"
        >
          YOUR FIRST DAZZLE STREAM
        </p>

        {/* Bottom accent line */}
        <div className="w-[160px] h-[1px] bg-purple mt-[12px] opacity-40" />
      </div>
    </div>
  )
}

function CornerBranding() {
  const markClass = 'absolute w-[25px] h-[25px] border-purple-light/60'
  return (
    <div className="absolute inset-0 pointer-events-none opacity-50">
      {/* Top-left */}
      <div
        className={`${markClass} top-[30px] left-[30px] border-t-2 border-l-2`}
      />
      {/* Top-right */}
      <div
        className={`${markClass} top-[30px] right-[30px] border-t-2 border-r-2`}
      />
      {/* Bottom-left */}
      <div
        className={`${markClass} bottom-[30px] left-[30px] border-b-2 border-l-2`}
      />
      {/* Bottom-right */}
      <div
        className={`${markClass} bottom-[30px] right-[30px] border-b-2 border-r-2`}
      />
      {/* Brand text */}
      <span className="absolute bottom-[38px] right-[40px] text-[11px] font-medium text-purple-light/70">
        DAZZLE.FM
      </span>
    </div>
  )
}
