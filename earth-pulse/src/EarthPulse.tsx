import { useRef, useEffect, useState, useCallback } from 'react'
import { LAND_POLYGONS } from './continents'
import { airports } from './airports'
import { ports } from './ports'
import { cities } from './cities'

// ─── API response types ──────────────────────────────────────────

interface USGSResponse {
  features: {
    id: string
    geometry: { coordinates: [number, number, number] }
    properties: { mag: number; place: string | null; time: number }
  }[]
  metadata: { count: number }
}

interface ISSResponse {
  latitude: number
  longitude: number
  altitude: number
}

// ─── Internal types ──────────────────────────────────────────────

interface Ripple {
  id: string
  lat: number
  lon: number
  mag: number
  place: string
  born: number
}

interface WeatherAlert {
  id: string
  lat: number
  lon: number
  event: string
  severity: 'Extreme' | 'Severe' | 'Moderate' | 'Minor' | 'Unknown'
  born: number
}

interface RealFlight {
  lat: number
  lon: number
  heading: number   // degrees
  velocity: number  // m/s
  fetchedAt: number // ms timestamp
}

interface Ship {
  from: number
  to: number
  progress: number
  speed: number
}

interface EONETEvent {
  id: string
  lat: number
  lon: number
  title: string
  category: 'wildfires' | 'volcanoes' | 'severeStorms' | 'floods' | 'other'
  born: number
}

interface PowerOutage {
  lat: number
  lon: number
  county: string
  customers: number
  born: number
}

interface AtmoParticle {
  angle: number
  speed: number
  radius: number
  size: number
  opacity: number
}

// ─── Constants ───────────────────────────────────────────────────

const W = 1280
const H = 720
const R = 320
const CX = W / 2
const CY = H / 2 + 10
const TILT = 20
const TILT_R = TILT * Math.PI / 180
const COS_TILT = Math.cos(TILT_R)
const SIN_TILT = Math.sin(TILT_R)
const DEG = Math.PI / 180
const ROT_PER = 180_000
const RIPPLE_LIFE = 30_000
const TRAIL_LEN = 60
const EQ_INTERVAL = 60_000
const ISS_INTERVAL = 8_000
const WX_INTERVAL = 120_000
const WX_LIFE = 300_000
const KP_INTERVAL = 300_000
const EONET_INTERVAL = 180_000
const OUTAGE_INTERVAL = 120_000
// No simulated flight count — real data only
const SHIP_COUNT = 250
const ATMO_COUNT = 80

// ─── Module state (outside React to avoid re-init) ───────────────

const ripples: Ripple[] = []
const wxAlerts: WeatherAlert[] = []
const seenWx = new Set<string>()
let wxCount = 0
const trail: [number, number][] = []
let issPos: { lat: number; lon: number; alt: number } | null = null
let kpIndex = 2 // default moderate
const eonetEvents: EONETEvent[] = []
const seenEonet = new Set<string>()
const powerOutages: PowerOutage[] = []
const seen = new Set<string>()
const eventLog: string[] = []
let eqCount = 0

// Simulated flights removed — only real data with extrapolation

const realFlights: RealFlight[] = []
// realFlights populated by OpenSky + adsb.one
const OPENSKY_INTERVAL = 900_000 // every 15 min for global snapshot (budget: ~96 calls/day)
const ADSBONE_INTERVAL = 10_000  // every 10s for visible region detail
let currentViewLon = 0           // updated each frame for adsb.one targeting

const ships: Ship[] = []
let shipsInit = false

const atmoParticles: AtmoParticle[] = []
let atmoInit = false

// ─── Orthographic projection ─────────────────────────────────────

function ortho(lat: number, lon: number, cLon: number): [number, number, boolean, number] {
  const φ = lat * DEG
  const λ = lon * DEG
  const λ0 = cLon * DEG
  const sinφ = Math.sin(φ)
  const cosφ = Math.cos(φ)
  const cosΔλ = Math.cos(λ - λ0)

  const cosC = SIN_TILT * sinφ + COS_TILT * cosφ * cosΔλ
  if (cosC < 0.02) return [0, 0, false, 0]

  const x = R * cosφ * Math.sin(λ - λ0)
  const y = -R * (COS_TILT * sinφ - SIN_TILT * cosφ * cosΔλ)

  return [CX + x, CY + y, true, cosC]
}

// ─── Great circle interpolation ──────────────────────────────────

function gcLerp(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
  t: number,
): [number, number] {
  const φ1 = lat1 * DEG, λ1 = lon1 * DEG
  const φ2 = lat2 * DEG, λ2 = lon2 * DEG

  const d = Math.acos(Math.max(-1, Math.min(1,
    Math.sin(φ1) * Math.sin(φ2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1),
  )))

  if (d < 0.0001) return [(lat1 + lat2) / 2, (lon1 + lon2) / 2]

  const sinD = Math.sin(d)
  const A = Math.sin((1 - t) * d) / sinD
  const B = Math.sin(t * d) / sinD

  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2)
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2)
  const z = A * Math.sin(φ1) + B * Math.sin(φ2)

  return [
    Math.atan2(z, Math.sqrt(x * x + y * y)) / DEG,
    Math.atan2(y, x) / DEG,
  ]
}

// ─── Ship simulation ─────────────────────────────────────────────

function spawnShip(startProgress: number): Ship {
  const from = Math.floor(Math.random() * ports.length)
  let to = Math.floor(Math.random() * (ports.length - 1))
  if (to >= from) to++
  // Ships are ~5-8x slower than planes
  const speed = 0.0000005 + Math.random() * 0.0000012
  return { from, to, progress: startProgress, speed }
}

function initShips() {
  if (shipsInit) return
  shipsInit = true
  for (let i = 0; i < SHIP_COUNT; i++) {
    ships.push(spawnShip(Math.random()))
  }
}

// ─── Atmosphere particles ────────────────────────────────────────

function initAtmo() {
  if (atmoInit) return
  atmoInit = true
  for (let i = 0; i < ATMO_COUNT; i++) {
    atmoParticles.push({
      angle: Math.random() * Math.PI * 2,
      speed: (0.00008 + Math.random() * 0.00025) * (Math.random() > 0.5 ? 1 : -1),
      radius: R + 4 + Math.random() * 35,
      size: 0.4 + Math.random() * 1.2,
      opacity: 0.06 + Math.random() * 0.14,
    })
  }
}

