interface MissionHeaderProps {
  telemetry: {
    met: number
    metFormatted: string
    flightDay: number
    phaseLabel: string
    missionProgress: number
    phase: string
  }
}

export function MissionHeader({ telemetry }: MissionHeaderProps) {
  const progress = telemetry.missionProgress

  return (
    <div className="absolute top-0 left-0 right-0 h-[52px] flex items-center justify-between px-5 z-10"
      style={{
        background: 'linear-gradient(180deg, rgba(2, 5, 16, 0.95) 0%, rgba(2, 5, 16, 0.7) 100%)',
        borderBottom: '1px solid rgba(0, 229, 255, 0.15)',
      }}
    >
      {/* Left: Mission name */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full pulse-glow" style={{ background: '#51cf66' }} />
          <span
            className="text-[16px] font-bold tracking-[0.15em] uppercase"
            style={{ fontFamily: 'Orbitron, sans-serif', color: '#ffffff' }}
          >
            ARTEMIS II
          </span>
        </div>
        <div className="h-4 w-px" style={{ background: 'rgba(0, 229, 255, 0.2)' }} />
        <span className="text-[12px] tracking-[0.1em] uppercase glow-cyan" style={{ color: '#00e5ff' }}>
          {telemetry.phaseLabel}
        </span>
      </div>

      {/* Center: Progress bar */}
      <div className="flex items-center gap-3">
        <span className="text-[11px] tabular-nums" style={{ color: '#606880' }}>
          MISSION
        </span>
        <div className="relative w-[200px] h-[6px] rounded-full overflow-hidden" style={{ background: 'rgba(0, 229, 255, 0.08)' }}>
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${Math.min(100, progress)}%`,
              background: 'linear-gradient(90deg, #00e5ff, #4dabf7)',
              boxShadow: '0 0 8px rgba(0, 229, 255, 0.4)',
              transition: 'width 1s ease',
            }}
          />
        </div>
        <span className="text-[12px] tabular-nums font-bold" style={{ color: '#00e5ff' }}>
          {progress.toFixed(1)}%
        </span>
      </div>

      {/* Right: MET and Flight Day */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-[0.15em]" style={{ color: '#505868' }}>MET</div>
          <div className="text-[14px] tabular-nums font-bold glow-cyan" style={{ color: '#00e5ff', fontFamily: 'Orbitron, sans-serif' }}>
            {telemetry.metFormatted}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-[0.15em]" style={{ color: '#505868' }}>DAY</div>
          <div className="text-[14px] tabular-nums font-bold" style={{ color: '#ffffff', fontFamily: 'Orbitron, sans-serif' }}>
            {telemetry.flightDay}
          </div>
        </div>
      </div>
    </div>
  )
}
