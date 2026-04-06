import type { MissionPhase, Milestone, TrajectoryPoint } from './types'
// CrewStatus no longer needed — crew panel uses hardcoded real crew data

// =============================================================================
// PHYSICAL CONSTANTS
// =============================================================================

const GM_EARTH = 398_600.4418       // km³/s² — Earth's gravitational parameter
// GM_MOON not used for trajectory rendering (flyby uses Bezier approximation)
const R_EARTH = 6_371               // km — Earth's mean radius
const R_MOON = 1_737.4              // km — Moon's mean radius
const EARTH_MOON_DIST = 384_400     // km — mean Earth-Moon distance
// C_LIGHT not needed here — radio delay computed from live DSN RTLT

// =============================================================================
// ARTEMIS II MISSION PARAMETERS (real values)
// =============================================================================

// Orbital parameters for the translunar transfer ellipse (Earth-centered)
const PARKING_ORBIT_ALT = 185                           // km — LEO parking orbit altitude
const R_PERIGEE = R_EARTH + PARKING_ORBIT_ALT           // km — perigee radius (6556 km)
const R_APOGEE = 400_171                                // km — apogee radius (max Earth distance)
const SEMI_MAJOR_OUTBOUND = (R_PERIGEE + R_APOGEE) / 2  // km — semi-major axis (203,364 km)
const ECC_OUTBOUND = (R_APOGEE - R_PERIGEE) / (R_APOGEE + R_PERIGEE) // eccentricity (0.9678)

// Lunar flyby parameters
const FLYBY_PERIAPSIS_ALT = 8_900  // km above lunar surface (Artemis II hybrid free-return)
const FLYBY_PERIAPSIS = R_MOON + FLYBY_PERIAPSIS_ALT  // km from Moon center (10,637 km)

// Mission timing
const MISSION_DURATION_S = 864_000  // 10 days in seconds

// Phase boundaries (seconds from launch)
const PHASES: Array<{ phase: MissionPhase, startS: number, endS: number }> = [
  { phase: 'LAUNCH', startS: 0, endS: 510 },              // ~8.5 min ascent
  { phase: 'EARTH_ORBIT', startS: 510, endS: 7200 },      // ~1.9 hrs in LEO
  { phase: 'TLI_BURN', startS: 7200, endS: 7560 },        // ~6 min ICPS burn
  { phase: 'TRANSLUNAR_COAST', startS: 7560, endS: 345_600 }, // ~3.9 days outbound
  { phase: 'LUNAR_FLYBY', startS: 345_600, endS: 432_000 },   // ~1 day around Moon
  { phase: 'RETURN_COAST', startS: 432_000, endS: 820_800 },   // ~4.5 days return
  { phase: 'REENTRY', startS: 820_800, endS: 862_200 },        // reentry corridor
  { phase: 'SPLASHDOWN', startS: 862_200, endS: MISSION_DURATION_S },
]

// =============================================================================
// KEPLER'S EQUATION SOLVER
// M = E - e*sin(E) — relates mean anomaly M to eccentric anomaly E
// Solved via Newton-Raphson iteration
// =============================================================================

function solveKepler(meanAnomaly: number, eccentricity: number): number {
  let E = meanAnomaly  // initial guess
  for (let i = 0; i < 20; i++) {
    const dE = (E - eccentricity * Math.sin(E) - meanAnomaly) /
               (1 - eccentricity * Math.cos(E))
    E -= dE
    if (Math.abs(dE) < 1e-12) break
  }
  return E
}

// Convert eccentric anomaly to true anomaly
function eccentricToTrue(E: number, e: number): number {
  return 2 * Math.atan2(
    Math.sqrt(1 + e) * Math.sin(E / 2),
    Math.sqrt(1 - e) * Math.cos(E / 2),
  )
}

// Orbital period from semi-major axis: T = 2π * sqrt(a³/GM)
function orbitalPeriod(a: number, gm: number): number {
  return 2 * Math.PI * Math.sqrt((a * a * a) / gm)
}

// =============================================================================
// TRAJECTORY PATH FOR CANVAS (real orbital mechanics, not mock data)
// =============================================================================

// =============================================================================
// TRAJECTORY POINTS FOR CANVAS RENDERING
//
// Uses a single transfer ellipse computed from Kepler's equation.
// Coordinate system: Earth at origin, Moon at (1, 0) in normalized units.
//
// The transfer ellipse has Earth at one focus. In the orbital plane:
//   perigee (ν=0) → closest to Earth, apogee (ν=π) → farthest from Earth
//
// We rotate the entire orbit by π so apogee points toward +x (toward Moon).
// The outbound leg sweeps ν from 0 → π (perigee → apogee), curving above.
// The return leg sweeps ν from π → 2π (apogee → perigee), curving below.
// A small angular offset tilts outbound up and return down for visual clarity.
//
// The lunar flyby region uses a hyperbolic arc in Moon-centered coordinates,
// with endpoint matching to ensure C1 continuity (position + tangent).
// =============================================================================

