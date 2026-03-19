import { useRef, useEffect } from 'react'

interface RisingParticle {
  x: number
  y: number
  speed: number
  size: number
  hue: number
  phase: number
  drift: number
}

const risingParticles: RisingParticle[] = []
let particlesInit = false
const WAVE_POINTS = 200

function initParticles() {
  if (particlesInit) return
  particlesInit = true
  for (let i = 0; i < 120; i++) {
    risingParticles.push({
      x: Math.random(),
      y: Math.random(),
      speed: 0.001 + Math.random() * 0.003,
      size: 1 + Math.random() * 2.5,
      hue: 140 + Math.random() * 40,
      phase: Math.random() * Math.PI * 2,
      drift: (Math.random() - 0.5) * 0.0005,
    })
  }
}

export function GoLive() {
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

      // Background
      const bg = ctx.createRadialGradient(cx, cy - 60, 0, cx, cy, Math.max(W, H) * 0.7)
      bg.addColorStop(0, '#0a1218')
      bg.addColorStop(0.4, '#080e14')
      bg.addColorStop(1, '#040810')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      // Grid
      const pulse = 0.6 + 0.4 * Math.sin(t * 0.002)
      const spacing = 50
      for (let x = 0; x < W; x += spacing) {
        const dist = Math.abs(x - cx) / (W / 2)
        const alpha = (1 - dist * 0.7) * pulse
        ctx.strokeStyle = `hsla(160, 60%, 40%, ${0.04 * alpha})`
        ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
      }
      for (let y = 0; y < H; y += spacing) {
        const dist = Math.abs(y - cy) / (H / 2)
        const alpha = (1 - dist * 0.7) * pulse
        ctx.strokeStyle = `hsla(160, 60%, 40%, ${0.04 * alpha})`
        ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
      }

      // Rising particles
      for (const p of risingParticles) {
        p.y -= p.speed
        p.x += p.drift + Math.sin(t * 0.003 + p.phase) * 0.0002
        if (p.y < -0.05) { p.y = 1.05; p.x = Math.random() }
        if (p.x < 0) p.x += 1; if (p.x > 1) p.x -= 1

        const px = p.x * W
        const py = p.y * H
        const pp = 0.5 + 0.5 * Math.sin(t * 0.005 + p.phase)

        ctx.beginPath()
        ctx.arc(px, py, p.size * pp, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${p.hue}, 70%, 65%, ${0.15 + pp * 0.2})`
        ctx.fill()
      }

      // Central glow
      const heroGlow = ctx.createRadialGradient(cx, cy - 60, 0, cx, cy - 60, 400)
      heroGlow.addColorStop(0, 'rgba(52, 211, 153, 0.07)')
      heroGlow.addColorStop(0.5, 'rgba(52, 211, 153, 0.02)')
      heroGlow.addColorStop(1, 'transparent')
      ctx.fillStyle = heroGlow
      ctx.fillRect(0, 0, W, H)

      // Waveform — bottom section
      const waveY = cy + 110
      const waveH = 180
      const waveLeft = 60
      const waveRight = W - 60
      const waveWidth = waveRight - waveLeft

      // Waveform fill gradient
      const waveGrad = ctx.createLinearGradient(0, waveY, 0, waveY + waveH)
      waveGrad.addColorStop(0, 'rgba(52, 211, 153, 0.12)')
      waveGrad.addColorStop(1, 'rgba(52, 211, 153, 0.01)')

      // Primary waveform fill
      ctx.beginPath()
      ctx.moveTo(waveLeft, waveY + waveH)
      for (let i = 0; i < WAVE_POINTS; i++) {
        const x = waveLeft + (i / (WAVE_POINTS - 1)) * waveWidth
        const val =
          Math.sin(i * 0.08 + t * 0.004) * 0.3 +
          Math.sin(i * 0.03 - t * 0.003) * 0.25 +
          Math.sin(i * 0.15 + t * 0.006) * 0.1 +
          Math.sin(i * 0.02 + t * 0.001) * 0.15 +
          0.5
        ctx.lineTo(x, waveY + waveH - val * waveH)
      }
      ctx.lineTo(waveRight, waveY + waveH)
      ctx.closePath()
      ctx.fillStyle = waveGrad
      ctx.fill()

      // Primary waveform stroke
      ctx.beginPath()
      for (let i = 0; i < WAVE_POINTS; i++) {
        const x = waveLeft + (i / (WAVE_POINTS - 1)) * waveWidth
        const val =
          Math.sin(i * 0.08 + t * 0.004) * 0.3 +
          Math.sin(i * 0.03 - t * 0.003) * 0.25 +
          Math.sin(i * 0.15 + t * 0.006) * 0.1 +
          Math.sin(i * 0.02 + t * 0.001) * 0.15 +
          0.5
        const y = waveY + waveH - val * waveH
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.5)'
      ctx.lineWidth = 2
      ctx.stroke()

      // Secondary waveform
      ctx.beginPath()
      for (let i = 0; i < WAVE_POINTS; i++) {
        const x = waveLeft + (i / (WAVE_POINTS - 1)) * waveWidth
        const val = Math.sin(i * 0.06 - t * 0.003) * 0.2 +
                    Math.sin(i * 0.04 + t * 0.002) * 0.2 + 0.4
        const y = waveY + waveH - val * waveH
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = 'rgba(100, 160, 255, 0.25)'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Faint reference lines in waveform area
      ctx.globalAlpha = 0.06
      ctx.strokeStyle = '#34d399'
      ctx.lineWidth = 0.5
      for (let i = 1; i < 4; i++) {
        const ly = waveY + (waveH / 4) * i
        ctx.beginPath(); ctx.moveTo(waveLeft, ly); ctx.lineTo(waveRight, ly); ctx.stroke()
      }
      ctx.globalAlpha = 1

      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="relative w-full h-full">
      {/* Canvas background: grid, particles, glow, waveform */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />

      {/* DOM overlay content */}
      <div className="absolute inset-0 flex flex-col items-center pointer-events-none z-10">
        {/* Top label */}
        <p className="mt-[30px] text-[13px] font-normal tracking-[8px] text-[rgba(180,210,200,0.7)]">
          READY TO STREAM
        </p>

        {/* Hero text */}
        <h1
          className="mt-auto mb-0 text-[160px] font-extrabold text-white leading-none"
          style={{
            textShadow: '0 0 30px #34d399, 0 0 60px #34d399, 0 0 10px rgba(52,211,153,0.5)',
            marginTop: '140px',
          }}
        >
          Go Live
        </h1>

        {/* Subtitle */}
        <p className="mt-[14px] text-[20px] font-normal text-[rgba(200,220,210,0.8)]">
          Start broadcasting with one command
        </p>

        {/* Command */}
        <p className="mt-[22px] text-[15px] font-medium font-mono text-green/60">
          $ dazzle stage broadcast on
        </p>

        {/* Divider */}
        <div className="mt-[14px] w-[600px] h-[1px] bg-green/20" />
      </div>

      {/* Corner branding */}
      <CornerBranding />
    </div>
  )
}

function CornerBranding() {
  const color = 'hsla(160, 60%, 60%, 0.6)'
  const textColor = 'hsla(160, 40%, 70%, 0.7)'
  return (
    <div className="absolute inset-0 pointer-events-none opacity-50 z-10">
      <div className="absolute top-[30px] left-[30px] w-[25px] h-[25px] border-t-2 border-l-2" style={{ borderColor: color }} />
      <div className="absolute top-[30px] right-[30px] w-[25px] h-[25px] border-t-2 border-r-2" style={{ borderColor: color }} />
      <div className="absolute bottom-[30px] left-[30px] w-[25px] h-[25px] border-b-2 border-l-2" style={{ borderColor: color }} />
      <div className="absolute bottom-[30px] right-[30px] w-[25px] h-[25px] border-b-2 border-r-2" style={{ borderColor: color }} />
      <span className="absolute bottom-[38px] right-[40px] text-[11px] font-medium" style={{ color: textColor }}>
        DAZZLE.FM
      </span>
    </div>
  )
}
