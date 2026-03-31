import { useEffect, useState } from 'react'
import type {
  MetroCity,
  CityTrafficData,
  CyclePhase,
  NationalSummary,
  Severity,
} from './types'

const SEVERITY_COLORS: Record<Severity, string> = {
  low: 'var(--color-jam-low)',
  moderate: 'var(--color-jam-moderate)',
  heavy: 'var(--color-jam-heavy)',
  severe: 'var(--color-jam-severe)',
}

function worstSeverity(data: CityTrafficData | null): Severity {
  if (!data) return 'low'
  const { severityCounts } = data
  if (severityCounts.severe > 0) return 'severe'
  if (severityCounts.heavy > 0) return 'heavy'
  if (severityCounts.moderate > 0) return 'moderate'
  return 'low'
}

function severityColor(data: CityTrafficData | null): string {
  if (!data) return 'var(--color-accent)'
  return SEVERITY_COLORS[worstSeverity(data)]
}

function formatLocalTime(timezone: string): string {
  const now = new Date()
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
    timeZoneName: 'short',
  }).format(now)
}

function formatDelay(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  if (minutes < 1) return '< 1 MIN'
  return `${minutes} MIN`
}

/* ------------------------------------------------------------------ */
/*  TitleBar                                                           */
/* ------------------------------------------------------------------ */

