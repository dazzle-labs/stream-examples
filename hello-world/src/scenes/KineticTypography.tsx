import { useRef, useEffect, useState, useCallback } from 'react'

interface KineticWord {
  text: string
  size: number
  hue: number
  speed: number
  y: number
}

const kineticWords: KineticWord[] = [
  { text: 'Canvas 2D', size: 72, hue: 200, speed: 0.4, y: 0.32 },
  { text: 'WebGL', size: 56, hue: 280, speed: -0.35, y: 0.55 },
  { text: 'CSS Animations', size: 48, hue: 160, speed: 0.55, y: 0.72 },
  { text: 'Web Audio', size: 38, hue: 320, speed: -0.6, y: 0.18 },
  { text: 'DOM Manipulation', size: 30, hue: 240, speed: 0.7, y: 0.87 },
  { text: '60 fps', size: 64, hue: 130, speed: -0.45, y: 0.44 },
  { text: 'localStorage', size: 26, hue: 50, speed: 0.8, y: 0.65 },
  { text: 'Live Events', size: 34, hue: 0, speed: -0.5, y: 0.08 },
  { text: 'Fetch API', size: 28, hue: 190, speed: 0.65, y: 0.93 },
  { text: 'WebSockets', size: 32, hue: 110, speed: -0.55, y: 0.26 },
  { text: 'requestAnimationFrame', size: 22, hue: 260, speed: 0.75, y: 0.5 },
  { text: 'SVG', size: 44, hue: 340, speed: -0.38, y: 0.78 },
]

interface BgParticle {
  x: number
  y: number
  size: number
  hue: number
  speed: number
  phase: number
}

const bgParticles: BgParticle[] = []
let particlesInit = false

function initBgParticles() {
  if (particlesInit) return
  particlesInit = true
  for (let i = 0; i < 150; i++) {
    bgParticles.push({
      x: Math.random(),
      y: Math.random(),
      size: 0.5 + Math.random() * 1.5,
      hue: 200 + Math.random() * 160,
      speed: 0.0001 + Math.random() * 0.0003,
      phase: Math.random() * Math.PI * 2,
    })
  }
}

export function KineticTypography() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [frame, setFrame] = useState(0)

  const tick = useCallback(() => {
    setFrame(f => f + 1)
  }, [])

  // Canvas for background particles and grid
  useEffect(() => {
    initBgParticles()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = 1280
    const H = 720
    canvas.width = W
    canvas.height = H

    let raf: number
    let t = 0

    const loop = () => {
      t++

      // Background
      ctx.fillStyle = '#0d0822'
      ctx.fillRect(0, 0, W, H)

      // Grid
      const pulse = 0.6 + 0.4 * Math.sin(t * 0.002)
      const spacing = 55
      for (let x = 0; x < W; x += spacing) {
        const dist = Math.abs(x - W / 2) / (W / 2)
        const alpha = (1 - dist * 0.7) * pulse
        ctx.strokeStyle = `hsla(280, 60%, 40%, ${0.04 * alpha})`
        ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
      }
      for (let y = 0; y < H; y += spacing) {
        const dist = Math.abs(y - H / 2) / (H / 2)
        const alpha = (1 - dist * 0.7) * pulse
        ctx.strokeStyle = `hsla(280, 60%, 40%, ${0.04 * alpha})`
        ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
      }

      // Background particles
      for (const p of bgParticles) {
        p.x += p.speed
        if (p.x > 1.05) p.x -= 1.1
        const px = p.x * W
        const py = p.y * H + Math.sin(t * 0.002 + p.phase) * 15
        const pp = 0.5 + 0.5 * Math.sin(t * 0.005 + p.phase)
        ctx.beginPath()
        ctx.arc(px, py, p.size * pp, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${p.hue}, 60%, 60%, ${0.15 + pp * 0.15})`
        ctx.fill()
      }

      // Horizontal accent lines
      ctx.globalAlpha = 0.08
      ctx.fillStyle = '#a78bfa'
      ctx.fillRect(0, H * 0.25, W, 1)
      ctx.fillRect(0, H * 0.5, W, 1)
      ctx.fillRect(0, H * 0.75, W, 1)
      ctx.globalAlpha = 1

      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  // RAF for DOM word positions
  useEffect(() => {
    let raf: number
    const loop = () => {
      tick()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [tick])

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Canvas background */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />

      {/* Top label */}
      <p className="absolute top-[36px] left-1/2 -translate-x-1/2 text-[18px] font-normal text-purple-light/80 z-10">
        What You Can Build
      </p>

      {/* Kinetic words — DOM elements with CSS positioning */}
      {kineticWords.map((word) => {
        const time = frame * word.speed
        const W = 1280
        let x: number
        if (word.speed > 0) {
          x = ((time * 0.8) % (W + 600)) - 300
        } else {
          x = W + 300 - ((Math.abs(time) * 0.8) % (W + 600))
        }

        const y = word.y * (720 - 100) + 50
        const cx = W / 2
        const distFromCenter = Math.abs(x - cx) / (cx)
        const fadeEdge = 1 - Math.pow(Math.max(0, distFromCenter - 0.3) / 0.7, 2)
        const alpha = Math.max(0, fadeEdge)

        return (
          <div
            key={word.text}
            className="absolute font-bold z-10 whitespace-nowrap pointer-events-none"
            style={{
              left: x,
              top: y,
              fontSize: word.size,
              color: `hsla(${word.hue}, 75%, 80%, 0.95)`,
              textShadow: `0 0 ${word.size * 0.4}px hsla(${word.hue}, 90%, 60%, 0.3)`,
              opacity: alpha,
              transform: 'translateX(-50%) translateY(-50%)',
            }}
          >
            {word.text}
          </div>
        )
      })}

      {/* Corner branding */}
      <CornerBranding />
    </div>
  )
}

function CornerBranding() {
  const color = 'hsla(280, 60%, 60%, 0.6)'
  const textColor = 'hsla(280, 40%, 70%, 0.7)'
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
