import { useState, useEffect } from 'react'
import type { DsnLiveData, HorizonsData } from '../data/live'

interface RealTelemetry {
  met: number
  metFormatted: string
  flightDay: number
  phase: string
  phaseLabel: string
  phaseProgress: number
  missionProgress: number
  earthDistanceKm: number
  velocityMs: number
  radioDelayS: number
  trajectoryIndex: number
}

interface TelemetryPanelProps {
  telemetry: RealTelemetry
  dsn: DsnLiveData | null
  horizons: HorizonsData | null
}

function StatCard({ label, value, unit, color, glow }: {
  label: string
  value: string
  unit?: string
  color: string
  glow?: string
}) {
  return (
    <div className="panel-glass rounded-lg px-3 py-2.5">
      <div className="text-[9px] uppercase tracking-[0.2em] mb-1" style={{ color: '#505868' }}>
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className={`text-[17px] font-bold tabular-nums ${glow ?? ''}`}
          style={{ color, fontFamily: 'Orbitron, sans-serif' }}
        >
          {value}
        </span>
        {unit && (
          <span className="text-[10px]" style={{ color: '#505868' }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  )
}

function MiniGraph({ data, color, height = 40 }: { data: number[], color: string, height?: number }) {
  if (data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const width = 72

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={width} height={height} className="mt-1">
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Area fill */}
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={`url(#grad-${color.replace('#', '')})`}
      />
    </svg>
  )
}

export function TelemetryPanel({ telemetry, dsn, horizons }: TelemetryPanelProps) {
  const [earthHistory, setEarthHistory] = useState<number[]>([])
  const [moonHistory, setMoonHistory] = useState<number[]>([])
  const [velHistory, setVelHistory] = useState<number[]>([])

  const moonDistanceKm = horizons ? Math.round(Math.abs(384400 - horizons.rangeKm)) : 0

  useEffect(() => {
    setEarthHistory(prev => [...prev.slice(-29), telemetry.earthDistanceKm])
    setMoonHistory(prev => [...prev.slice(-29), moonDistanceKm])
    setVelHistory(prev => [...prev.slice(-29), telemetry.velocityMs])
  }, [telemetry.earthDistanceKm, moonDistanceKm, telemetry.velocityMs])

  return (
    <div className="absolute right-3 top-[58px] w-[260px] flex flex-col gap-2 z-10">
      {/* Primary telemetry */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="Earth Distance"
          value={telemetry.earthDistanceKm.toLocaleString()}
          unit="km"
          color="#4dabf7"
          glow="glow-cyan"
        />
        <StatCard
          label="Moon Distance"
          value={moonDistanceKm.toLocaleString()}
          unit="km"
          color="#ffd43b"
          glow="glow-orange"
        />
        <StatCard
          label="Velocity"
          value={telemetry.velocityMs.toLocaleString()}
          unit="m/s"
          color="#51cf66"
          glow="glow-green"
        />
        <StatCard
          label="Radio Delay"
          value={telemetry.radioDelayS.toFixed(2)}
          unit="sec"
          color="#b197fc"
        />
      </div>

      {/* Telemetry sparklines */}
      <div className="panel-glass rounded-lg px-3 py-2">
        <div className="text-[9px] uppercase tracking-[0.2em] mb-1" style={{ color: '#505868' }}>
          Telemetry History
        </div>
        <div className="flex gap-1">
          <div className="flex-1">
            <div className="text-[8px] uppercase" style={{ color: '#4dabf7' }}>Earth</div>
            <MiniGraph data={earthHistory} color="#4dabf7" height={32} />
          </div>
          <div className="flex-1">
            <div className="text-[8px] uppercase" style={{ color: '#ffd43b' }}>Moon</div>
            <MiniGraph data={moonHistory} color="#ffd43b" height={32} />
          </div>
          <div className="flex-1">
            <div className="text-[8px] uppercase" style={{ color: '#51cf66' }}>Vel</div>
            <MiniGraph data={velHistory} color="#51cf66" height={32} />
          </div>
        </div>
      </div>

      {/* DSN Comms */}
      <DsnPanel dsn={dsn} />
    </div>
  )
}

function DsnPanel({ dsn }: { dsn: DsnLiveData | null }) {
  const hasLive = dsn !== null
  const stationName = hasLive ? dsn.trackingStation ?? 'Unknown' : 'No Station'
  const dishName = hasLive ? dsn.dishName ?? '' : ''
  const isLocked = hasLive ? dsn.signalLocked : false
  const isBlackout = !isLocked

  // Signal strength: derive from downlink power
  // Typical range: -100 dBm (strong) to -160 dBm (no signal)
  const signalPercent = hasLive
    ? Math.round(Math.max(0, Math.min(100, ((dsn.downlinkPowerDbm + 160) / 60) * 100)))
    : 0

  const band = hasLive ? (dsn.downlinkBand || dsn.uplinkBand || 'S') + '-Band' : ''
  const dataRateStr = hasLive
    ? formatDataRate(dsn.downlinkDataRate)
    : 'NO LINK'

  const rangeKm = hasLive ? dsn.rangeKm : 0
  const rtlt = hasLive ? dsn.rtltSeconds : 0

  return (
    <div className="panel-glass rounded-lg px-3 py-2">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <div className="text-[9px] uppercase tracking-[0.2em]" style={{ color: '#505868' }}>
            DSN Communications
          </div>
          {hasLive && (
            <span className="text-[7px] font-bold px-1 py-0.5 rounded" style={{ background: 'rgba(81, 207, 102, 0.15)', color: '#51cf66' }}>
              LIVE
            </span>
          )}
        </div>
        {isBlackout && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(255, 107, 107, 0.2)', color: '#ff6b6b' }}>
            SIGNAL LOSS
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 mb-2">
        <div className="relative">
          <div className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: isBlackout ? 'rgba(255, 107, 107, 0.1)' : 'rgba(0, 229, 255, 0.1)' }}
          >
            {!isBlackout && (
              <div className="absolute inset-0 rounded-full signal-pulse"
                style={{ border: `1px solid ${isBlackout ? '#ff6b6b' : '#00e5ff'}` }}
              />
            )}
            <div className="w-3 h-3 rounded-full"
              style={{ background: isBlackout ? '#ff6b6b' : '#00e5ff' }}
            />
          </div>
        </div>
        <div className="flex-1">
          <div className="text-[11px] font-bold" style={{ color: '#ffffff' }}>
            {stationName}
            <span className="font-normal text-[10px] ml-1.5" style={{ color: '#606880' }}>
              {dishName}
            </span>
          </div>
          {hasLive && rangeKm > 0 && (
            <div className="text-[9px] tabular-nums" style={{ color: '#505868' }}>
              Range: {rangeKm.toLocaleString()} km
              {rtlt > 0 && <span className="ml-1.5">RTLT: {rtlt.toFixed(2)}s</span>}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-[4px] rounded-full overflow-hidden" style={{ background: 'rgba(0, 229, 255, 0.08)' }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${signalPercent}%`,
              background: isBlackout ? '#ff6b6b' : 'linear-gradient(90deg, #00e5ff, #4dabf7)',
              transition: 'width 0.5s ease',
            }}
          />
        </div>
        <span className="text-[9px] tabular-nums" style={{ color: isBlackout ? '#ff6b6b' : '#00e5ff' }}>
          {signalPercent}%
        </span>
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[8px]" style={{ color: '#404858' }}>{band}</span>
        <span className="text-[8px] tabular-nums" style={{ color: '#404858' }}>
          {dataRateStr}
        </span>
      </div>
    </div>
  )
}

function formatDataRate(bps: number): string {
  if (bps === 0) return 'NO LINK'
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`
  if (bps >= 1000) return `${(bps / 1000).toFixed(0)} kbps`
  return `${bps} bps`
}
