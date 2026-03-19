import { useRef, useEffect } from 'react'

interface FlowParticle {
  connection: number
  progress: number
  speed: number
  size: number
  hue: number
}

const flowParticles: FlowParticle[] = []
let particlesInitialized = false

function initFlowParticles() {
  if (particlesInitialized) return
  particlesInitialized = true
  for (let i = 0; i < 12; i++) {
    flowParticles.push({
      connection: Math.floor(Math.random() * 3),
      progress: Math.random(),
      speed: 0.0008 + Math.random() * 0.001,
      size: 2 + Math.random() * 2,
      hue: 220 + Math.random() * 100,
    })
  }
}

const pipelineBoxes = [
  { label: 'Your Code', sub: 'HTML + JS + CSS', hue: 210, icon: '</>' },
  { label: 'dazzle sync', sub: 'File Sync + HMR', hue: 255, icon: '>' },
  { label: 'Cloud Renderer', sub: '1280 x 720', hue: 290, icon: 'D' },
  { label: 'Broadcast', sub: 'Kick / Twitch / YT', hue: 340, icon: 'L' },
] as const

export function HowItWorks() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    initFlowParticles()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = 1280
    const H = 720
    canvas.width = W
    canvas.height = H

    // Box layout constants matching the original
    const boxH = 100, boxW = 200, gap = 65
    const cx = W / 2, cy = H / 2
    const boxY = cy - boxH / 2 + 15
    const startX = cx - (4 * boxW + 3 * gap) / 2

    const boxes = pipelineBoxes.map((b, i) => ({
      ...b,
      x: startX + i * (boxW + gap),
      y: boxY,
      w: boxW,
      h: boxH,
    }))

    const connections = [
      { from: boxes[0]!, to: boxes[1]! },
      { from: boxes[1]!, to: boxes[2]! },
      { from: boxes[2]!, to: boxes[3]! },
    ]

    let raf: number
    let frame = 0

    const loop = () => {
      frame++
      const t = frame

      // Background
      const bg = ctx.createLinearGradient(0, 0, W, H)
      bg.addColorStop(0, '#070515')
      bg.addColorStop(0.5, '#0a0820')
      bg.addColorStop(1, '#060412')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      // Grid
      drawGrid(ctx, W, H, t)

      // Grid highlight lines
      const gridPulse = 0.5 + 0.5 * Math.sin(t * 0.003)
      ctx.strokeStyle = `hsla(260, 80%, 55%, ${0.03 * gridPulse})`
      ctx.lineWidth = 2
      const hlY = cy + Math.sin(t * 0.002) * 50
      ctx.beginPath(); ctx.moveTo(0, hlY); ctx.lineTo(W, hlY); ctx.stroke()
      const vlX = cx + Math.cos(t * 0.0015) * 100
      ctx.beginPath(); ctx.moveTo(vlX, 0); ctx.lineTo(vlX, H); ctx.stroke()

      // Draw connections with animated dashes
      for (const conn of connections) {
        const fromX = conn.from.x + conn.from.w
        const toX = conn.to.x
        const midY = boxY + boxH / 2

        ctx.save()
        ctx.strokeStyle = `hsla(${conn.from.hue + 20}, 70%, 60%, 0.3)`
        ctx.lineWidth = 2.5
        ctx.setLineDash([10, 14])
        ctx.lineDashOffset = -t * 0.06
        ctx.beginPath()
        ctx.moveTo(fromX + 10, midY)
        ctx.lineTo(toX - 10, midY)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.restore()

        // Arrow head
        ctx.fillStyle = `hsla(${conn.to.hue}, 70%, 60%, 0.6)`
        ctx.beginPath()
        ctx.moveTo(toX - 10, midY - 7)
        ctx.lineTo(toX - 2, midY)
        ctx.lineTo(toX - 10, midY + 7)
        ctx.fill()
      }

      // Flow particles
      for (const fp of flowParticles) {
        fp.progress += fp.speed
        if (fp.progress > 1) {
          fp.progress -= 1
          fp.connection = (fp.connection + 1) % 3
        }

        const conn = connections[fp.connection]
        if (!conn) continue
        const fromX = conn.from.x + conn.from.w + 10
        const toX = conn.to.x - 10
        const midY = boxY + boxH / 2

        const px = fromX + (toX - fromX) * fp.progress
        const py = midY + Math.sin(fp.progress * Math.PI * 2 + t * 0.005) * 4

        // Outer glow
        ctx.beginPath()
        ctx.arc(px, py, fp.size * 3, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${fp.hue}, 90%, 70%, 0.15)`
        ctx.fill()

        // Core dot
        ctx.beginPath()
        ctx.arc(px, py, fp.size, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${fp.hue}, 90%, 80%, 0.9)`
        ctx.fill()
      }

      // Draw boxes (glow only — labels rendered in DOM)
      for (const box of boxes) {
        const pulse = 0.7 + 0.3 * Math.sin(t * 0.003 + boxes.indexOf(box) * 1.8)

        // Outer glow
        const glow = ctx.createRadialGradient(
          box.x + box.w / 2, box.y + box.h / 2, 0,
          box.x + box.w / 2, box.y + box.h / 2, box.w * 0.9,
        )
        glow.addColorStop(0, `hsla(${box.hue}, 80%, 50%, ${0.07 * pulse})`)
        glow.addColorStop(1, 'transparent')
        ctx.fillStyle = glow
        ctx.fillRect(box.x - 60, box.y - 60, box.w + 120, box.h + 120)
      }

      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const boxW = 200, boxH = 100, gap = 65
  const startX = 640 - (4 * boxW + 3 * gap) / 2

  return (
    <div className="relative w-full h-full">
      {/* Canvas background for grid, connections, flow particles, glows */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />

      {/* Title */}
      <h2
        className="absolute top-[36px] left-1/2 -translate-x-1/2 text-[42px] font-bold text-white z-10"
        style={{ textShadow: '0 0 20px #a78bfa, 0 0 40px #a78bfa' }}
      >
        How It Works
      </h2>

      {/* Pipeline boxes — DOM */}
      {pipelineBoxes.map((box, i) => {
        const left = startX + i * (boxW + gap)
        const top = 360 - boxH / 2 + 15
        return (
          <div
            key={box.label}
            className="absolute rounded-xl border animate-box-pulse z-10"
            style={{
              left,
              top,
              width: boxW,
              height: boxH,
              backgroundColor: `hsla(${box.hue}, 35%, 8%, 0.92)`,
              borderColor: `hsla(${box.hue}, 65%, 55%, 0.45)`,
            }}
          >
            {/* Top accent line */}
            <div
              className="absolute top-[1px] left-[1px] right-[1px] h-[3px] rounded-t-xl"
              style={{ backgroundColor: `hsla(${box.hue}, 70%, 55%, 0.2)` }}
            />

            {/* Icon */}
            <div
              className="absolute top-[18px] left-1/2 -translate-x-1/2 text-2xl font-bold opacity-30"
              style={{ color: `hsla(${box.hue}, 70%, 65%, 1)` }}
            >
              {box.icon}
            </div>

            {/* Label */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[19px] font-semibold text-center"
              style={{ color: `hsla(${box.hue}, 55%, 85%, 0.95)` }}
            >
              {box.label}
            </div>

            {/* Sub label */}
            <div
              className="absolute bottom-[14px] left-1/2 -translate-x-1/2 text-[13px] font-normal text-center whitespace-nowrap"
              style={{ color: `hsla(${box.hue}, 40%, 65%, 0.7)` }}
            >
              {box.sub}
            </div>
          </div>
        )
      })}

      {/* Bottom subtitle */}
      <p className="absolute bottom-[40px] left-1/2 -translate-x-1/2 text-[14px] font-normal tracking-[4px] text-purple-light/70 z-10">
        SYNC {'/'} RENDER {'/'} BROADCAST
      </p>

      {/* Corner branding */}
      <CornerBranding hue={260} />
    </div>
  )
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.save()
  const pulse = 0.6 + 0.4 * Math.sin(t * 0.002)
  const spacing = 45
  for (let x = 0; x < w; x += spacing) {
    const dist = Math.abs(x - w / 2) / (w / 2)
    const alpha = (1 - dist * 0.7) * pulse
    ctx.strokeStyle = `hsla(260, 60%, 40%, ${0.04 * alpha})`
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
  }
  for (let y = 0; y < h; y += spacing) {
    const dist = Math.abs(y - h / 2) / (h / 2)
    const alpha = (1 - dist * 0.7) * pulse
    ctx.strokeStyle = `hsla(260, 60%, 40%, ${0.04 * alpha})`
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
  }
  ctx.restore()
}

function CornerBranding({ hue }: { hue: number }) {
  const color = `hsla(${hue}, 60%, 60%, 0.6)`
  const textColor = `hsla(${hue}, 40%, 70%, 0.7)`
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
