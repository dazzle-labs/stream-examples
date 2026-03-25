import { useEffect, useState, useCallback } from 'react'
import {
  getMissionState,
  getMoonOrbitAngle,
  formatCountdown,
  formatMET,
  CREW,
  PHASES,
  LAUNCH_UTC,
} from './mission'
import type { MissionState, PhaseId } from './mission'
import { OrbitalCanvas } from './OrbitalCanvas'

function useAnimationFrame(callback: (time: number) => void) {
  useEffect(() => {
    let frameId = 0
    const loop = (time: number) => {
      callback(time)
      frameId = requestAnimationFrame(loop)
    }
    frameId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frameId)
  }, [callback])
}

function DigitPair({ value, label }: { value: string, label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-mono text-[36px] font-bold leading-none">{value}</span>
      <span className="font-mono text-[8px] text-white/30 tracking-[0.2em] uppercase mt-1">{label}</span>
    </div>
  )
}

function TimerSeparator() {
  return (
    <div className="flex flex-col items-center">
      <span className="font-mono text-[24px] font-bold leading-none opacity-40">:</span>
      <span className="mt-1 text-[8px]">&nbsp;</span>
    </div>
  )
}

function CountdownDisplay({ state }: { state: MissionState }) {
  if (state.isPreLaunch) {
    const parts = formatCountdown(state.countdownMs)
    return (
      <div className="flex items-start gap-2">
        <div className="font-mono text-[9px] text-amber-dim tracking-[0.3em] font-medium uppercase mt-2.5">
          T&minus;
        </div>
        <div className="countdown-glow text-amber flex items-start gap-1.5">
          <DigitPair value={parts.days} label="days" />
          <TimerSeparator />
          <DigitPair value={parts.hours} label="hrs" />
          <TimerSeparator />
          <DigitPair value={parts.minutes} label="min" />
          <TimerSeparator />
          <DigitPair value={parts.seconds} label="sec" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2">
      <div className="font-mono text-[9px] text-cyan-dim tracking-[0.3em] font-medium uppercase mt-2.5">
        MET
      </div>
      <div className="countdown-glow-cyan text-cyan flex items-start gap-1.5">
        <span className="font-mono text-[36px] font-bold leading-none">
          {formatMET(state.elapsedMs)}
        </span>
      </div>
    </div>
  )
}

function TelemetryGauge({ label, value, unit, live }: { label: string, value: string, unit: string, live?: boolean }) {
  return (
    <div className="py-2.5 border-b border-white/[0.04] last:border-b-0">
      <div className="flex items-center gap-1.5 mb-1">
        {live && (
          <div className="pulse-dot w-1.5 h-1.5 rounded-full bg-cyan" />
        )}
        <div className="font-mono text-[9px] text-white/35 tracking-[0.15em] uppercase">
          {label}
        </div>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="telemetry-flicker font-mono text-xl font-bold text-amber">
          {value}
        </span>
        <span className="font-mono text-[10px] text-white/30">
          {unit}
        </span>
      </div>
    </div>
  )
}

function formatDistance(km: number): string {
  if (km < 1000) return km.toFixed(0)
  return km.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function formatVelocity(kmS: number): string {
  return kmS.toFixed(2)
}

function TelemetryPanel({ state }: { state: MissionState }) {
  const launchDate = new Date(LAUNCH_UTC)
  const launchStr = launchDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })

  return (
    <div className="bg-panel/80 border border-panel-border rounded-sm p-3 backdrop-blur-sm">
      <div className="font-mono text-[9px] text-amber tracking-[0.2em] mb-1 pb-1.5 border-b border-panel-border uppercase font-medium">
        Telemetry
      </div>
      <TelemetryGauge
        label="Distance from Earth"
        value={state.isPreLaunch ? '---' : formatDistance(state.distanceFromEarthKm)}
        unit="km"
        live={!state.isPreLaunch}
      />
      <TelemetryGauge
        label="Velocity"
        value={state.isPreLaunch ? '---' : formatVelocity(state.velocityKmS)}
        unit="km/s"
        live={!state.isPreLaunch}
      />
      <TelemetryGauge
        label="Launch Date"
        value={launchStr}
        unit="UTC"
      />
      <TelemetryGauge
        label="Launch Time"
        value="22:24:00"
        unit="UTC"
      />
    </div>
  )
}

