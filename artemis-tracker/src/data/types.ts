export interface TelemetrySnapshot {
  missionElapsedSeconds: number
  flightDay: number
  phase: MissionPhase
  phaseProgress: number
  earthDistanceKm: number
  moonDistanceKm: number
  velocityMs: number
  radioDelaySeconds: number
  dsnStation: DsnStation
  dsnSignalStrength: number
  dsnBandwidth: string
  spacecraftLat: number
  spacecraftLon: number
  orionAngle: number
  crewStatus: CrewStatus
  cabinTempC: number
  cabinPressureKpa: number
  powerWatts: number
  fuelPercent: number
  heartbeatOk: boolean
}

export type MissionPhase =
  | 'LAUNCH'
  | 'EARTH_ORBIT'
  | 'TLI_BURN'
  | 'TRANSLUNAR_COAST'
  | 'LUNAR_FLYBY'
  | 'RETURN_COAST'
  | 'REENTRY'
  | 'SPLASHDOWN'

export interface DsnStation {
  name: string
  location: string
  dish: string
}

export interface CrewStatus {
  commander: CrewMember
  pilot: CrewMember
  specialist1: CrewMember
  specialist2: CrewMember
}

export interface CrewMember {
  name: string
  role: string
  heartRate: number
  status: 'NOMINAL' | 'SLEEPING' | 'EVA_PREP'
}

export interface Milestone {
  label: string
  flightDay: number
  metSeconds: number
  completed: boolean
  active: boolean
}

export interface TrajectoryPoint {
  x: number
  y: number
  met: number
}
