import { useState, useEffect, useRef, useCallback } from 'react'
import { store } from '../data/store'
import type { InfoconLevel } from '../data/types'

const INFOCON_COLORS: Record<InfoconLevel, string> = {
  green: '#06d6a0',
  yellow: '#ffbe0b',
  orange: '#f77f00',
  red: '#ef233c',
}

function formatUTCTime(date: Date): string {
  const hours = date.getUTCHours().toString().padStart(2, '0')
  const minutes = date.getUTCMinutes().toString().padStart(2, '0')
  const seconds = date.getUTCSeconds().toString().padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

function ThreatGauge({ score }: { score: number }) {
  const canvasReference = useRef<HTMLCanvasElement>(null)

  const draw = useCallback((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d')
    if (!context) return

    const size = 28
    const center = size / 2
    const radius = 10
    const startAngle = Math.PI * 0.75
    const endAngle = Math.PI * 2.25
    const sweepAngle = endAngle - startAngle

    context.clearRect(0, 0, size, size)

    context.beginPath()
    context.arc(center, center + 1, radius, startAngle, endAngle)
    context.strokeStyle = 'rgba(255, 255, 255, 0.08)'
    context.lineWidth = 2.5
    context.lineCap = 'round'
    context.stroke()

    const normalizedScore = Math.max(0, Math.min(100, score))
    const filledAngle = startAngle + (sweepAngle * normalizedScore) / 100
    let color = '#00e5ff'
    if (normalizedScore >= 80) color = '#ef233c'
    else if (normalizedScore >= 60) color = '#f77f00'
    else if (normalizedScore >= 40) color = '#ffbe0b'
    else if (normalizedScore >= 20) color = '#00e5ff'

    if (normalizedScore > 0) {
      context.beginPath()
      context.arc(center, center + 1, radius, startAngle, filledAngle)
      context.strokeStyle = color
      context.lineWidth = 2.5
      context.lineCap = 'round'
      context.stroke()
    }

    context.fillStyle = color
    context.font = 'bold 14px monospace'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(String(normalizedScore), center, center + 2)
  }, [score])

  useEffect(() => {
    const canvas = canvasReference.current
    if (canvas) draw(canvas)
  }, [draw])

  return (
    <canvas
      ref={canvasReference}
      width={28}
      height={28}
      className="shrink-0"
    />
  )
}

export function TopBar() {
  const [utcTime, setUtcTime] = useState(() => formatUTCTime(new Date()))
  const [threatScore, setThreatScore] = useState(store.threatWeather)
  const [infocon, setInfocon] = useState(store.sansInfocon)
  const [degradedCount, setDegradedCount] = useState(store.degradedServiceCount)

  useEffect(() => {
    const interval = setInterval(() => {
      setUtcTime(formatUTCTime(new Date()))
      setThreatScore(store.threatWeather)
      setInfocon(store.sansInfocon)
      setDegradedCount(store.degradedServiceCount)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      className="absolute top-0 left-0 right-0 z-40 flex items-center px-4 font-mono"
      style={{
        height: '44px',
        background: 'rgba(1, 2, 8, 0.85)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      <div className="flex items-center gap-3 flex-1">
        <ThreatGauge score={threatScore} />
        <div className="flex items-center gap-1.5">
          <div
            className="w-2 h-2 rounded-full breathing"
            style={{ backgroundColor: INFOCON_COLORS[infocon] }}
          />
          <span className="text-[16px] uppercase tracking-wider opacity-40 text-white">
            Infocon
          </span>
        </div>
      </div>

      <div className="text-[16px] uppercase tracking-[0.25em] text-white opacity-20 font-mono">
        Cyber Pulse
      </div>

      <div className="flex items-center gap-4 flex-1 justify-end">
        {degradedCount > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[16px] font-mono text-[#ef233c]">
              {degradedCount}
            </span>
            <span className="text-[16px] uppercase tracking-wider opacity-40 text-white">
              Incidents
            </span>
          </div>
        )}
        <span className="text-[18px] font-mono text-white opacity-50 tabular-nums">
          {utcTime}
          <span className="text-[14px] ml-1 opacity-50">UTC</span>
        </span>
      </div>
    </div>
  )
}