function CrewPanel() {
  const roleColors: Record<string, string> = {
    'Commander': 'border-l-amber',
    'Pilot': 'border-l-cyan',
    'Mission Specialist 1': 'border-l-white/30',
    'Mission Specialist 2': 'border-l-white/30',
  }

  const roleAccents: Record<string, string> = {
    'Commander': 'text-amber/80',
    'Pilot': 'text-cyan/60',
    'Mission Specialist 1': 'text-white/35',
    'Mission Specialist 2': 'text-white/35',
  }

  return (
    <div className="bg-panel/80 border border-panel-border rounded-sm p-3 backdrop-blur-sm">
      <div className="font-mono text-[9px] text-amber tracking-[0.2em] mb-2 pb-1.5 border-b border-panel-border uppercase font-medium">
        Crew — Orion MPCV
      </div>
      {CREW.map((member) => (
        <div
          key={member.name}
          className={`mb-1.5 last:mb-0 pl-2.5 py-1 border-l-2 ${roleColors[member.role] ?? 'border-l-white/20'}`}
        >
          <div className="font-sans text-xs font-medium text-white/90 leading-tight">
            {member.name}
          </div>
          <div className={`font-mono text-[8px] uppercase tracking-wider ${roleAccents[member.role] ?? 'text-white/35'}`}>
            {member.role}
          </div>
        </div>
      ))}
    </div>
  )
}

const ACTIVE_PHASE_STYLES: Record<string, string> = {
  countdown: 'text-amber border-amber/60 bg-amber/10 shadow-[0_0_10px_rgba(245,166,35,0.15)]',
  launch: 'text-alert border-alert/60 bg-alert/10 shadow-[0_0_10px_rgba(255,68,68,0.15)]',
  tli: 'text-cyan border-cyan/60 bg-cyan/10 shadow-[0_0_10px_rgba(0,229,255,0.15)]',
  'coast-out': 'text-cyan border-cyan/60 bg-cyan/10 shadow-[0_0_10px_rgba(0,229,255,0.15)]',
  flyby: 'text-amber border-amber/60 bg-amber/10 shadow-[0_0_10px_rgba(245,166,35,0.15)]',
  'coast-back': 'text-cyan border-cyan/60 bg-cyan/10 shadow-[0_0_10px_rgba(0,229,255,0.15)]',
  reentry: 'text-alert border-alert/60 bg-alert/10 shadow-[0_0_10px_rgba(255,68,68,0.15)]',
}

function getPhaseStyle(phaseId: string, currentPhase: PhaseId): string {
  if (phaseId === currentPhase) {
    return ACTIVE_PHASE_STYLES[phaseId] ?? 'text-amber border-amber/60 bg-amber/10'
  }
  const phaseOrder = PHASES.map(p => p.id)
  const currentIdx = phaseOrder.indexOf(currentPhase)
  const thisIdx = phaseOrder.indexOf(phaseId as PhaseId)

  if (thisIdx < currentIdx) {
    return 'text-white/25 border-white/10 bg-white/[0.03]'
  }
  return 'text-white/15 border-white/[0.04] bg-transparent'
}

