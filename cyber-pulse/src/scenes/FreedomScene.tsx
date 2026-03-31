import { useRef, useEffect } from 'react'
import { store } from '../data/store'
import type { OONIIncident } from '../data/types'

const WIDTH = 1280
const HEIGHT = 720
const FONT = "'JetBrains Mono', monospace"
const MAP_LEFT = 40
const MAP_RIGHT = WIDTH * 0.62
const MAP_TOP = 80
const MAP_BOTTOM = HEIGHT - 60
const CALLOUT_LEFT = WIDTH * 0.65
const CALLOUT_RIGHT = WIDTH - 40

const COUNTRY_CENTROIDS: Record<string, [number, number]> = [
  ['US', [-98, 38]], ['CA', [-106, 56]], ['MX', [-102, 23]],
  ['BR', [-51, -10]], ['AR', [-64, -34]], ['CO', [-74, 4]],
  ['GB', [-2, 54]], ['FR', [2, 46]], ['DE', [10, 51]],
  ['IT', [12, 42]], ['ES', [-4, 40]], ['PT', [-8, 39]],
  ['NL', [5, 52]], ['BE', [4, 51]], ['CH', [8, 47]],
  ['SE', [15, 62]], ['NO', [10, 62]], ['FI', [26, 64]],
  ['DK', [10, 56]], ['PL', [20, 52]], ['UA', [32, 49]],
  ['RU', [100, 60]], ['CN', [105, 35]], ['JP', [138, 36]],
  ['KR', [127, 36]], ['IN', [79, 21]], ['PK', [70, 30]],
  ['IR', [53, 32]], ['IQ', [44, 33]], ['SA', [45, 24]],
  ['AE', [54, 24]], ['EG', [30, 27]], ['NG', [8, 10]],
  ['ZA', [25, -29]], ['KE', [38, 1]], ['ET', [40, 9]],
  ['AU', [134, -25]], ['NZ', [174, -41]], ['ID', [120, -5]],
  ['TH', [101, 15]], ['VN', [108, 16]], ['MM', [96, 22]],
  ['TR', [35, 39]], ['BD', [90, 24]], ['CU', [-80, 22]],
  ['VE', [-66, 7]], ['SD', [30, 16]], ['BY', [28, 53]],
  ['SY', [38, 35]], ['TZ', [35, -6]], ['TN', [9, 34]],
  ['UZ', [65, 41]], ['KZ', [67, 48]], ['PH', [122, 12]],
  ['MY', [102, 4]], ['SG', [104, 1]], ['LK', [81, 7]],
  ['HK', [114, 22]], ['TW', [121, 24]], ['AZ', [48, 40]],
  ['GE', [44, 42]], ['AM', [45, 40]], ['JO', [36, 31]],
  ['LB', [36, 34]], ['OM', [57, 21]], ['QA', [51, 25]],
  ['BH', [50, 26]], ['KW', [48, 29]], ['YE', [48, 15]],
  ['LY', [17, 27]], ['MA', [-5, 32]], ['DZ', [3, 28]],
  ['GH', [-1, 8]], ['CM', [12, 6]], ['CD', [24, -3]],
  ['UG', [32, 1]], ['RW', [30, -2]], ['MZ', [35, -18]],
  ['ZW', [30, -20]], ['AO', [17, -12]],
].reduce<Record<string, [number, number]>>((accumulator, entry) => {
  const code = entry[0]
  const coords = entry[1]
  if (typeof code === 'string' && Array.isArray(coords)) {
    const longitude = coords[0]
    const latitude = coords[1]
    if (typeof longitude === 'number' && typeof latitude === 'number') {
      accumulator[code] = [longitude, latitude]
    }
  }
  return accumulator
}, {})

const CONTINENT_OUTLINES: Array<Array<[number, number]>> = [
  [[-130, 50], [-120, 60], [-100, 60], [-80, 55], [-60, 50], [-80, 25], [-100, 20], [-120, 30], [-130, 50]],
  [[-80, 10], [-60, 12], [-35, -5], [-40, -20], [-55, -30], [-70, -35], [-75, -20], [-80, 0], [-80, 10]],
  [[-15, 36], [0, 38], [10, 45], [30, 55], [40, 60], [30, 70], [10, 65], [-10, 55], [-15, 36]],
  [[-15, 35], [10, 32], [30, 30], [40, 12], [50, 10], [35, -5], [20, -20], [30, -35], [15, -35], [10, -15], [-5, 5], [-15, 10], [-15, 35]],
  [[35, 35], [50, 25], [65, 40], [80, 25], [90, 22], [105, 35], [120, 35], [135, 45], [140, 55], [180, 65], [120, 70], [70, 60], [45, 45], [35, 35]],
  [[110, -10], [130, -15], [145, -20], [150, -35], [140, -40], [115, -35], [115, -20], [110, -10]],
]

