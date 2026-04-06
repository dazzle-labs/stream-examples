import { useState, useEffect } from 'react'
import { OrbitalCanvas } from './components/OrbitalCanvas'
import { MissionHeader } from './components/MissionHeader'
import { TelemetryPanel } from './components/TelemetryPanel'
import { MilestoneTimeline } from './components/MilestoneTimeline'
import { CrewPanel } from './components/CrewPanel'
import { BottomBar } from './components/BottomBar'
import { getMilestones, getPhase, formatMET, PHASE_LABELS, getCurrentTrajectoryIndex } from './data/mission'
import { startLivePolling, liveState, getRealMET } from './data/live'
import type { Milestone, MissionPhase } from './data/types'
import type { DsnLiveData, HorizonsData } from './data/live'

// All telemetry derived from real data sources
interface RealTelemetry {
  met: number
  metFormatted: string
  flightDay: number
  phase: MissionPhase
  phaseLabel: string
  phaseProgress: number
  missionProgress: number
  earthDistanceKm: number
  velocityMs: number
  radioDelayS: number
  trajectoryIndex: number
}

function buildTelemetry(horizons: HorizonsData | null, dsn: DsnLiveData | null): RealTelemetry {
  const met = getRealMET()
  const { phase, progress } = getPhase(met)
  const flightDay = Math.floor(met / 86400) + 1

  // Distance: prefer Horizons, fall back to DSN range
  const earthDistanceKm = horizons
    ? horizons.earthDistanceKm
    : dsn
      ? dsn.rangeKm
      : 0

  // Velocity: from Horizons
  const velocityMs = horizons
    ? Math.round(horizons.speedKms * 1000)
    : 0

  // Radio delay: from DSN RTLT (one-way = half round-trip)
  const radioDelayS = dsn
    ? dsn.rtltSeconds / 2
    : horizons
      ? horizons.rangeKm / 299792.458
      : 0

  return {
    met,
    metFormatted: formatMET(met),
    flightDay,
    phase,
    phaseLabel: PHASE_LABELS[phase],
    phaseProgress: progress,
    missionProgress: (met / 864_000) * 100,
    earthDistanceKm,
    velocityMs,
    radioDelayS: Math.round(radioDelayS * 100) / 100,
    trajectoryIndex: getCurrentTrajectoryIndex(met),
  }
}

export function App() {
  const [dsn, setDsn] = useState<DsnLiveData | null>(null)
  const [horizons, setHorizons] = useState<HorizonsData | null>(null)
  const [telemetry, setTelemetry] = useState<RealTelemetry>(() => buildTelemetry(null, null))
  const [milestones, setMilestones] = useState<Milestone[]>(() => getMilestones(getRealMET()))

  useEffect(() => {
    startLivePolling()

    const handle = setInterval(() => {
      const d = liveState.dsn
      const h = liveState.horizons
      setDsn(d)
      setHorizons(h)
      const t = buildTelemetry(h, d)
      setTelemetry(t)
      setMilestones(getMilestones(t.met))
    }, 1000)
    return () => clearInterval(handle)
  }, [])

  return (
    <div className="relative w-[1280px] h-[720px] overflow-hidden" style={{ backgroundColor: '#020510' }}>
      <OrbitalCanvas />
      <MissionHeader telemetry={telemetry} />
      <MilestoneTimeline milestones={milestones} met={telemetry.met} />
      <TelemetryPanel telemetry={telemetry} dsn={dsn} horizons={horizons} />
      <CrewPanel />
      <BottomBar telemetry={telemetry} dsn={dsn} horizons={horizons} />
    </div>
  )
}