function PhaseTimeline({ currentPhase }: { currentPhase: PhaseId }) {
  const visiblePhases = PHASES.filter(p => p.id !== 'countdown')
  const phaseOrder = PHASES.map(p => p.id)
  const currentIdx = phaseOrder.indexOf(currentPhase)

  return (
    <div className="flex items-center gap-1 justify-center w-full px-2">
      {visiblePhases.map((phase, idx) => {
        const thisIdx = phaseOrder.indexOf(phase.id)
        const isActive = phase.id === currentPhase
        const isCompleted = thisIdx < currentIdx

        return (
          <div key={phase.id} className="flex items-center gap-1">
            <div className="flex items-center gap-1.5">
              {/* Phase indicator dot */}
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                isActive
                  ? 'bg-amber pulse-dot'
                  : isCompleted
                    ? 'bg-white/25'
                    : 'border border-white/15 bg-transparent'
              }`} />
              <div
                className={`font-mono text-[9px] tracking-wider px-2 py-1 border rounded-sm transition-colors duration-500 whitespace-nowrap ${getPhaseStyle(phase.id, currentPhase)}`}
              >
                {phase.label}
              </div>
            </div>
            {idx < visiblePhases.length - 1 && (
              <div className={`font-mono text-[10px] ${isCompleted ? 'text-white/20' : 'text-white/10'}`}>
                &#9656;
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function MissionBadge({ state }: { state: MissionState }) {
  return (
    <div className="flex items-center gap-3">
      {/* Patch-like emblem */}
      <div className="w-10 h-10 rounded-full border border-amber/40 flex items-center justify-center bg-amber/5 shadow-[0_0_12px_rgba(245,166,35,0.1)]">
        <div className="font-mono text-amber text-[10px] font-bold leading-none text-center">
          <div>II</div>
        </div>
      </div>
      <div>
        <div className="font-sans text-sm font-semibold text-white tracking-wide">
          ARTEMIS II
        </div>
        <div className="font-mono text-[9px] text-white/40 tracking-widest uppercase">
          {state.phaseLabel}
        </div>
      </div>
    </div>
  )
}

function StatusIndicator({ state }: { state: MissionState }) {
  const isLive = !state.isPreLaunch
  return (
    <div className="flex items-center gap-2">
      <div className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-alert pulse-dot' : 'bg-amber'}`} />
      <span className="font-mono text-[9px] tracking-widest uppercase text-white/50">
        {isLive ? 'MISSION ACTIVE' : 'PRE-LAUNCH'}
      </span>
    </div>
  )
}

export function App() {
  const [state, setState] = useState<MissionState>(() => getMissionState(Date.now()))
  const animate = useCallback((_time: number) => {
    setState(getMissionState(Date.now()))
  }, [])

  useAnimationFrame(animate)

  return (
    <div className="w-screen h-screen bg-navy relative overflow-hidden select-none">
      {/* Scanline overlay for CRT feel */}
      <div className="scanline-overlay absolute inset-0 z-50" />

      {/* Orbital canvas — full bleed background layer */}
      <OrbitalCanvas
        trajectoryProgress={state.trajectoryProgress}
        isPreLaunch={state.isPreLaunch}
        moonOrbitAngle={getMoonOrbitAngle(Date.now())}
      />

      {/* Top bar — mission badge and status */}
      <div className="absolute top-0 left-0 right-0 h-[48px] flex items-center justify-between px-5 border-b border-panel-border bg-panel/60 z-10 backdrop-blur-sm">
        <MissionBadge state={state} />
        <StatusIndicator state={state} />
      </div>

      {/* Compact countdown / MET — informational, not the hero */}
      <div className="absolute top-[56px] left-4 z-10">
        <div className="bg-panel/70 border border-panel-border rounded-sm px-4 py-2 backdrop-blur-sm">
          <CountdownDisplay state={state} />
        </div>
      </div>

      {/* Right side panels — telemetry + crew, slim */}
      <div className="absolute top-[56px] right-3 w-[200px] z-10 flex flex-col gap-2.5 pt-1">
        <TelemetryPanel state={state} />
        <CrewPanel />
      </div>

      {/* Phase timeline — full-width bottom bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[44px] flex items-center justify-center border-t border-panel-border bg-panel/60 z-10 backdrop-blur-sm">
        <PhaseTimeline currentPhase={state.phase} />
      </div>

      {/* Bottom-left mission info */}
      <div className="absolute bottom-[52px] left-4 z-10">
        <div className="font-mono text-[8px] text-white/15 tracking-widest">
          FIRST CREWED LUNAR MISSION IN 54 YEARS
        </div>
      </div>

      {/* Bottom-right branding */}
      <div className="absolute bottom-[52px] right-4 z-10">
        <div className="font-mono text-[8px] text-white/15 tracking-widest">
          DAZZLE.FM
        </div>
      </div>
    </div>
  )
}