function lonLatToScreen(longitude: number, latitude: number): [number, number] {
  const mapWidth = MAP_RIGHT - MAP_LEFT
  const mapHeight = MAP_BOTTOM - MAP_TOP
  const screenX = MAP_LEFT + ((longitude + 180) / 360) * mapWidth
  const screenY = MAP_TOP + ((90 - latitude) / 180) * mapHeight
  return [screenX, screenY]
}

function drawGrid(context: CanvasRenderingContext2D) {
  context.strokeStyle = 'rgba(255, 255, 255, 0.02)'
  context.lineWidth = 1
  for (let x = 0; x < WIDTH; x += 40) {
    context.beginPath()
    context.moveTo(x, 0)
    context.lineTo(x, HEIGHT)
    context.stroke()
  }
  for (let y = 0; y < HEIGHT; y += 40) {
    context.beginPath()
    context.moveTo(0, y)
    context.lineTo(WIDTH, y)
    context.stroke()
  }
}

function drawContinents(context: CanvasRenderingContext2D) {
  context.strokeStyle = 'rgba(255, 255, 255, 0.08)'
  context.lineWidth = 1

  for (const outline of CONTINENT_OUTLINES) {
    context.beginPath()
    for (let index = 0; index < outline.length; index++) {
      const point = outline[index]
      if (!point) continue
      const [screenX, screenY] = lonLatToScreen(point[0], point[1])
      if (index === 0) {
        context.moveTo(screenX, screenY)
      } else {
        context.lineTo(screenX, screenY)
      }
    }
    context.stroke()

    context.fillStyle = 'rgba(255, 255, 255, 0.015)'
    context.fill()
  }
}

function drawIncidentMarker(
  context: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  countryCode: string,
  time: number,
  phase: number,
) {
  const pulseRadius = 8 + Math.sin(time * 0.003 + phase) * 3
  const outerRadius = pulseRadius + 6 + Math.sin(time * 0.002 + phase) * 4

  context.beginPath()
  context.arc(screenX, screenY, outerRadius, 0, Math.PI * 2)
  context.fillStyle = 'rgba(239, 35, 60, 0.08)'
  context.fill()

  context.beginPath()
  context.arc(screenX, screenY, pulseRadius, 0, Math.PI * 2)
  context.fillStyle = 'rgba(239, 35, 60, 0.25)'
  context.fill()
  context.strokeStyle = 'rgba(239, 35, 60, 0.5)'
  context.lineWidth = 1
  context.stroke()

  context.beginPath()
  context.arc(screenX, screenY, 3, 0, Math.PI * 2)
  context.fillStyle = '#ef233c'
  context.fill()

  context.font = `bold 14px ${FONT}`
  context.fillStyle = 'rgba(239, 35, 60, 0.8)'
  context.textAlign = 'left'
  context.textBaseline = 'middle'
  context.fillText(countryCode, screenX + pulseRadius + 6, screenY)
}

