import type {
  AuroraResponse,
  AuroraCoordinate,
  SolarWindPlasmaRow,
  SolarWindMagRow,
  KpIndexRow,
  SolarWindData,
  SpaceWeatherData,
} from './types'

const AURORA_URL = 'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json'
const PLASMA_URL = 'https://services.swpc.noaa.gov/products/solar-wind/plasma-5-minute.json'
const MAG_URL = 'https://services.swpc.noaa.gov/products/solar-wind/mag-5-minute.json'
const KP_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json'

const AURORA_INTERVAL = 5 * 60 * 1000   // 5 minutes
const SOLAR_WIND_INTERVAL = 60 * 1000   // 1 minute
const KP_INTERVAL = 5 * 60 * 1000       // 5 minutes

// Default fallback data when no API data is available yet
const DEFAULT_SOLAR_WIND: SolarWindData = {
  density: 5.0,
  speed: 400,
  temperature: 100000,
  bx: 0,
  by: 0,
  bz: -2,
}

function parseFloat_safe(val: string | undefined): number | null {
  if (val === undefined || val === null || val === '') return null
  const n = parseFloat(val)
  return isNaN(n) ? null : n
}

async function fetchAurora(): Promise<Array<AuroraCoordinate>> {
  try {
    const resp = await fetch(AURORA_URL)
    const data = (await resp.json()) as AuroraResponse
    return data.coordinates
  } catch {
    return []
  }
}

async function fetchSolarWindPlasma(): Promise<Partial<SolarWindData>> {
  try {
    const resp = await fetch(PLASMA_URL)
    const rows = (await resp.json()) as Array<SolarWindPlasmaRow>
    // Last row has the most recent data; first row is headers
    if (rows.length < 2) return {}
    const latest = rows[rows.length - 1]
    if (!latest) return {}
    return {
      density: parseFloat_safe(latest[1]) ?? undefined,
      speed: parseFloat_safe(latest[2]) ?? undefined,
      temperature: parseFloat_safe(latest[3]) ?? undefined,
    }
  } catch {
    return {}
  }
}

async function fetchSolarWindMag(): Promise<Partial<SolarWindData>> {
  try {
    const resp = await fetch(MAG_URL)
    const rows = (await resp.json()) as Array<SolarWindMagRow>
    if (rows.length < 2) return {}
    const latest = rows[rows.length - 1]
    if (!latest) return {}
    return {
      bx: parseFloat_safe(latest[1]) ?? undefined,
      by: parseFloat_safe(latest[2]) ?? undefined,
      bz: parseFloat_safe(latest[3]) ?? undefined,
    }
  } catch {
    return {}
  }
}

async function fetchKpIndex(): Promise<number> {
  try {
    const resp = await fetch(KP_URL)
    const rows = (await resp.json()) as Array<KpIndexRow>
    if (rows.length < 2) return 2
    const latest = rows[rows.length - 1]
    if (!latest) return 2
    return parseFloat_safe(latest[1]) ?? 2
  } catch {
    return 2
  }
}

export function createDataManager(): {
  getData: () => SpaceWeatherData
  start: () => void
  stop: () => void
} {
  let data: SpaceWeatherData = {
    aurora: [],
    solarWind: { ...DEFAULT_SOLAR_WIND },
    kpIndex: 2,
    lastUpdate: 0,
  }

  let auroraTimer: ReturnType<typeof setInterval> | null = null
  let solarWindTimer: ReturnType<typeof setInterval> | null = null
  let kpTimer: ReturnType<typeof setInterval> | null = null

  async function refreshAurora() {
    const coords = await fetchAurora()
    if (coords.length > 0) {
      data = { ...data, aurora: coords, lastUpdate: Date.now() }
    }
  }

  async function refreshSolarWind() {
    const [plasma, mag] = await Promise.all([
      fetchSolarWindPlasma(),
      fetchSolarWindMag(),
    ])
    data = {
      ...data,
      solarWind: {
        density: plasma.density ?? data.solarWind.density,
        speed: plasma.speed ?? data.solarWind.speed,
        temperature: plasma.temperature ?? data.solarWind.temperature,
        bx: mag.bx ?? data.solarWind.bx,
        by: mag.by ?? data.solarWind.by,
        bz: mag.bz ?? data.solarWind.bz,
      },
      lastUpdate: Date.now(),
    }
  }

  async function refreshKp() {
    const kp = await fetchKpIndex()
    data = { ...data, kpIndex: kp, lastUpdate: Date.now() }
  }

  function start() {
    // Fetch everything immediately
    void refreshAurora()
    void refreshSolarWind()
    void refreshKp()

    // Set up periodic refreshes
    auroraTimer = setInterval(() => void refreshAurora(), AURORA_INTERVAL)
    solarWindTimer = setInterval(() => void refreshSolarWind(), SOLAR_WIND_INTERVAL)
    kpTimer = setInterval(() => void refreshKp(), KP_INTERVAL)
  }

  function stop() {
    if (auroraTimer) clearInterval(auroraTimer)
    if (solarWindTimer) clearInterval(solarWindTimer)
    if (kpTimer) clearInterval(kpTimer)
  }

  return {
    getData: () => data,
    start,
    stop,
  }
}
