// Aurora data from NOAA OVATION model
// Each coordinate entry is [longitude, latitude, probability]
export type AuroraCoordinate = [number, number, number]

export interface AuroraResponse {
  Observation_Time: string
  Forecast_Time: string
  Data_Format: string
  coordinates: Array<AuroraCoordinate>
}

// Solar wind plasma data from DSCOVR
// First row is headers, subsequent rows are string arrays
export type SolarWindPlasmaRow = [string, string, string, string]

// Solar wind magnetic field data from DSCOVR
// First row is headers, subsequent rows are string arrays
export type SolarWindMagRow = [string, string, string, string, string, string]

// Kp index data
// First row is headers, subsequent rows are string arrays
export type KpIndexRow = [string, string, string, string]

// Processed data types used by the renderer
export interface SolarWindData {
  density: number   // particles/cm³
  speed: number     // km/s
  temperature: number // Kelvin
  bx: number        // nT
  by: number        // nT
  bz: number        // nT
}

export interface SpaceWeatherData {
  aurora: Array<AuroraCoordinate>
  solarWind: SolarWindData
  kpIndex: number
  lastUpdate: number
}

// Lightning flash for procedural generation
export interface LightningFlash {
  lat: number
  lon: number
  startTime: number
  duration: number
  intensity: number
}

// Solar wind particle for streaming effect
export interface SolarWindParticle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
}

// Star for background
export interface Star {
  x: number
  y: number
  brightness: number
  twinklePhase: number
  twinkleSpeed: number
  size: number
}
