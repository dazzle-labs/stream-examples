// =============================================================================
// LIVE DATA FEEDS — 100% real data, no simulation, no fallbacks.
// DSN Now: real-time dish tracking (every 5s)
// JPL Horizons: real position/velocity vectors (every 60s)
// =============================================================================

// Artemis II real launch time
export const LAUNCH_TIME_UTC = new Date('2026-04-01T22:35:12Z')

// ── NASA TV ──
export const NASA_TV_HLS_URL = 'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master_2000.m3u8'

// ── Direct URLs (Dazzle stages have relaxed CORS, no proxy needed) ──
const DSN_URL = 'https://eyes.nasa.gov/dsn/data/dsn.xml'

function buildHorizonsUrl(): string {
  const now = new Date()
  const later = new Date(now.getTime() + 3600_000)
  const fmt = (d: Date) => d.toISOString().slice(0, 16).replace('T', ' ')
  return 'https://ssd.jpl.nasa.gov/api/horizons.api?format=json'
    + "&COMMAND='-1024'"
    + "&OBJ_DATA='NO'"
    + "&MAKE_EPHEM='YES'"
    + "&EPHEM_TYPE='VECTORS'"
    + "&CENTER='500@399'"
    + `&START_TIME='${fmt(now)}'`
    + `&STOP_TIME='${fmt(later)}'`
    + "&STEP_SIZE='1'"
}

// ── Types ──

export interface DsnLiveData {
  timestamp: number
  trackingStation: string | null
  dishName: string | null
  azimuth: number
  elevation: number
  rangeKm: number
  rtltSeconds: number
  uplinkActive: boolean
  uplinkBand: string
  uplinkPowerKw: number
  downlinkActive: boolean
  downlinkBand: string
  downlinkDataRate: number
  downlinkPowerDbm: number
  signalLocked: boolean
}

export interface HorizonsData {
  positionKm: { x: number, y: number, z: number }
  velocityKms: { x: number, y: number, z: number }
  rangeKm: number
  speedKms: number
  earthDistanceKm: number  // range minus Earth radius
  timestamp: string
}

export interface LiveState {
  dsn: DsnLiveData | null
  lastDsnFetch: number
  dsnError: string | null
  horizons: HorizonsData | null
  lastHorizonsFetch: number
  horizonsError: string | null
  // Derived from DSN range changes over time
  dsnVelocityMs: number
  dsnPrevRange: number
  dsnPrevTime: number
}

export const liveState: LiveState = {
  dsn: null,
  lastDsnFetch: 0,
  dsnError: null,
  horizons: null,
  lastHorizonsFetch: 0,
  horizonsError: null,
  dsnVelocityMs: 0,
  dsnPrevRange: 0,
  dsnPrevTime: 0,
}

// ── Mission Elapsed Time (real) ──

export function getRealMET(): number {
  return Math.max(0, (Date.now() - LAUNCH_TIME_UTC.getTime()) / 1000)
}

// ── DSN Parser ──

function parseFloat0(s: string | null | undefined): number {
  if (!s) return 0
  const v = parseFloat(s)
  return isNaN(v) ? 0 : v
}

function parseDsnXml(xmlText: string): DsnLiveData | null {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'text/xml')

  const dishes = doc.querySelectorAll('dish')

  for (const dish of dishes) {
    const targets = dish.querySelectorAll('target')
    for (const target of targets) {
      if (target.getAttribute('name') !== 'EM2') continue

      // Resolve station name
      const parentStation = dish.parentElement
      let stationName = parentStation?.getAttribute('friendlyName') ?? ''
      if (!stationName) {
        const dName = dish.getAttribute('name') ?? ''
        const dNum = parseInt(dName.replace(/\D/g, ''), 10)
        if (dNum >= 10 && dNum <= 29) stationName = 'Goldstone'
        else if (dNum >= 50 && dNum <= 69) stationName = 'Madrid'
        else if (dNum >= 30 && dNum <= 49) stationName = 'Canberra'
        else stationName = 'DSN'
      }

      const dishName = dish.getAttribute('name') ?? ''
      const rangeKm = parseFloat0(target.getAttribute('downlegRange'))
      const rtlt = parseFloat0(target.getAttribute('rtlt'))

      let uplinkActive = false, uplinkBand = '', uplinkPower = 0
      for (const sig of dish.querySelectorAll('upSignal')) {
        if (sig.getAttribute('spacecraft') === 'EM2' && sig.getAttribute('active') === 'true') {
          uplinkActive = true
          uplinkBand = sig.getAttribute('band') ?? ''
          uplinkPower = parseFloat0(sig.getAttribute('power'))
        }
      }

      let downlinkActive = false, downlinkBand = '', downlinkDataRate = 0, downlinkPower = 0
      for (const sig of dish.querySelectorAll('downSignal')) {
        if (sig.getAttribute('spacecraft') === 'EM2' && sig.getAttribute('active') === 'true') {
          downlinkActive = true
          downlinkBand = sig.getAttribute('band') ?? ''
          downlinkDataRate = parseFloat0(sig.getAttribute('dataRate'))
          downlinkPower = parseFloat0(sig.getAttribute('power'))
        }
      }

      return {
        timestamp: Date.now(),
        trackingStation: stationName,
        dishName,
        azimuth: parseFloat0(dish.getAttribute('azimuthAngle')),
        elevation: parseFloat0(dish.getAttribute('elevationAngle')),
        rangeKm,
        rtltSeconds: rtlt,
        uplinkActive,
        uplinkBand,
        uplinkPowerKw: uplinkPower,
        downlinkActive,
        downlinkBand,
        downlinkDataRate,
        downlinkPowerDbm: downlinkPower,
        signalLocked: downlinkActive && downlinkDataRate > 0,
      }
    }
  }

  return null
}