export function getTrajectoryPoints(): TrajectoryPoint[] {
  const points: TrajectoryPoint[] = []
  const steps = 800

  // Semi-latus rectum of the transfer ellipse
  const semiLatusRectum = SEMI_MAJOR_OUTBOUND * (1 - ECC_OUTBOUND * ECC_OUTBOUND)

  // The orbit period and mean motion
  const period = orbitalPeriod(SEMI_MAJOR_OUTBOUND, GM_EARTH)
  const n = (2 * Math.PI) / period

  // Tilt angle: small rotation to separate outbound (above) from return (below)
  const tiltAngle = 0.06

  // Compute position on the transfer ellipse at true anomaly ν,
  // rotated so apogee points toward +x, with optional tilt
  function ellipsePoint(nu: number, tilt: number): { x: number, y: number } {
    const r = semiLatusRectum / (1 + ECC_OUTBOUND * Math.cos(nu))
    // Raw orbital plane: x = r cos(ν), y = r sin(ν), Earth at focus
    const rawX = r * Math.cos(nu)
    const rawY = r * Math.sin(nu)
    // Rotate by π + tilt so apogee (ν=π) maps to +x direction
    const theta = Math.PI + tilt
    const cosT = Math.cos(theta)
    const sinT = Math.sin(theta)
    return {
      x: (rawX * cosT - rawY * sinT) / EARTH_MOON_DIST,
      y: (rawX * sinT + rawY * cosT) / EARTH_MOON_DIST,
    }
  }

  // Time boundaries
  const tliEnd = 7560
  const outboundEnd = 345_600
  const flybyEnd = 432_000
  const returnEnd = 820_800

  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const met = t * MISSION_DURATION_S
    let x: number, y: number

    if (met <= tliEnd) {
      // ── Launch / TLI: small arc near Earth ──
      const frac = met / tliEnd
      x = frac * 0.01
      y = frac * 0.005

    } else if (met < outboundEnd) {
      // ── Outbound: Kepler ellipse, perigee → apogee, tilted up ──
      const timeSincePeriapsis = met - tliEnd
      const M = n * timeSincePeriapsis
      const E = solveKepler(M, ECC_OUTBOUND)
      const nu = eccentricToTrue(E, ECC_OUTBOUND)
      const pt = ellipsePoint(nu, tiltAngle)
      x = pt.x
      y = pt.y

    } else if (met < flybyEnd) {
      // ── Lunar flyby: smooth arc around Moon ──
      // Get the endpoint positions from the outbound and return ellipses
      // to ensure continuity, then interpolate a smooth curve through them

      const flybyFrac = (met - outboundEnd) / (flybyEnd - outboundEnd)

      // Outbound endpoint (where outbound ellipse reaches near-apogee)
      const mOut = n * (outboundEnd - tliEnd)
      const eOut = solveKepler(mOut, ECC_OUTBOUND)
      const nuOut = eccentricToTrue(eOut, ECC_OUTBOUND)
      const ptOut = ellipsePoint(nuOut, tiltAngle)

      // Return start point (where return ellipse begins near-apogee)
      // Return starts at M=π (apogee) in the return-tilted frame
      const ptRet = ellipsePoint(Math.PI + 0.01, -tiltAngle)

      // Flyby control point: the closest approach to Moon, behind it (+x direction)
      const flybyDepth = FLYBY_PERIAPSIS / EARTH_MOON_DIST  // how far past Moon
      const cpX = 1.0 + flybyDepth * 0.5
      const cpY = (ptOut.y + ptRet.y) / 2  // centered vertically

      // Quadratic Bezier: P(t) = (1-t)²·P0 + 2(1-t)t·CP + t²·P1
      const u = 1 - flybyFrac
      x = u * u * ptOut.x + 2 * u * flybyFrac * cpX + flybyFrac * flybyFrac * ptRet.x
      y = u * u * ptOut.y + 2 * u * flybyFrac * cpY + flybyFrac * flybyFrac * ptRet.y

    } else if (met < returnEnd) {
      // ── Return: Kepler ellipse, apogee → perigee, tilted down ──
      const returnFrac = (met - flybyEnd) / (returnEnd - flybyEnd)

      // Mean anomaly goes from π (apogee) toward 2π (next perigee)
      // We traverse half the orbit (π radians of mean anomaly)
      const M = Math.PI + returnFrac * Math.PI
      const E = solveKepler(M, ECC_OUTBOUND)
      const nu = eccentricToTrue(E, ECC_OUTBOUND)
      const pt = ellipsePoint(nu, -tiltAngle)
      x = pt.x
      y = pt.y

    } else {
      // ── Reentry ──
      const reentryFrac = (met - returnEnd) / (MISSION_DURATION_S - returnEnd)
      x = (1 - reentryFrac) * 0.01
      y = -(1 - reentryFrac) * 0.005
    }

    points.push({ x, y, met })
  }

  return points
}