function formatDuration(startTime: string): string {
  const startMs = new Date(startTime).getTime()
  const nowMs = Date.now()
  const diffMs = nowMs - startMs
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h`
  return '<1h'
}

function drawCallout(
  context: CanvasRenderingContext2D,
  incident: OONIIncident,
  positionY: number,
) {
  const calloutWidth = CALLOUT_RIGHT - CALLOUT_LEFT
  const calloutHeight = 85

  context.fillStyle = 'rgba(239, 35, 60, 0.04)'
  context.fillRect(CALLOUT_LEFT, positionY, calloutWidth, calloutHeight)
  context.strokeStyle = 'rgba(239, 35, 60, 0.15)'
  context.lineWidth = 1
  context.strokeRect(CALLOUT_LEFT, positionY, calloutWidth, calloutHeight)

  const paddingX = CALLOUT_LEFT + 12
  let textY = positionY + 16

  context.font = `bold 16px ${FONT}`
  context.fillStyle = '#ef233c'
  context.textAlign = 'left'
  context.textBaseline = 'top'
  const titleText = incident.title.length > 40
    ? incident.title.slice(0, 37) + '...'
    : incident.title
  context.fillText(titleText, paddingX, textY)
  textY += 18

  context.font = `14px ${FONT}`
  context.fillStyle = 'rgba(255, 255, 255, 0.5)'
  context.fillText(`COUNTRIES: ${incident.CCs.join(', ')}`, paddingX, textY)
  textY += 14

  context.fillStyle = 'rgba(255, 255, 255, 0.35)'
  const eventLabel = incident.event_type || 'UNKNOWN'
  const durationLabel = incident.start_time ? formatDuration(incident.start_time) : 'N/A'
  context.fillText(`${eventLabel.toUpperCase()} — ${durationLabel}`, paddingX, textY)
}

function drawNoIncidents(context: CanvasRenderingContext2D) {
  const centerX = WIDTH / 2
  const centerY = HEIGHT / 2

  context.beginPath()
  context.arc(centerX, centerY, 40, 0, Math.PI * 2)
  context.fillStyle = 'rgba(6, 214, 160, 0.06)'
  context.fill()
  context.strokeStyle = 'rgba(6, 214, 160, 0.3)'
  context.lineWidth = 2
  context.stroke()

  context.beginPath()
  context.arc(centerX, centerY, 8, 0, Math.PI * 2)
  context.fillStyle = '#06d6a0'
  context.fill()

  context.font = `bold 18px ${FONT}`
  context.fillStyle = '#06d6a0'
  context.textAlign = 'center'
  context.textBaseline = 'top'
  context.fillText('NO ACTIVE CENSORSHIP EVENTS DETECTED', centerX, centerY + 55)
}

function drawHeader(context: CanvasRenderingContext2D, incidentCount: number) {
  context.font = `bold 16px ${FONT}`
  context.fillStyle = 'rgba(255, 255, 255, 0.25)'
  context.textAlign = 'center'
  context.textBaseline = 'top'
  context.letterSpacing = '6px'
  context.fillText('INTERNET FREEDOM MONITOR', WIDTH / 2, 24)
  context.letterSpacing = '0px'

  const affectedCountries = new Set<string>()
  for (const incident of store.ooniIncidents) {
    for (const countryCode of incident.CCs) {
      affectedCountries.add(countryCode)
    }
  }

  context.font = `bold 16px ${FONT}`
  context.fillStyle = incidentCount > 0
    ? 'rgba(239, 35, 60, 0.6)'
    : 'rgba(6, 214, 160, 0.6)'
  context.textAlign = 'center'
  context.fillText(
    `${affectedCountries.size} COUNTRIES WITH ACTIVE CENSORSHIP EVENTS`,
    WIDTH / 2,
    HEIGHT - 30,
  )
}

export function FreedomScene() {
  const canvasReference = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasReference.current
    if (!canvas) return

    canvas.width = WIDTH
    canvas.height = HEIGHT
    const context = canvas.getContext('2d')
    if (!context) return

    let frameID = 0

    const frame = () => {
      const now = performance.now()

      context.fillStyle = '#010208'
      context.fillRect(0, 0, WIDTH, HEIGHT)
      drawGrid(context)

      const incidents = store.ooniIncidents
      drawHeader(context, incidents.length)

      drawContinents(context)

      if (incidents.length === 0) {
        drawNoIncidents(context)
      } else {
        let markerPhase = 0
        const placedCountries = new Set<string>()

        for (const incident of incidents) {
          for (const countryCode of incident.CCs) {
            if (placedCountries.has(countryCode)) continue
            placedCountries.add(countryCode)

            const centroid = COUNTRY_CENTROIDS[countryCode]
            if (!centroid) continue

            const [screenX, screenY] = lonLatToScreen(centroid[0], centroid[1])
            drawIncidentMarker(context, screenX, screenY, countryCode, now, markerPhase)
            markerPhase += 1.5
          }
        }

        let calloutY = MAP_TOP
        const maxCallouts = Math.min(incidents.length, 6)
        for (let index = 0; index < maxCallouts; index++) {
          const incident = incidents[index]
          if (!incident) continue
          drawCallout(context, incident, calloutY)
          calloutY += 95
        }
      }

      frameID = requestAnimationFrame(frame)
    }

    frameID = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(frameID)
  }, [])

  return (
    <canvas
      ref={canvasReference}
      className="absolute inset-0 w-full h-full"
      style={{ background: '#010208' }}
    />
  )
}