// ── Horizons Parser ──

function parseHorizonsResult(json: { result: string }): HorizonsData | null {
  const text = json.result
  const soeIndex = text.indexOf('$$SOE')
  const eoeIndex = text.indexOf('$$EOE')
  if (soeIndex === -1 || eoeIndex === -1) return null

  const dataBlock = text.slice(soeIndex + 5, eoeIndex).trim()
  const lines = dataBlock.split('\n').filter((l) => l.trim().length > 0)
  if (lines.length < 1) return null

  // Find scientific notation numbers (X, Y, Z, VX, VY, VZ)
  const allText = lines.slice(0, 4).join(' ')
  const sciNums = allText.match(/[+-]?\d+\.\d+E[+-]?\d+/gi)
  if (!sciNums || sciNums.length < 6) return null

  const x = parseFloat(sciNums[0]!)
  const y = parseFloat(sciNums[1]!)
  const z = parseFloat(sciNums[2]!)
  const vx = parseFloat(sciNums[3]!)
  const vy = parseFloat(sciNums[4]!)
  const vz = parseFloat(sciNums[5]!)

  if ([x, y, z, vx, vy, vz].some((v) => isNaN(v))) return null

  const rangeKm = Math.sqrt(x * x + y * y + z * z)
  const speedKms = Math.sqrt(vx * vx + vy * vy + vz * vz)

  return {
    positionKm: { x, y, z },
    velocityKms: { x: vx, y: vy, z: vz },
    rangeKm,
    speedKms,
    earthDistanceKm: Math.round(rangeKm - 6371),
    timestamp: new Date().toISOString(),
  }
}

// ── Fetchers ──

async function fetchDsn(): Promise<void> {
  try {
    const response = await fetch(DSN_URL)
    if (!response.ok) {
      liveState.dsnError = `HTTP ${response.status}`
      return
    }
    const text = await response.text()
    const data = parseDsnXml(text)
    liveState.dsn = data
    liveState.lastDsnFetch = Date.now()
    liveState.dsnError = null

    // Compute radial velocity from range change over time (Δrange/Δt)
    if (data && data.rangeKm > 0 && liveState.dsnPrevRange > 0 && liveState.dsnPrevTime > 0) {
      const dt = (Date.now() - liveState.dsnPrevTime) / 1000 // seconds
      if (dt > 1 && dt < 30) { // only if reasonable interval
        const dr = data.rangeKm - liveState.dsnPrevRange // km
        liveState.dsnVelocityMs = Math.round(Math.abs(dr / dt) * 1000) // m/s
      }
    }
    if (data && data.rangeKm > 0) {
      liveState.dsnPrevRange = data.rangeKm
      liveState.dsnPrevTime = Date.now()
    }
  } catch (error) {
    liveState.dsnError = error instanceof Error ? error.message : 'fetch failed'
  }
}

async function fetchHorizons(): Promise<void> {
  try {
    const response = await fetch(buildHorizonsUrl())
    if (!response.ok) {
      liveState.horizonsError = `HTTP ${response.status}`
      return
    }
    const json: { result: string } = await response.json()
    const data = parseHorizonsResult(json)
    if (data) {
      liveState.horizons = data
      liveState.lastHorizonsFetch = Date.now()
      liveState.horizonsError = null
    }
  } catch (error) {
    liveState.horizonsError = error instanceof Error ? error.message : 'fetch failed'
  }
}

// ── Polling ──

let dsnPollInterval: ReturnType<typeof setInterval> | null = null
let horizonsPollInterval: ReturnType<typeof setInterval> | null = null

export function startLivePolling(): void {
  if (dsnPollInterval) return

  void fetchDsn()
  void fetchHorizons()

  dsnPollInterval = setInterval(() => { void fetchDsn() }, 5000)
  horizonsPollInterval = setInterval(() => { void fetchHorizons() }, 60000)
}

export function stopLivePolling(): void {
  if (dsnPollInterval) { clearInterval(dsnPollInterval); dsnPollInterval = null }
  if (horizonsPollInterval) { clearInterval(horizonsPollInterval); horizonsPollInterval = null }
}
