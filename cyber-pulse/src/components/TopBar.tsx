import { useState, useEffect } from 'react'
import { store } from '../data/store'
import type { InfoconLevel } from '../data/types'

const INFOCON_COLORS: Record<InfoconLevel, string> = {
  green: '#06d6a0',
  yellow: '#ffbe0b',
  orange: '#f77f00',
  red: '#ef233c',
}

const INFOCON_LABELS: Record<InfoconLevel, string> = {
  green: 'NORMAL',
  yellow: 'ELEVATED',
  orange: 'HIGH',
  red: 'SEVERE',
}

const SERVICE_NAMES: Record<string, string> = {
  github: 'GitHub',
  cloudflare: 'Cloudflare',
  discord: 'Discord',
  openai: 'OpenAI',
  datadog: 'Datadog',
  reddit: 'Reddit',
  atlassian: 'Atlassian',
  gcp: 'GCP',
  aws: 'AWS',
}

function formatUTCTime(date: Date): string {
  const hours = date.getUTCHours().toString().padStart(2, '0')
  const minutes = date.getUTCMinutes().toString().padStart(2, '0')
  const seconds = date.getUTCSeconds().toString().padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

function threatColor(score: number): string {
  if (score < 20) return '#3b82f6'
  if (score < 40) return '#00e5ff'
  if (score < 60) return '#ffbe0b'
  if (score < 80) return '#f77f00'
  return '#ef233c'
}

export function TopBar() {
  const [utcTime, setUtcTime] = useState(() => formatUTCTime(new Date()))
  const [threatScore, setThreatScore] = useState(store.threatWeather)
  const [infocon, setInfocon] = useState(store.sansInfocon)
  const [degradedNames, setDegradedNames] = useState<string[]>([])

  useEffect(() => {
    const interval = setInterval(() => {
      setUtcTime(formatUTCTime(new Date()))
      setThreatScore(store.threatWeather)
      setInfocon(store.sansInfocon)
      const names: string[] = []
      for (const key of Object.keys(SERVICE_NAMES)) {
        const status = store.serviceStatuses[key]
        if (status && status.indicator !== 'none' && status.indicator !== 'operational') {
          names.push(SERVICE_NAMES[key] ?? key)
        }
      }
      setDegradedNames(names)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      className="absolute top-0 left-0 right-0 z-40 flex items-center px-5"
      style={{
        height: '44px',
        background: 'rgba(1, 2, 8, 0.9)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      <div className="flex items-center gap-5 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[20px] font-bold tabular-nums" style={{ color: threatColor(threatScore) }}>
            {threatScore}
          </span>
          <span className="text-[14px] uppercase" style={{ color: '#505060' }}>
            THREAT
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: INFOCON_COLORS[infocon] }} />
          <span className="text-[14px] uppercase" style={{ color: INFOCON_COLORS[infocon] }}>
            {INFOCON_LABELS[infocon]}
          </span>
          <span className="text-[14px] uppercase" style={{ color: '#404050' }}>
            ALERT LEVEL
          </span>
        </div>
      </div>

      <div className="text-[14px] uppercase tracking-[0.3em]" style={{ color: '#303040' }}>
        CYBER PULSE
      </div>

      <div className="flex items-center gap-5 flex-1 justify-end">
        {degradedNames.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full breathing" style={{ background: '#f77f00' }} />
            <span className="text-[14px]" style={{ color: '#f77f00' }}>
              {degradedNames.join(', ')} degraded
            </span>
          </div>
        )}
        <span className="text-[16px] tabular-nums" style={{ color: '#505060' }}>
          {utcTime}
          <span className="text-[14px] ml-1">UTC</span>
        </span>
      </div>
    </div>
  )
}