// ─── Data fetching ───────────────────────────────────────────────

async function fetchQuakes(): Promise<void> {
  try {
    const r = await fetch(
      'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson',
    )
    const d: USGSResponse = await r.json()
    eqCount = d.metadata.count
    const now = Date.now()

    for (const f of d.features) {
      if (seen.has(f.id)) continue
      seen.add(f.id)
      const [lon, lat] = f.geometry.coordinates
      if (lon === undefined || lat === undefined) continue
      const mag = f.properties.mag ?? 0
      const place = f.properties.place ?? 'Unknown'
      ripples.push({ id: f.id, lat, lon, mag, place, born: now })
      eventLog.unshift(`M${mag.toFixed(1)} — ${place}`)
      if (eventLog.length > 12) eventLog.pop()
    }

    for (let i = ripples.length - 1; i >= 0; i--) {
      if (now - ripples[i]!.born > RIPPLE_LIFE) ripples.splice(i, 1)
    }
  } catch { /* retry next interval */ }
}

async function fetchISS(): Promise<void> {
  try {
    const r = await fetch('https://api.wheretheiss.at/v1/satellites/25544')
    const d: ISSResponse = await r.json()
    issPos = { lat: d.latitude, lon: d.longitude, alt: d.altitude }
    trail.push([d.latitude, d.longitude])
    if (trail.length > TRAIL_LEN) trail.shift()
  } catch { /* retry next interval */ }
}

// ─── NWS weather alerts ──────────────────────────────────────────

interface NWSResponse {
  features: {
    id: string
    properties: {
      event: string
      severity: string
      areaDesc: string
    }
    geometry: {
      type: string
      coordinates: number[][][] | number[][][][]
    } | null
  }[]
}

function polygonCentroid(coords: number[][]): [number, number] {
  let latSum = 0, lonSum = 0
  for (const c of coords) {
    if (c[1] !== undefined && c[0] !== undefined) {
      latSum += c[1]
      lonSum += c[0]
    }
  }
  return [latSum / coords.length, lonSum / coords.length]
}

async function fetchWeather(): Promise<void> {
  try {
    const r = await fetch('https://api.weather.gov/alerts/active?status=actual&severity=Extreme,Severe', {
      headers: { 'User-Agent': 'EarthPulse/1.0 (dazzle.fm)' },
    })
    const d: NWSResponse = await r.json()
    const now = Date.now()
    wxCount = d.features.length

    for (const f of d.features) {
      if (seenWx.has(f.id)) continue
      seenWx.add(f.id)

      // Get centroid from geometry or skip
      let lat = 0, lon = 0
      if (f.geometry && f.geometry.coordinates.length > 0) {
        const ring = f.geometry.type === 'MultiPolygon'
          ? (f.geometry.coordinates as number[][][][])[0]?.[0]
          : (f.geometry.coordinates as number[][][])[0]
        if (ring) {
          const [cLat, cLon] = polygonCentroid(ring)
          lat = cLat
          lon = cLon
        }
      }

      if (lat === 0 && lon === 0) continue

      const severity = (['Extreme', 'Severe', 'Moderate', 'Minor'].includes(f.properties.severity)
        ? f.properties.severity
        : 'Unknown') as WeatherAlert['severity']

      wxAlerts.push({
        id: f.id,
        lat,
        lon,
        event: f.properties.event,
        severity,
        born: now,
      })

      eventLog.unshift(`⚠ ${f.properties.event}`)
      if (eventLog.length > 12) eventLog.pop()
    }

    // Expire old alerts
    for (let i = wxAlerts.length - 1; i >= 0; i--) {
      if (now - wxAlerts[i]!.born > WX_LIFE) wxAlerts.splice(i, 1)
    }
  } catch { /* retry next interval */ }
}

// ─── OpenSky Network (real flight data) ──────────────────────────

async function fetchOpenSky(): Promise<void> {
  try {
    const r = await fetch('https://opensky-network.org/api/states/all')
    const d: { states: (string | number | boolean | null)[][] | null } = await r.json()
    if (!d.states) return

    const now = Date.now()
    // Replace all with fresh global snapshot
    const fresh: RealFlight[] = []
    for (const s of d.states) {
      const lon = s[5] as number | null
      const lat = s[6] as number | null
      const onGround = s[8] as boolean | null
      const velocity = s[9] as number | null
      const heading = s[10] as number | null

      if (lat == null || lon == null || onGround || velocity == null || heading == null) continue
      if (velocity < 50) continue
      if (Math.abs(lat) > 78) continue

      fresh.push({ lat, lon, heading, velocity, fetchedAt: now })
    }
    // Only replace if we got a meaningful response
    if (fresh.length > 500) {
      realFlights.length = 0
      realFlights.push(...fresh)
      // global snapshot loaded
    }
  } catch {
    // OpenSky unavailable — keep using simulated flights
  }
}

// Dead-reckoning: extrapolate position from last known state
function extrapolateFlight(f: RealFlight, now: number): [number, number, number] {
  const dtSec = Math.min((now - f.fetchedAt) / 1000, 300) // cap at 5 min to prevent wild drift
  const distDeg = (f.velocity * dtSec) / 111000
  const headRad = f.heading * DEG
  // At high latitudes (>75°), freeze longitude to prevent polar drift
  const cosLat = Math.cos(f.lat * DEG)
  const newLat = Math.max(-85, Math.min(85, f.lat + distDeg * Math.cos(headRad)))
  const newLon = cosLat > 0.25
    ? f.lon + distDeg * Math.sin(headRad) / cosLat
    : f.lon // freeze lon near poles
  return [newLat, newLon, f.heading]
}

// ─── adsb.one regional flight data ───────────────────────────────

interface AdsbOneResponse {
  ac: {
    lat?: number
    lon?: number
    gs?: number       // ground speed in knots
    track?: number    // heading in degrees
    alt_baro?: number | string
    type?: string
  }[]
}

