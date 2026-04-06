import type { DsnLiveData, HorizonsData } from '../data/live'

const MISSION_PHASES = [
  'Launch',
  'Earth Orbit',
  'TLI Burn',
  'Translunar Coast',
  'Lunar Flyby',
  'Return Coast',
  'Reentry',
  'Splashdown',
] as const

interface BottomBarProps {
  telemetry: {
    phase: string
    phaseLabel: string
  }
  dsn: DsnLiveData | null
  horizons: HorizonsData | null
}

export function BottomBar({ telemetry, dsn, horizons }: BottomBarProps) {
  const currentPhaseIndex = MISSION_PHASES.findIndex(
    (name) => name.toUpperCase().replace(/ /g, '_') === telemetry.phase,
  )

  return (
    <div
      className="absolute bottom-0 left-0 right-0 h-[40px] flex items-center justify-between px-5 z-10"
      style={{
        background: 'linear-gradient(0deg, rgba(2, 5, 16, 0.95) 0%, rgba(2, 5, 16, 0.7) 100%)',
        borderTop: '1px solid rgba(0, 229, 255, 0.1)',
      }}
    >
      {/* Phase indicators */}
      <div className="flex items-center gap-1">
        {MISSION_PHASES.map((name, i) => (
          <div key={name} className="flex items-center gap-1">
            <div
              className="h-1.5 rounded-full"
              style={{
                width: i === currentPhaseIndex ? '24px' : '8px',
                background: i < currentPhaseIndex ? '#51cf66'
                  : i === currentPhaseIndex ? '#00e5ff'
                  : 'rgba(0, 229, 255, 0.15)',
                transition: 'all 0.5s ease',
                boxShadow: i === currentPhaseIndex ? '0 0 6px rgba(0, 229, 255, 0.4)' : 'none',
              }}
            />
          </div>
        ))}
        <span className="text-[9px] ml-2" style={{ color: '#505868' }}>
          {telemetry.phaseLabel}
        </span>
      </div>

      {/* Center: Data source indicator */}
      <div className="flex items-center gap-2">
        {dsn && (
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full pulse-glow" style={{ background: '#51cf66' }} />
            <span className="text-[8px] uppercase tracking-wider" style={{ color: '#51cf66' }}>
              DSN LIVE
            </span>
          </div>
        )}
        {horizons && (
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full pulse-glow" style={{ background: '#4dabf7' }} />
            <span className="text-[8px] uppercase tracking-wider" style={{ color: '#4dabf7' }}>
              JPL HORIZONS
            </span>
          </div>
        )}
        <div className="text-[9px] tracking-[0.15em]" style={{ color: '#303848' }}>
          ARTEMIS II MISSION TRACKER
        </div>
      </div>

      {/* Right: Timestamp */}
      <div className="text-[10px] tabular-nums" style={{ color: '#404858' }}>
        {new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })} UTC
      </div>
    </div>
  )
}