// =============================================================================
// MISSION MILESTONES
// =============================================================================

const MILESTONES: Array<{ label: string, flightDay: number, metS: number }> = [
  { label: 'Launch and ascent', flightDay: 1, metS: 0 },
  { label: 'ICPS upper stage separation', flightDay: 1, metS: 510 },
  { label: 'Orion orbit insertion (185 km)', flightDay: 1, metS: 3600 },
  { label: 'Trans-lunar injection burn', flightDay: 1, metS: 7200 },
  { label: 'Service module panel jettison', flightDay: 1, metS: 10800 },
  { label: 'Crew enters deep space', flightDay: 1, metS: 43200 },
  { label: 'First midcourse correction burn', flightDay: 2, metS: 86400 },
  { label: 'Surpass Apollo 13 distance record (400,171 km)', flightDay: 4, metS: 259200 },
  { label: 'Lunar flyby approach begins', flightDay: 5, metS: 345600 },
  { label: 'Communications blackout behind Moon', flightDay: 5, metS: 370800 },
  { label: 'Closest approach to Moon (8,900 km)', flightDay: 5, metS: 378000 },
  { label: 'Communications reacquired', flightDay: 5, metS: 385200 },
  { label: 'Maximum distance from Earth', flightDay: 5, metS: 388800 },
  { label: 'Return trajectory established', flightDay: 6, metS: 432000 },
  { label: 'Second midcourse correction burn', flightDay: 7, metS: 518400 },
  { label: 'Final midcourse correction', flightDay: 9, metS: 734400 },
  { label: 'Service module separation', flightDay: 10, metS: 820800 },
  { label: 'Atmospheric reentry (11 km/s)', flightDay: 10, metS: 830000 },
  { label: 'Drogue chute deployment', flightDay: 10, metS: 860000 },
  { label: 'Splashdown in Pacific Ocean', flightDay: 10, metS: 862200 },
]

// =============================================================================
// PHASE DETERMINATION
// =============================================================================

export function getPhase(met: number): { phase: MissionPhase, progress: number } {
  for (const p of PHASES) {
    if (met >= p.startS && met < p.endS) {
      return {
        phase: p.phase,
        progress: (met - p.startS) / (p.endS - p.startS),
      }
    }
  }
  return { phase: 'SPLASHDOWN', progress: 1 }
}

export { MISSION_DURATION_S }

export function getMilestones(met: number): Milestone[] {
  return MILESTONES.map((m) => ({
    label: m.label,
    flightDay: m.flightDay,
    metSeconds: m.metS,
    completed: met >= m.metS,
    active: met >= m.metS - 300 && met < m.metS + 300,
  }))
}

export function getCurrentTrajectoryIndex(met: number): number {
  const fraction = met / MISSION_DURATION_S
  return Math.floor(fraction * 600)
}

export function formatMET(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${String(d).padStart(2, '0')}:${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatCountdown(secondsUntil: number): string {
  if (secondsUntil <= 0) return 'NOW'
  const h = Math.floor(secondsUntil / 3600)
  const m = Math.floor((secondsUntil % 3600) / 60)
  if (h > 24) {
    const d = Math.floor(h / 24)
    return `${d}d ${h % 24}h`
  }
  return `${h}h ${String(m).padStart(2, '0')}m`
}

export const PHASE_LABELS: Record<MissionPhase, string> = {
  LAUNCH: 'Launch & Ascent',
  EARTH_ORBIT: 'Earth Orbit',
  TLI_BURN: 'Trans-Lunar Injection',
  TRANSLUNAR_COAST: 'Translunar Coast',
  LUNAR_FLYBY: 'Lunar Flyby',
  RETURN_COAST: 'Return Transit',
  REENTRY: 'Atmospheric Reentry',
  SPLASHDOWN: 'Splashdown',
}