async function fetchAdsbOne(): Promise<void> {
  try {
    // Query a ~250nm radius around the center of the visible hemisphere
    const viewLat = TILT // our camera tilt
    const viewLon = currentViewLon
    const r = await fetch(`https://api.adsb.one/v2/point/${viewLat.toFixed(1)}/${viewLon.toFixed(1)}/250`)
    const d: AdsbOneResponse = await r.json()
    if (!d.ac || d.ac.length < 10) return

    const now = Date.now()
    // Add adsb.one flights — duplicates with OpenSky are harmless (same position, renders on top)
    for (const ac of d.ac) {
      if (ac.lat == null || ac.lon == null || ac.gs == null || ac.track == null) continue
      if (ac.alt_baro === 'ground' || ac.gs < 100) continue // skip ground/slow
      if (Math.abs(ac.lat) > 78) continue
      realFlights.push({
        lat: ac.lat,
        lon: ac.lon,
        heading: ac.track,
        velocity: ac.gs * 0.5144, // knots to m/s
        fetchedAt: now,
      })
    }

    // Cap to prevent unbounded growth from repeated adsb.one additions
    if (realFlights.length > 15000) {
      // Remove oldest entries (by fetchedAt)
      realFlights.sort((a, b) => b.fetchedAt - a.fetchedAt)
      realFlights.length = 12000
    }
    // regional data merged
  } catch { /* retry next interval */ }
}

// ─── NASA EONET (wildfires, volcanoes, storms, floods) ───────────

interface EONETResponse {
  events: {
    id: string
    title: string
    categories: { id: string }[]
    geometry: { coordinates: number[]; date: string }[]
  }[]
}

const EONET_CAT_MAP: Record<string, EONETEvent['category']> = {
  wildfires: 'wildfires',
  volcanoes: 'volcanoes',
  severeStorms: 'severeStorms',
  floods: 'floods',
}

async function fetchEONET(): Promise<void> {
  try {
    // Only fetch volcanoes and severe storms — wildfires include too many prescribed burns
    const r = await fetch('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=100&category=volcanoes,severeStorms')
    const d: EONETResponse = await r.json()
    const now = Date.now()

    for (const e of d.events) {
      if (seenEonet.has(e.id)) continue
      seenEonet.add(e.id)

      const lastGeo = e.geometry[e.geometry.length - 1]
      if (!lastGeo) continue
      const [lon, lat] = lastGeo.coordinates
      if (lon === undefined || lat === undefined) continue

      const catId = e.categories[0]?.id ?? 'other'
      const category = EONET_CAT_MAP[catId] ?? 'other'

      eonetEvents.push({ id: e.id, lat, lon, title: e.title, category, born: now })

      const icon = category === 'wildfires' ? '🔥' : category === 'volcanoes' ? '🌋' : category === 'severeStorms' ? '🌀' : '🌊'
      eventLog.unshift(`${icon} ${e.title}`)
      if (eventLog.length > 12) eventLog.pop()
    }

    // Cap at 300
    while (eonetEvents.length > 300) eonetEvents.shift()
  } catch { /* retry next interval */ }
}

// ─── ODIN Power Outages (US grid) ────────────────────────────────

async function fetchOutages(): Promise<void> {
  try {
    const r = await fetch(
      'https://ornl.opendatasoft.com/api/explore/v2.1/catalog/datasets/odin-real-time-outages-county/records?limit=100&order_by=meters_affected%20desc',
    )
    const d: {
      results: {
        geo_point_2d?: { lat: number; lon: number }
        county?: string
        meters_affected?: number
      }[]
    } = await r.json()

    powerOutages.length = 0
    const now = Date.now()
    for (const rec of d.results) {
      if (!rec.geo_point_2d || !rec.meters_affected || rec.meters_affected < 500) continue
      powerOutages.push({
        lat: rec.geo_point_2d.lat,
        lon: rec.geo_point_2d.lon,
        county: rec.county ?? 'Unknown',
        customers: rec.meters_affected,
        born: now,
      })
    }
  } catch { /* retry next interval */ }
}

// ─── Sun position (pure math, no API) ────────────────────────────

function getSunPosition(): { lat: number; lon: number } {
  const now = new Date()
  const dayOfYear = Math.floor(
    (now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 1)) / 86400000,
  )
  const lat = -23.44 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10))
  const hours = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600
  const lon = -(hours / 24) * 360 + 180
  return { lat, lon }
}

// ─── Kp index (NOAA Space Weather) ───────────────────────────────

async function fetchKpIndex(): Promise<void> {
  try {
    const r = await fetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json')
    const data: string[][] = await r.json()
    // Last entry has the most recent Kp value (index 1)
    const last = data[data.length - 1]
    if (last?.[1]) {
      kpIndex = parseFloat(last[1])
    }
  } catch { /* retry next interval */ }
}

// ─── WebGL globe shader ──────────────────────────────────────────

const VERT = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`

const FRAG = `
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
uniform float u_centerLon;
uniform float u_sunLat;
uniform float u_sunLon;
uniform float u_kp;

const float PI = 3.141592653589793;
const float DEG = PI / 180.0;
const float GLOBE_R = ${R}.0;
const vec2 GLOBE_C = vec2(${CX}.0, ${CY}.0);
const float TILT = ${TILT}.0 * DEG;

vec3 invOrtho(vec2 px) {
  vec2 d = px - GLOBE_C;
  d.y = -d.y;
  float rho = length(d);
  if (rho > GLOBE_R) return vec3(0.0, 0.0, 0.0);
  float c = asin(rho / GLOBE_R);
  float sinC = sin(c);
  float cosC = cos(c);
  float sinTilt = sin(TILT);
  float cosTilt = cos(TILT);
  float lat = asin(cosC * sinTilt + (d.y * sinC * cosTilt) / rho);
  float lon = u_centerLon * DEG +
    atan(d.x * sinC, rho * cosTilt * cosC - d.y * sinTilt * sinC);
  return vec3(lat, lon, 1.0);
}

float graticule(float latR, float lonR) {
  float lat = latR / DEG;
  float lon = lonR / DEG;
  float spacing = 30.0;
  float latLine = 1.0 - smoothstep(0.0, 1.8, abs(mod(lat + 90.0, spacing) - spacing * 0.5) - spacing * 0.5 + 1.8);
  float lonLine = 1.0 - smoothstep(0.0, 1.8, abs(mod(lon + 180.0, spacing) - spacing * 0.5) - spacing * 0.5 + 1.8);
  return max(latLine, lonLine);
}

