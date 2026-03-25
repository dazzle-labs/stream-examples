// Artemis II mission constants and trajectory math

export const LAUNCH_UTC = Date.UTC(2026, 3, 1, 22, 24, 0) // April 1, 2026 22:24 UTC

export const MISSION_DURATION_MS = 10 * 24 * 60 * 60 * 1000 // ~10 days total

// Mission phase boundaries (hours after launch)
export const PHASES = [
  { id: 'countdown', label: 'COUNTDOWN', startHr: -Infinity, endHr: 0 },
  { id: 'launch', label: 'LAUNCH', startHr: 0, endHr: 0.5 },
  { id: 'tli', label: 'TRANS-LUNAR INJECTION', startHr: 0.5, endHr: 2 },
  { id: 'coast-out', label: 'LUNAR TRANSIT', startHr: 2, endHr: 96 },
  { id: 'flyby', label: 'LUNAR FLYBY', startHr: 96, endHr: 100 },
  { id: 'coast-back', label: 'RETURN TRANSIT', startHr: 100, endHr: 240 },
  { id: 'reentry', label: 'REENTRY', startHr: 240, endHr: 241 },
] as const

export type PhaseId = typeof PHASES[number]['id']

export const CREW = [
  { name: 'Reid Wiseman', role: 'Commander' },
  { name: 'Victor Glover', role: 'Pilot' },
  { name: 'Christina Koch', role: 'Mission Specialist 1' },
  { name: 'Jeremy Hansen', role: 'Mission Specialist 2' },
] as const

// Distance constants (km)
const EARTH_MOON_DISTANCE = 384_400

export interface MissionState {
  phase: PhaseId
  phaseLabel: string
  elapsedMs: number
  isPreLaunch: boolean
  countdownMs: number
  // Trajectory progress 0..1 along the free-return path
  trajectoryProgress: number
  // Telemetry
  distanceFromEarthKm: number
  velocityKmS: number
}

export function getMissionState(now: number): MissionState {
  const elapsedMs = now - LAUNCH_UTC
  const isPreLaunch = elapsedMs < 0
  const countdownMs = Math.max(0, -elapsedMs)
  const elapsedHr = elapsedMs / (1000 * 60 * 60)

  // Find current phase
  let phaseId: PhaseId = 'countdown'
  let phaseLabel = 'COUNTDOWN'
  for (const p of PHASES) {
    if (elapsedHr >= p.startHr && elapsedHr < p.endHr) {
      phaseId = p.id
      phaseLabel = p.label
      break
    }
  }
  // If past all phases, clamp to reentry
  if (elapsedHr >= 241) {
    const last = PHASES[PHASES.length - 1]
    if (last) {
      phaseId = last.id
      phaseLabel = last.label
    }
  }

  // Trajectory progress: maps elapsed hours to 0..1 along the path
  // 0 = at Earth, 0.5 = at Moon (flyby), 1.0 = back at Earth
  let trajectoryProgress = 0
  if (!isPreLaunch) {
    if (elapsedHr <= 98) {
      // Outbound: 0 to 0.5 over ~98 hours
      trajectoryProgress = Math.min(0.5, (elapsedHr / 98) * 0.5)
    } else {
      // Return: 0.5 to 1.0 over ~142 hours
      trajectoryProgress = 0.5 + Math.min(0.5, ((elapsedHr - 98) / 142) * 0.5)
    }
  }

  // Distance from Earth (simplified model)
  // Peak distance at trajectory midpoint (flyby)
  const distanceFraction = Math.sin(trajectoryProgress * Math.PI)
  const distanceFromEarthKm = isPreLaunch ? 0 : distanceFraction * EARTH_MOON_DISTANCE

  // Velocity (simplified: high at launch/reentry, lower during coast)
  let velocityKmS = 0
  if (!isPreLaunch) {
    if (elapsedHr < 2) {
      // Launch + TLI: high velocity
      velocityKmS = 7.8 + (elapsedHr / 2) * 3.0
    } else if (elapsedHr < 96) {
      // Coast out: gradually slowing
      const coastFrac = (elapsedHr - 2) / 94
      velocityKmS = 10.8 - coastFrac * 9.5
    } else if (elapsedHr < 100) {
      // Flyby: accelerating around Moon
      velocityKmS = 1.3 + Math.sin(((elapsedHr - 96) / 4) * Math.PI) * 1.2
    } else if (elapsedHr < 240) {
      // Coast back: gradually accelerating
      const returnFrac = (elapsedHr - 100) / 140
      velocityKmS = 1.3 + returnFrac * 9.8
    } else {
      // Reentry
      velocityKmS = 11.1
    }
  }

  return {
    phase: phaseId,
    phaseLabel,
    elapsedMs,
    isPreLaunch,
    countdownMs,
    trajectoryProgress,
    distanceFromEarthKm,
    velocityKmS,
  }
}

export function formatCountdown(ms: number): { days: string, hours: string, minutes: string, seconds: string } {
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return {
    days: String(days).padStart(2, '0'),
    hours: String(hours).padStart(2, '0'),
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(seconds).padStart(2, '0'),
  }
}

// Sidereal orbital period of the Moon: 27.322 days
const MOON_SIDEREAL_PERIOD_MS = 27.322 * 24 * 60 * 60 * 1000

/**
 * Compute the Moon's orbital angle from real wall-clock time.
 * Returns radians. The Moon completes one full orbit every 27.322 days,
 * so at ~0.22 degrees/minute it's imperceptible frame-to-frame
 * but visible over hours of streaming.
 */
export function getMoonOrbitAngle(now: number): number {
  return 2 * Math.PI * (now / MOON_SIDEREAL_PERIOD_MS)
}

export function formatMET(ms: number): string {
  const totalSeconds = Math.floor(Math.abs(ms) / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const prefix = ms < 0 ? 'T-' : 'T+'
  return `${prefix} ${String(days).padStart(2, '0')}:${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