export function TitleBar({ summary }: { summary: NationalSummary }) {
  return (
    <div
      className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between"
      style={{
        padding: '20px 40px',
        height: 70,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 100%)',
      }}
    >
      <div className="flex items-center gap-3">
        <span
          className="animate-live-pulse inline-block rounded-full bg-red-500"
          style={{ width: 8, height: 8 }}
        />
        <span
          className="font-mono uppercase"
          style={{
            fontSize: 16,
            letterSpacing: '0.2em',
            fontWeight: 600,
          }}
        >
          Traffic Pulse
        </span>
      </div>

      <span
        className="font-mono"
        style={{
          fontSize: 12,
          color: 'var(--color-text-dim)',
          letterSpacing: '0.08em',
        }}
      >
        {summary.citiesScanned} CITIES | {summary.totalJams} JAMS | {summary.totalAccidents} INCIDENTS
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  LowerThird                                                         */
/* ------------------------------------------------------------------ */

export function LowerThird({
  city,
  data,
  phase,
}: {
  city: MetroCity
  data: CityTrafficData | null
  phase: CyclePhase
}) {
  const [localTime, setLocalTime] = useState(() => formatLocalTime(city.timezone))

  useEffect(() => {
    setLocalTime(formatLocalTime(city.timezone))
    if (phase !== 'holding') return
    const id = setInterval(() => {
      setLocalTime(formatLocalTime(city.timezone))
    }, 1000)
    return () => clearInterval(id)
  }, [city.timezone, phase])

  if (phase === 'tuning') return null

  const barColor = severityColor(data)

  const containerClass =
    phase === 'departing' ? 'animate-fade-out' : ''

  return (
    <div
      className={`absolute z-20 ${containerClass}`}
      style={{
        bottom: 40,
        left: 40,
      }}
    >
      {/* Accent bar */}
      <div
        className={phase === 'arriving' ? 'animate-slide-in-left' : ''}
        style={{
          width: 60,
          height: 3,
          background: barColor,
          marginBottom: 12,
        }}
      />

      {/* City name */}
      <div
        className={phase === 'arriving' ? 'animate-slide-in-left' : ''}
        style={{
          fontSize: 40,
          fontWeight: 900,
          textTransform: 'uppercase',
          lineHeight: 1.1,
          fontFamily: 'var(--font-display)',
          animationDelay: phase === 'arriving' ? '0.2s' : undefined,
          animationFillMode: 'backwards',
        }}
      >
        {city.name}
      </div>

      {/* Subtitle */}
      <div
        className={`font-mono ${phase === 'arriving' ? 'animate-slide-in-left' : ''}`}
        style={{
          fontSize: 14,
          color: 'var(--color-text-dim)',
          marginTop: 6,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          animationDelay: phase === 'arriving' ? '0.4s' : undefined,
          animationFillMode: 'backwards',
        }}
      >
        {city.state} | {localTime}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  CityStats                                                          */
/* ------------------------------------------------------------------ */

export function CityStats({
  data,
  phase,
}: {
  data: CityTrafficData | null
  phase: CyclePhase
}) {
  if (phase === 'tuning') return null

  const containerClass =
    phase === 'arriving'
      ? 'animate-fade-up'
      : phase === 'departing'
        ? 'animate-fade-out'
        : ''

  return (
    <div
      className={`absolute z-20 ${containerClass}`}
      style={{
        right: 40,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 200,
        background: 'rgba(10, 10, 15, 0.8)',
        borderLeft: '2px solid var(--color-accent)',
        padding: '20px 16px',
        animationDelay: phase === 'arriving' ? '1.5s' : undefined,
        animationFillMode: 'backwards',
      }}
    >
      {data ? <StatsContent data={data} /> : <AcquiringSignal />}
    </div>
  )
}

function StatsContent({ data }: { data: CityTrafficData }) {
  const worst = worstSeverity(data)
  const jamColor = SEVERITY_COLORS[worst]
  const total =
    data.severityCounts.low +
    data.severityCounts.moderate +
    data.severityCounts.heavy +
    data.severityCounts.severe

  return (
    <div className="flex flex-col gap-5">
      {/* Active jams */}
      <div>
        <div className="font-mono uppercase" style={{ fontSize: 11, color: 'var(--color-text-dim)', letterSpacing: '0.1em', marginBottom: 4 }}>
          Active Jams
        </div>
        <div
          className="animate-number-glow"
          style={{ fontSize: 36, fontWeight: 700, color: jamColor, lineHeight: 1 }}
        >
          {data.jamCount}
        </div>
      </div>

      {/* Worst delay */}
      <div>
        <div className="font-mono uppercase" style={{ fontSize: 11, color: 'var(--color-text-dim)', letterSpacing: '0.1em', marginBottom: 4 }}>
          Worst Delay
        </div>
        <div style={{ fontSize: 20, fontWeight: 600, lineHeight: 1 }}>
          {formatDelay(data.worstDelaySeconds)}
        </div>
      </div>

      {/* Incidents */}
      <div>
        <div className="font-mono uppercase" style={{ fontSize: 11, color: 'var(--color-text-dim)', letterSpacing: '0.1em', marginBottom: 4 }}>
          Incidents
        </div>
        <div style={{ fontSize: 20, fontWeight: 600, lineHeight: 1 }}>
          {data.accidentCount}
        </div>
      </div>

      {/* Severity bar */}
      {total > 0 && (
        <div>
          <div className="font-mono uppercase" style={{ fontSize: 11, color: 'var(--color-text-dim)', letterSpacing: '0.1em', marginBottom: 6 }}>
            Severity
          </div>
          <div className="flex w-full overflow-hidden rounded-sm" style={{ height: 4 }}>
            {(['low', 'moderate', 'heavy', 'severe'] as const).map((sev) => {
              const count = data.severityCounts[sev]
              if (count === 0) return null
              return (
                <div
                  key={sev}
                  style={{
                    width: `${(count / total) * 100}%`,
                    background: SEVERITY_COLORS[sev],
                  }}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function AcquiringSignal() {
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <div
        className="font-mono uppercase animate-signal-scan"
        style={{
          fontSize: 12,
          color: 'var(--color-text-dim)',
          letterSpacing: '0.1em',
          padding: '4px 8px',
        }}
      >
        Acquiring Signal...
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  TuningOverlay                                                      */
/* ------------------------------------------------------------------ */

export function TuningOverlay({
  city,
  phase,
}: {
  city: MetroCity
  phase: CyclePhase
}) {
  if (phase !== 'tuning') return null

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col items-center justify-center animate-fade-in"
      style={{ background: 'rgba(10, 10, 15, 0.88)' }}
    >
      <div
        className="font-mono uppercase"
        style={{
          fontSize: 48,
          fontWeight: 700,
          letterSpacing: '0.25em',
          color: 'var(--color-text-primary)',
          lineHeight: 1,
        }}
      >
        {city.name}
      </div>

      <div
        className="font-mono uppercase animate-signal-scan"
        style={{
          fontSize: 13,
          color: 'var(--color-text-dim)',
          letterSpacing: '0.15em',
          marginTop: 20,
          padding: '4px 12px',
        }}
      >
        Locking Signal...
      </div>
    </div>
  )
}