void main() {
  vec2 px = gl_FragCoord.xy;
  px.y = u_resolution.y - px.y;

  float distCenter = length(px - GLOBE_C) / length(u_resolution);
  vec3 bgColor = mix(vec3(0.04, 0.055, 0.095), vec3(0.012, 0.02, 0.03), distCenter);

  float gridPulse = 0.6 + 0.4 * sin(u_time * 0.001);
  float bgGrid = 0.0;
  bgGrid += step(0.5, mod(px.x, 60.0)) * (1.0 - step(1.5, mod(px.x, 60.0)));
  bgGrid += step(0.5, mod(px.y, 60.0)) * (1.0 - step(1.5, mod(px.y, 60.0)));
  bgColor += vec3(0.0, 0.35, 0.55) * bgGrid * 0.018 * gridPulse;

  vec3 geo = invOrtho(px);
  if (geo.z > 0.5) {
    float latR = geo.x;
    float lonR = geo.y;
    float latDeg = latR / DEG;

    // Base globe surface
    vec3 globeColor = vec3(0.03, 0.045, 0.07);
    float globeDist = length(px - GLOBE_C) / GLOBE_R;
    globeColor += vec3(0.01, 0.015, 0.025) * (1.0 - globeDist);

    // Graticule
    float grid = graticule(latR, lonR);
    globeColor += vec3(0.0, 0.4, 0.6) * grid * 0.055;

    // ── Day/night terminator ──
    float sunLatR = u_sunLat * DEG;
    float sunLonR = u_sunLon * DEG;
    float cosAngle = sin(sunLatR) * sin(latR) + cos(sunLatR) * cos(latR) * cos(lonR - sunLonR);

    // Night darkening: smooth transition over ~12 degrees
    float night = smoothstep(0.1, -0.1, cosAngle);
    globeColor *= mix(1.0, 0.3, night);

    // Twilight glow — subtle warm gradient at the terminator
    float twilight = smoothstep(-0.3, 0.05, cosAngle) * smoothstep(0.3, 0.0, cosAngle);
    globeColor += vec3(0.25, 0.08, 0.02) * twilight * 0.08;

    // ── Aurora ──
    float absLat = abs(latDeg);
    float auroraCenter = 67.0 - u_kp * 2.5;
    float auroraWidth = 4.0 + u_kp * 0.5;
    float aurora = smoothstep(auroraCenter + auroraWidth, auroraCenter, absLat)
                 * smoothstep(auroraCenter - auroraWidth * 2.0, auroraCenter, absLat);
    // Only visible when Kp is elevated (>= 4); scales up dramatically with storm intensity
    float kpStrength = smoothstep(3.5, 6.0, u_kp);
    float drift = 0.7
      + 0.15 * sin(lonR * 2.0 + u_time * 0.0003)
      + 0.10 * sin(lonR * 3.7 - u_time * 0.0005)
      + 0.05 * sin(latR * 5.0 + u_time * 0.0002);
    aurora *= night * drift * kpStrength * 0.4;
    globeColor += vec3(0.03, aurora * 0.9, aurora * 0.35);

    // Rim glow
    float rim = smoothstep(0.7, 1.0, globeDist);
    globeColor += vec3(0.0, 0.3, 0.6) * rim * 0.12;

    // Scan lines
    float scan = sin(px.y * 1.5) * 0.5 + 0.5;
    globeColor += vec3(0.0, 0.2, 0.4) * scan * 0.006;

    bgColor = globeColor;
  } else {
    float distGlobe = length(px - GLOBE_C);
    float atmoGlow = smoothstep(GLOBE_R + 50.0, GLOBE_R, distGlobe);
    bgColor += vec3(0.0, 0.25, 0.5) * atmoGlow * 0.04;
  }

  gl_FragColor = vec4(bgColor, 1.0);
}
`

interface GLState {
  gl: WebGL2RenderingContext
  uTime: WebGLUniformLocation
  uCenterLon: WebGLUniformLocation
  uSunLat: WebGLUniformLocation
  uSunLon: WebGLUniformLocation
  uKp: WebGLUniformLocation
}

function initWebGL(canvas: HTMLCanvasElement): GLState | null {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false })
  if (!gl) return null

  const vs = gl.createShader(gl.VERTEX_SHADER)!
  gl.shaderSource(vs, VERT)
  gl.compileShader(vs)
  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
    console.error('Vertex shader:', gl.getShaderInfoLog(vs))
    return null
  }

  const fs = gl.createShader(gl.FRAGMENT_SHADER)!
  gl.shaderSource(fs, FRAG)
  gl.compileShader(fs)
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    console.error('Fragment shader:', gl.getShaderInfoLog(fs))
    return null
  }

  const program = gl.createProgram()!
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program:', gl.getProgramInfoLog(program))
    return null
  }

  gl.useProgram(program)

  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1, 1, -1, -1, 1,
    -1, 1, 1, -1, 1, 1,
  ]), gl.STATIC_DRAW)

  const aPos = gl.getAttribLocation(program, 'a_pos')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

  gl.uniform2f(gl.getUniformLocation(program, 'u_resolution')!, W, H)

  return {
    gl,
    uTime: gl.getUniformLocation(program, 'u_time')!,
    uCenterLon: gl.getUniformLocation(program, 'u_centerLon')!,
    uSunLat: gl.getUniformLocation(program, 'u_sunLat')!,
    uSunLon: gl.getUniformLocation(program, 'u_sunLon')!,
    uKp: gl.getUniformLocation(program, 'u_kp')!,
  }
}

// ─── Component ───────────────────────────────────────────────────

export function EarthPulse() {
  const glRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const [utc, setUtc] = useState('')
  const [issAlt, setIssAlt] = useState<number | null>(null)
  const [eventLine, setEventLine] = useState('Monitoring...')
  const [count, setCount] = useState(0)
  const [wxTotal, setWxTotal] = useState(0)
  const [flightCount, setFlightCount] = useState(0)

  const drawOverlay = useCallback((
    ctx: CanvasRenderingContext2D,
    cLon: number,
    dt: number,
    now: number,
  ) => {
    ctx.clearRect(0, 0, W, H)

    // ── All on-globe layers clipped to globe circle ──
    // Clip 2px inside WebGL globe to avoid edge seam between layers
    ctx.save()
    ctx.beginPath()
    ctx.arc(CX, CY, R - 2, 0, Math.PI * 2)
    ctx.clip()

    // Continent outlines (strokes only — fills cause polygon artifacts at the horizon)
    for (const poly of LAND_POLYGONS) {
      ctx.beginPath()
      let segOn = false
      for (const [lon, lat] of poly) {
        const [x, y, vis] = ortho(lat, lon, cLon)
        if (!vis) { segOn = false; continue }
        if (!segOn) { ctx.moveTo(x, y); segOn = true }
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = 'rgba(0, 200, 180, 0.30)'
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // ── Airport dots (pulsing nodes) ──
    const airportPulse = now * 0.002
    ctx.beginPath()
    for (const [lat, lon] of airports) {
      const [x, y, vis] = ortho(lat, lon, cLon)
      if (!vis) continue
      ctx.moveTo(x + 1.5, y)
      ctx.arc(x, y, 1.5, 0, Math.PI * 2)
    }
    const apAlpha = 0.2 + 0.1 * Math.sin(airportPulse)
    ctx.fillStyle = `rgba(255, 220, 180, ${apAlpha})`
    ctx.fill()

    // ── Update and draw flights (real OpenSky or simulated fallback) ──

    interface VisibleFlight {
      x: number; y: number
      tx: number; ty: number
      angle: number
      cosC: number
    }
    const brightBins: VisibleFlight[][] = [[], [], [], []]

    // Real flights only — extrapolate positions from last known data
    for (const f of realFlights) {
      const [lat, lon, heading] = extrapolateFlight(f, now)
      if (Math.abs(lat) > 78) continue
      const [x, y, vis, cosC] = ortho(lat, lon, cLon)
      if (!vis) continue

      const [tLat, tLon] = extrapolateFlight(f, now - 3000)
      const [tx, ty, tVis] = ortho(tLat, tLon, cLon)

      const angleRad = -(heading - 90) * DEG
      const bin = Math.min(3, Math.floor(cosC * 4))
      brightBins[bin]!.push({
        x, y,
        tx: tVis ? tx : x, ty: tVis ? ty : y,
        angle: angleRad, cosC,
      })
    }

    // Draw from back to front
    const chevronLen = 5.5
    const chevronWing = 3.2

    for (let b = 0; b < 4; b++) {
      const bin = brightBins[b]!
      if (bin.length === 0) continue
      const alpha = 0.15 + b * 0.08

      // Trails
      ctx.beginPath()
      for (const f of bin) {
        ctx.moveTo(f.tx, f.ty)
        ctx.lineTo(f.x, f.y)
      }
      ctx.strokeStyle = `rgba(255, 220, 180, ${alpha * 0.5})`
      ctx.lineWidth = 1
      ctx.stroke()

      // Chevrons
      ctx.beginPath()
      for (const f of bin) {
        const cos = Math.cos(f.angle)
        const sin = Math.sin(f.angle)
        // Nose (front tip)
        const nx = f.x + cos * chevronLen
        const ny = f.y + sin * chevronLen
        // Left wing
        const lx = f.x - cos * chevronLen * 0.3 + sin * chevronWing
        const ly = f.y - sin * chevronLen * 0.3 - cos * chevronWing
        // Right wing
        const rx = f.x - cos * chevronLen * 0.3 - sin * chevronWing
        const ry = f.y - sin * chevronLen * 0.3 + cos * chevronWing

        ctx.moveTo(nx, ny)
        ctx.lineTo(lx, ly)
        ctx.lineTo(f.x - cos * chevronLen * 0.1, f.y - sin * chevronLen * 0.1)
        ctx.lineTo(rx, ry)
        ctx.lineTo(nx, ny)
      }
      ctx.fillStyle = `rgba(255, 230, 200, ${alpha + 0.15})`
      ctx.fill()
    }

    // ── Update and draw ships ──

    for (let i = 0; i < ships.length; i++) {
      const s = ships[i]!
      s.progress += s.speed * dt
      if (s.progress >= 1) {
        ships[i] = spawnShip(0)
      }
    }

    // Batch ships by depth
    const shipBins: { x: number; y: number; angle: number }[][] = [[], [], [], []]
    for (const s of ships) {
      const orig = ports[s.from]!
      const dest = ports[s.to]!
      const [lat, lon] = gcLerp(orig[0], orig[1], dest[0], dest[1], s.progress)
      const [x, y, vis, cosC] = ortho(lat, lon, cLon)
      if (!vis) continue

      const trailT = Math.max(0, s.progress - 0.008)
      const [tLat, tLon] = gcLerp(orig[0], orig[1], dest[0], dest[1], trailT)
      const [tx, ty, tVis] = ortho(tLat, tLon, cLon)
      const dx = x - (tVis ? tx : x)
      const dy = y - (tVis ? ty : y)
      const angle = Math.atan2(dy, dx)

      const bin = Math.min(3, Math.floor(cosC * 4))
      shipBins[bin]!.push({ x, y, angle })
    }

    // Draw ships as small diamonds
    const shipSize = 2.5
    for (let b = 0; b < 4; b++) {
      const bin = shipBins[b]!
      if (bin.length === 0) continue
      const alpha = 0.05 + b * 0.04

      ctx.beginPath()
      for (const s of bin) {
        const cos45 = Math.cos(s.angle + Math.PI / 4)
        const sin45 = Math.sin(s.angle + Math.PI / 4)
        const cos135 = Math.cos(s.angle + Math.PI * 3 / 4)
        const sin135 = Math.sin(s.angle + Math.PI * 3 / 4)
        ctx.moveTo(s.x + Math.cos(s.angle) * shipSize, s.y + Math.sin(s.angle) * shipSize)
        ctx.lineTo(s.x + cos45 * shipSize * 0.7, s.y + sin45 * shipSize * 0.7)
        ctx.lineTo(s.x - Math.cos(s.angle) * shipSize * 0.6, s.y - Math.sin(s.angle) * shipSize * 0.6)
        ctx.lineTo(s.x + cos135 * shipSize * 0.7, s.y + sin135 * shipSize * 0.7)
        ctx.closePath()
      }
      ctx.fillStyle = `rgba(130, 200, 255, ${alpha + 0.08})`
      ctx.fill()
    }

    // ── Weather alerts (pulsing warning markers) ──
    const ts = Date.now()
    for (const w of wxAlerts) {
      const [x, y, vis] = ortho(w.lat, w.lon, cLon)
      if (!vis) continue

      const age = (ts - w.born) / WX_LIFE
      if (age > 1) continue

      const pulse = 0.4 + 0.6 * Math.abs(Math.sin(now * 0.003))
      const fadeAlpha = Math.min(1, 1 - age * 0.5)

      // Yellow-green to distinguish from other warm markers
      let wr: number, wg: number, wb: number
      if (w.severity === 'Extreme') { wr = 255; wg = 60; wb = 60 }
      else { wr = 180; wg = 255; wb = 0 }

      // Pulsing warning diamond
      const sz = 6 + (w.severity === 'Extreme' ? 3 : 0)
      ctx.beginPath()
      ctx.moveTo(x, y - sz)
      ctx.lineTo(x + sz * 0.7, y)
      ctx.lineTo(x, y + sz * 0.5)
      ctx.lineTo(x - sz * 0.7, y)
      ctx.closePath()
      ctx.fillStyle = `rgba(${wr}, ${wg}, ${wb}, ${pulse * fadeAlpha * 0.5})`
      ctx.fill()
      ctx.strokeStyle = `rgba(${wr}, ${wg}, ${wb}, ${pulse * fadeAlpha * 0.7})`
      ctx.lineWidth = 1
      ctx.stroke()

      // Glow
      const glow = ctx.createRadialGradient(x, y, 0, x, y, sz * 3)
      glow.addColorStop(0, `rgba(${wr}, ${wg}, ${wb}, ${fadeAlpha * 0.15})`)
      glow.addColorStop(1, 'transparent')
      ctx.fillStyle = glow
      ctx.fillRect(x - sz * 3, y - sz * 3, sz * 6, sz * 6)

      // Label
      if (fadeAlpha > 0.2) {
        ctx.font = '700 9px monospace'
        ctx.fillStyle = `rgba(${wr}, ${wg}, ${wb}, ${fadeAlpha * 0.7})`
        ctx.fillText(w.event, x + sz + 4, y + 3)
      }
    }

    // ── EONET events (wildfires, volcanoes, storms, floods) ──
    for (const e of eonetEvents) {
      const [x, y, vis] = ortho(e.lat, e.lon, cLon)
      if (!vis) continue

      const pulse = 0.5 + 0.5 * Math.sin(now * 0.002 + e.lat)

      if (e.category === 'wildfires') {
        // Hot red flickering dot
        ctx.beginPath()
        ctx.arc(x, y, 3 + pulse * 2, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, ${30 + pulse * 30}, 0, ${0.45 + pulse * 0.25})`
        ctx.fill()
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 10 + pulse * 5)
        glow.addColorStop(0, `rgba(255, 40, 0, ${0.15 + pulse * 0.1})`)
        glow.addColorStop(1, 'transparent')
        ctx.fillStyle = glow
        ctx.fillRect(x - 15, y - 15, 30, 30)
      } else if (e.category === 'volcanoes') {
        // Red triangle
        const sz = 5
        ctx.beginPath()
        ctx.moveTo(x, y - sz)
        ctx.lineTo(x + sz * 0.7, y + sz * 0.4)
        ctx.lineTo(x - sz * 0.7, y + sz * 0.4)
        ctx.closePath()
        ctx.fillStyle = `rgba(255, 40, 30, ${0.5 + pulse * 0.2})`
        ctx.fill()
        ctx.strokeStyle = `rgba(255, 60, 40, ${0.6 + pulse * 0.2})`
        ctx.lineWidth = 1
        ctx.stroke()
      } else if (e.category === 'severeStorms') {
        // Magenta swirl
        ctx.beginPath()
        ctx.arc(x, y, 6 + pulse * 3, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(255, 70, 200, ${0.3 + pulse * 0.2})`
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(x, y, 2, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 70, 200, ${0.5 + pulse * 0.2})`
        ctx.fill()
      } else if (e.category === 'floods') {
        // Blue pulse
        ctx.beginPath()
        ctx.arc(x, y, 3 + pulse * 2, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(0, 120, 255, ${0.3 + pulse * 0.15})`
        ctx.fill()
      }
    }

    // ── Power outages (US, purple pulsing areas) ──
    for (const o of powerOutages) {
      const [x, y, vis] = ortho(o.lat, o.lon, cLon)
      if (!vis) continue

      const intensity = Math.min(1, o.customers / 50000)
      const pulse = 0.5 + 0.5 * Math.sin(now * 0.003 + o.lat * o.lon)
      const sz = 3 + intensity * 6
      const glow = ctx.createRadialGradient(x, y, 0, x, y, sz)
      glow.addColorStop(0, `rgba(${180 + intensity * 40}, 100, 255, ${(0.15 + intensity * 0.3) * pulse})`)
      glow.addColorStop(1, 'transparent')
      ctx.fillStyle = glow
      ctx.fillRect(x - sz, y - sz, sz * 2, sz * 2)

      ctx.beginPath()
      ctx.arc(x, y, 1.5 + intensity * 2, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${180 + intensity * 40}, 100, 255, ${0.3 + intensity * 0.3})`
      ctx.fill()
    }

    // ── Earthquake ripples (with labels) ──
    for (const q of ripples) {
      const [x, y, vis] = ortho(q.lat, q.lon, cLon)
      if (!vis) continue

      const age = (ts - q.born) / RIPPLE_LIFE
      if (age > 1) continue

      const maxRad = 16 + q.mag * 8
      const radius = maxRad * Math.sqrt(age)
      const alpha = (1 - age) * 0.7

      let r: number, g: number, b: number
      if (q.mag < 3) { r = 0; g = 210; b = 255 }
      else if (q.mag < 5) { r = 255; g = 180; b = 0 }
      else { r = 255; g = 50; b = 60 }

      // Outer ring
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.6})`
      ctx.lineWidth = 1.5 * (1 - age * 0.5)
      ctx.stroke()

      // Second ring
      if (age > 0.08) {
        ctx.beginPath()
        ctx.arc(x, y, maxRad * Math.sqrt(age - 0.08), 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.25})`
        ctx.lineWidth = 0.8
        ctx.stroke()
      }

      // Third ring (for larger quakes)
      if (age > 0.18 && q.mag >= 3) {
        ctx.beginPath()
        ctx.arc(x, y, maxRad * Math.sqrt(age - 0.18), 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.12})`
        ctx.lineWidth = 0.5
        ctx.stroke()
      }

      // Center dot (persists longer)
      if (age < 0.6) {
        const dotA = (1 - age / 0.6) * 0.9
        ctx.beginPath()
        ctx.arc(x, y, 2 + q.mag * 0.6, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${dotA})`
        ctx.fill()

        const glow = ctx.createRadialGradient(x, y, 0, x, y, 12 + q.mag * 4)
        glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${dotA * 0.3})`)
        glow.addColorStop(1, 'transparent')
        ctx.fillStyle = glow
        ctx.fillRect(x - 20, y - 20, 40, 40)
      }

      // Label — magnitude + short place name
      const labelAlpha = Math.min(alpha, 0.7)
      if (labelAlpha > 0.05) {
        const labelX = x + radius + 6
        const label = `M${q.mag.toFixed(1)}`
        ctx.font = '700 11px monospace'
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${labelAlpha})`
        ctx.fillText(label, labelX, y - 1)
        // Short place name (truncate after comma)
        const shortPlace = q.place.includes(',') ? q.place.split(',')[0]! : q.place
        ctx.font = '9px monospace'
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${labelAlpha * 0.65})`
        ctx.fillText(shortPlace, labelX, y + 11)
      }
    }

    // ── ISS trail ──
    for (let i = 0; i < trail.length; i++) {
      const pt = trail[i]!
      const [x, y, vis] = ortho(pt[0], pt[1], cLon)
      if (!vis) continue
      const a = (i / trail.length) * 0.45
      ctx.beginPath()
      ctx.arc(x, y, 1.5, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(0, 255, 136, ${a})`
      ctx.fill()
    }

    // ── ISS position ──
    if (issPos) {
      const [x, y, vis] = ortho(issPos.lat, issPos.lon, cLon)
      if (vis) {
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 20)
        glow.addColorStop(0, 'rgba(0, 255, 136, 0.3)')
        glow.addColorStop(1, 'transparent')
        ctx.fillStyle = glow
        ctx.fillRect(x - 20, y - 20, 40, 40)

        ctx.beginPath()
        ctx.arc(x, y, 3.5, 0, Math.PI * 2)
        ctx.fillStyle = '#00ff88'
        ctx.fill()

        ctx.font = '600 9px monospace'
        ctx.fillStyle = 'rgba(0, 255, 136, 0.6)'
        ctx.fillText('ISS', x + 8, y + 3)
      }
    }

    // ── City lights (night side only) ──
    const sun = getSunPosition()
    const sunLatR = sun.lat * DEG
    const sunLonR = sun.lon * DEG
    for (const [lat, lon, size] of cities) {
      const [x, y, vis, cosC] = ortho(lat, lon, cLon)
      if (!vis) continue

      // Check if on night side
      const latR = lat * DEG
      const lonR = lon * DEG
      const cosAngle = Math.sin(sunLatR) * Math.sin(latR) +
        Math.cos(sunLatR) * Math.cos(latR) * Math.cos(lonR - sunLonR)
      if (cosAngle > 0.05) continue // day side

      const nightness = Math.min(1, (-cosAngle + 0.05) / 0.2)
      const alpha = nightness * (0.15 + size * 0.35) * cosC

      // Glow
      const glowR = 3 + size * 5
      const glow = ctx.createRadialGradient(x, y, 0, x, y, glowR)
      glow.addColorStop(0, `rgba(255, 200, 100, ${alpha * 0.6})`)
      glow.addColorStop(0.5, `rgba(255, 180, 80, ${alpha * 0.2})`)
      glow.addColorStop(1, 'transparent')
      ctx.fillStyle = glow
      ctx.fillRect(x - glowR, y - glowR, glowR * 2, glowR * 2)

      // Core dot
      ctx.beginPath()
      ctx.arc(x, y, 0.8 + size * 1.2, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 220, 140, ${alpha})`
      ctx.fill()
    }

    // ── End globe clip — layers below draw outside globe ──
    ctx.restore()

    // ── Atmosphere particles ──
    for (const p of atmoParticles) {
      p.angle += p.speed * dt
      const px = CX + Math.cos(p.angle) * p.radius
      const py = CY + Math.sin(p.angle) * p.radius
      ctx.beginPath()
      ctx.arc(px, py, p.size, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(0, 160, 255, ${p.opacity})`
      ctx.fill()
    }

    // ── Globe rim ──
    ctx.beginPath()
    ctx.arc(CX, CY, R, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(0, 120, 200, 0.12)'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }, [])

  // Init simulated data
  useEffect(() => {
    initShips()
    initAtmo()
  }, [])

  // Fetch real data
  useEffect(() => {
    fetchQuakes()
    fetchISS()
    fetchWeather()
    fetchKpIndex()
    fetchEONET()
    fetchOutages()
    fetchOpenSky()
    // Start adsb.one after a short delay to let OpenSky load first
    const adsbDelay = setTimeout(() => fetchAdsbOne(), 5000)
    const q = setInterval(fetchQuakes, EQ_INTERVAL)
    const i = setInterval(fetchISS, ISS_INTERVAL)
    const w = setInterval(fetchWeather, WX_INTERVAL)
    const k = setInterval(fetchKpIndex, KP_INTERVAL)
    const eo = setInterval(fetchEONET, EONET_INTERVAL)
    const po = setInterval(fetchOutages, OUTAGE_INTERVAL)
    const os = setInterval(fetchOpenSky, OPENSKY_INTERVAL)
    const ab = setInterval(fetchAdsbOne, ADSBONE_INTERVAL)
    return () => {
      clearInterval(q); clearInterval(i); clearInterval(w)
      clearInterval(k); clearInterval(eo); clearInterval(po)
      clearInterval(os); clearInterval(ab); clearTimeout(adsbDelay)
    }
  }, [])

  // DOM state (1/s)
  useEffect(() => {
    const id = setInterval(() => {
      setUtc(new Date().toISOString().slice(11, 19))
      setIssAlt(issPos ? Math.round(issPos.alt) : null)
      setEventLine(eventLog[0] ?? 'Monitoring...')
      setCount(eqCount)
      setWxTotal(wxCount)
      setFlightCount(realFlights.length)
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // Render loop
  useEffect(() => {
    const glCanvas = glRef.current
    const overlayCanvas = overlayRef.current
    if (!glCanvas || !overlayCanvas) return

    glCanvas.width = W
    glCanvas.height = H
    overlayCanvas.width = W
    overlayCanvas.height = H

    const glState = initWebGL(glCanvas)
    const ctx = overlayCanvas.getContext('2d')
    if (!ctx) return

    let raf: number
    const t0 = performance.now()
    let prevT = t0

    const frame = () => {
      const now = performance.now()
      const dt = Math.min(now - prevT, 100)
      prevT = now
      const elapsed = now - t0
      const cLon = ((elapsed % ROT_PER) / ROT_PER) * 360
      currentViewLon = cLon > 180 ? cLon - 360 : cLon // normalize to -180..180 for API

      if (glState) {
        const { gl, uTime, uCenterLon, uSunLat, uSunLon, uKp } = glState
        const sun = getSunPosition()
        gl.uniform1f(uTime, now)
        gl.uniform1f(uCenterLon, cLon)
        gl.uniform1f(uSunLat, sun.lat)
        gl.uniform1f(uSunLon, sun.lon)
        gl.uniform1f(uKp, kpIndex)
        gl.drawArrays(gl.TRIANGLES, 0, 6)
      }

      drawOverlay(ctx, cLon, dt, now)

      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [drawOverlay])

  return (
    <div className="relative w-full h-full">
      <canvas ref={glRef} className="absolute inset-0 w-full h-full" />
      <canvas ref={overlayRef} className="absolute inset-0 w-full h-full" />

      {/* ── Top status bar ── */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-[44px] pt-[20px] pointer-events-none">
        <span className="text-[13px] font-bold tracking-[5px] text-cyan/60 font-mono">
          EARTH PULSE
        </span>
        <div className="flex items-center gap-5">
          {flightCount > 0 && (
            <span className="text-[10px] tracking-[2px] text-amber/40 font-mono">
              {flightCount} AIRCRAFT
            </span>
          )}
          {issAlt !== null && (
            <span className="text-[10px] tracking-[2px] text-green/40 font-mono">
              ISS ALT {issAlt}KM
            </span>
          )}
          <span className="text-[10px] tracking-[2px] text-cyan/30 font-mono">
            UTC {utc}
          </span>
          <div className="flex items-center gap-1.5">
            <div className="w-[6px] h-[6px] rounded-full bg-green/80 animate-live-pulse" />
            <span className="text-[9px] tracking-[3px] text-green/50 font-mono font-bold">
              LIVE
            </span>
          </div>
        </div>
      </div>

      {/* ── Bottom event feed ── */}
      <div className="absolute bottom-0 left-0 right-0 px-[44px] pb-[22px] pointer-events-none">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-[9px] tracking-[3px] text-amber/40 font-mono shrink-0">
              SEISMIC
            </span>
            <span className="text-[11px] text-cyan/40 font-mono truncate">
              {eventLine}
            </span>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            {wxTotal > 0 && (
              <span className="text-[9px] tracking-[2px] text-amber/30 font-mono">
                {wxTotal} ALERTS
              </span>
            )}
            <span className="text-[9px] tracking-[2px] text-cyan/25 font-mono">
              {count} QUAKES/1H
            </span>
          </div>
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="absolute right-[44px] top-1/2 -translate-y-1/2 pointer-events-none flex flex-col gap-[10px]">
        <LegendItem color="rgba(255, 230, 200, 0.7)" shape="chevron" label="Aircraft" />
        <LegendItem color="rgba(130, 200, 255, 0.7)" shape="diamond" label="Ships" />
        <LegendItem color="rgba(0, 210, 255, 0.7)" shape="ring" label="Earthquake" />
        <LegendItem color="rgba(180, 255, 0, 0.7)" shape="warning" label="Weather" />
        <LegendItem color="rgba(255, 30, 0, 0.7)" shape="glow" label="Wildfire" />
        <LegendItem color="rgba(255, 40, 30, 0.7)" shape="volcano" label="Volcano" />
        <LegendItem color="rgba(255, 70, 200, 0.7)" shape="swirl" label="Storm" />
        <LegendItem color="rgba(200, 100, 255, 0.7)" shape="glow" label="Power Outage" />
        <LegendItem color="rgba(0, 255, 136, 0.7)" shape="dot" label="ISS" />
        <LegendItem color="rgba(255, 200, 100, 0.7)" shape="glow" label="City Lights" />
      </div>

      <CornerBranding />
    </div>
  )
}

// ─── Legend item ─────────────────────────────────────────────────

function LegendItem({ color, shape, label }: {
  color: string
  shape: 'chevron' | 'diamond' | 'ring' | 'warning' | 'dot' | 'glow' | 'volcano' | 'swirl'
  label: string
}) {
  return (
    <div className="flex items-center gap-[8px]">
      <svg width="14" height="14" viewBox="0 0 14 14">
        {shape === 'chevron' && (
          <polygon points="11,7 4,3 6,7 4,11" fill={color} />
        )}
        {shape === 'diamond' && (
          <polygon points="7,2 11,7 7,10 3,7" fill={color} />
        )}
        {shape === 'ring' && (
          <circle cx="7" cy="7" r="5" fill="none" stroke={color} strokeWidth="1.5" />
        )}
        {shape === 'warning' && (
          <polygon points="7,2 12,7 7,10 2,7" fill={color} />
        )}
        {shape === 'dot' && (
          <circle cx="7" cy="7" r="3.5" fill={color} />
        )}
        {shape === 'swirl' && (
          <>
            <circle cx="7" cy="7" r="5" fill="none" stroke={color} strokeWidth="1" />
            <circle cx="7" cy="7" r="2" fill={color} />
          </>
        )}
        {shape === 'volcano' && (
          <polygon points="7,2 10,11 4,11" fill={color} />
        )}
        {shape === 'glow' && (
          <>
            <circle cx="7" cy="7" r="5" fill={color} opacity="0.25" />
            <circle cx="7" cy="7" r="2.5" fill={color} />
          </>
        )}
      </svg>
      <span className="text-[9px] tracking-[1px] font-mono text-text-dim">
        {label.toUpperCase()}
      </span>
    </div>
  )
}

// ─── Corner branding ─────────────────────────────────────────────

function CornerBranding() {
  const m = 'absolute w-[20px] h-[20px] border-cyan/20'
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className={`${m} top-[42px] left-[32px] border-t border-l`} />
      <div className={`${m} top-[42px] right-[32px] border-t border-r`} />
      <div className={`${m} bottom-[42px] left-[32px] border-b border-l`} />
      <div className={`${m} bottom-[42px] right-[32px] border-b border-r`} />
      <span className="absolute bottom-[48px] right-[42px] text-[10px] font-medium tracking-[1px] text-cyan/25 font-mono">
        DAZZLE.FM
      </span>
    </div>
  )
}
