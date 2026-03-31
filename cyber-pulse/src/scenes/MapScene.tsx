import { useRef, useEffect } from 'react'
import { store } from '../data/store'

const WIDTH = 1280
const HEIGHT = 720

const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  US: [39.8, -98.5],
  CN: [35.0, 105.0],
  RU: [61.5, 105.0],
  DE: [51.2, 10.4],
  FR: [46.2, 2.2],
  GB: [55.4, -3.4],
  BR: [-14.2, -51.9],
  IN: [20.6, 78.9],
  JP: [36.2, 138.3],
  KR: [35.9, 127.8],
  NL: [52.1, 5.3],
  AU: [-25.3, 133.8],
  CA: [56.1, -106.3],
  UA: [48.4, 31.2],
  VN: [14.1, 108.3],
  ID: [-0.8, 113.9],
  TW: [23.7, 121.0],
  SG: [1.4, 103.8],
  PL: [51.9, 19.1],
  IT: [41.9, 12.6],
  TH: [15.9, 100.9],
  MX: [23.6, -102.6],
  AR: [-38.4, -63.6],
  ZA: [-30.6, 22.9],
  EG: [26.8, 30.8],
  IR: [32.4, 53.7],
  TR: [39.9, 32.9],
  PK: [30.4, 69.3],
  BD: [23.7, 90.4],
  NG: [9.1, 8.7],
  CO: [4.6, -74.3],
  PH: [12.9, 121.8],
  MY: [4.2, 101.9],
  SA: [23.9, 45.1],
  RO: [45.9, 24.9],
  CZ: [49.8, 15.5],
  HK: [22.3, 114.2],
  CL: [-35.7, -71.5],
  SE: [60.1, 18.6],
  HU: [47.2, 19.5],
  BG: [42.7, 25.5],
  AT: [47.5, 14.6],
  CH: [46.8, 8.2],
  FI: [61.9, 25.7],
  NO: [60.5, 8.5],
  DK: [56.3, 9.5],
  IE: [53.1, -8.2],
  PT: [39.4, -8.2],
  GR: [39.1, 21.8],
  IL: [31.0, 34.9],
  AE: [23.4, 53.8],
  BE: [50.5, 4.5],
  LT: [55.2, 23.9],
  LV: [56.9, 24.1],
  EE: [58.6, 25.0],
  RS: [44.0, 21.0],
  HR: [45.1, 15.2],
  SK: [48.7, 19.7],
  SI: [46.2, 14.8],
  BY: [53.7, 27.9],
  MD: [47.4, 28.4],
  GE: [42.3, 43.4],
  AM: [40.1, 45.0],
  AZ: [40.1, 47.6],
  KZ: [48.0, 68.0],
  UZ: [41.4, 64.6],
  KE: [-0.0, 37.9],
  TZ: [-6.4, 34.9],
  ET: [9.1, 40.5],
  GH: [7.9, -1.0],
  PE: [-9.2, -75.0],
  VE: [6.4, -66.6],
  EC: [-1.8, -78.2],
  BO: [-16.3, -63.6],
  PY: [-23.4, -58.4],
  UY: [-32.5, -55.8],
  NZ: [-40.9, 174.9],
  MM: [19.8, 96.2],
  KH: [12.6, 105.0],
  LA: [19.9, 102.5],
  NP: [28.4, 84.1],
  LK: [7.9, 80.8],
}

const CONTINENTS: Array<Array<[number, number]>> = [
  [
    [-10, -75], [-5, -80], [5, -77], [10, -72], [8, -62], [5, -60], [5, -52],
    [2, -50], [-5, -35], [-15, -40], [-22, -42], [-28, -49], [-34, -54],
    [-40, -63], [-48, -66], [-52, -70], [-54, -69], [-55, -67], [-53, -72],
    [-46, -76], [-40, -73], [-33, -72], [-27, -71], [-20, -70], [-16, -75],
    [-10, -75],
  ],
  [
    [8, -78], [10, -84], [15, -88], [18, -88], [20, -87], [21, -90],
    [18, -96], [20, -105], [25, -110], [30, -115], [32, -117], [37, -122],
    [42, -124], [48, -124], [53, -130], [58, -137], [60, -140], [60, -147],
    [64, -166], [71, -157], [71, -140], [68, -135], [62, -115], [60, -95],
    [63, -82], [60, -65], [52, -56], [47, -53], [44, -60], [43, -66],
    [41, -70], [30, -82], [25, -80], [25, -82], [18, -88], [15, -83],
    [8, -78],
  ],
  [
    [36, -10], [38, -8], [43, -9], [44, -1], [46, -2], [48, 0], [49, 2],
    [51, 2], [52, 5], [54, 8], [57, 10], [60, 5], [62, 5], [64, 11],
    [67, 16], [70, 20], [71, 28], [70, 30], [68, 40], [65, 41], [62, 50],
    [58, 60], [55, 70], [50, 80], [55, 90], [60, 100], [63, 120], [65, 140],
    [60, 155], [55, 160], [50, 143], [47, 143], [45, 135], [40, 130],
    [38, 117], [35, 105], [32, 95], [30, 80], [25, 68], [27, 56], [25, 50],
    [30, 48], [27, 35], [32, 35], [35, 27], [37, 22], [35, 12], [36, -10],
  ],
  [
    [37, -10], [35, -5], [32, -2], [30, -10], [25, -16], [20, -17],
    [15, -17], [10, -15], [5, -10], [5, 0], [4, 10], [2, 10], [0, 9],
    [-3, 12], [-5, 12], [-10, 14], [-12, 17], [-15, 18], [-22, 15],
    [-26, 22], [-28, 28], [-30, 30], [-34, 26], [-34, 18], [-32, 17],
    [-29, 16], [-22, 35], [-15, 41], [-12, 44], [-3, 42], [3, 43],
    [5, 45], [10, 50], [12, 44], [15, 40], [20, 37], [25, 33], [30, 32],
    [32, 32], [32, 35], [35, 35], [36, 1], [37, -10],
  ],
  [
    [-12, 132], [-15, 130], [-20, 118], [-25, 114], [-32, 115], [-35, 117],
    [-34, 122], [-32, 133], [-35, 137], [-37, 140], [-38, 146], [-38, 148],
    [-34, 151], [-28, 153], [-24, 152], [-20, 149], [-17, 146], [-14, 143],
    [-12, 142], [-11, 136], [-12, 132],
  ],
]

const WELL_KNOWN_PORTS = new Set([22, 23, 25, 53, 80, 443, 445, 993, 995, 3389, 8080, 8443])

interface CountryAttack {
  country: string
  count: number
  latitude: number
  longitude: number
}

let previousFingerprint = ''
let countryAttacks: CountryAttack[] = []
let totalAttackCount = 0

const COUNTRY_CODES = Object.keys(COUNTRY_CENTROIDS)

function ipToCountryIndex(ipAddress: string): number {
  let hash = 0
  for (let index = 0; index < ipAddress.length; index++) {
    hash = ((hash << 5) - hash + ipAddress.charCodeAt(index)) | 0
  }
  return Math.abs(hash) % COUNTRY_CODES.length
}

function rebuildCountryData() {
  const c2List = store.feodoC2s
  const topIPs = store.sansTopIPs
  const fingerprint = `${c2List.length}:${topIPs.length}:${topIPs[0]?.attacks ?? 0}`
  if (fingerprint === previousFingerprint && countryAttacks.length > 0) return

  previousFingerprint = fingerprint
  const countryMap = new Map<string, number>()

  for (const c2 of c2List) {
    if (c2.country === '') continue
    const current = countryMap.get(c2.country) ?? 0
    countryMap.set(c2.country, current + 1)
  }

  totalAttackCount = 0
  for (const topIP of topIPs) {
    totalAttackCount += topIP.attacks
    const countryIndex = ipToCountryIndex(topIP.source)
    const countryCode = COUNTRY_CODES[countryIndex]
    if (!countryCode) continue
    const current = countryMap.get(countryCode) ?? 0
    countryMap.set(countryCode, current + topIP.attacks)
  }

  const results: CountryAttack[] = []
  for (const [country, count] of countryMap) {
    const centroid = COUNTRY_CENTROIDS[country]
    if (!centroid) continue
    results.push({
      country,
      count,
      latitude: centroid[0],
      longitude: centroid[1],
    })
  }

  results.sort((attackA, attackB) => attackB.count - attackA.count)
  countryAttacks = results
}

function projectX(longitude: number): number {
  return ((longitude + 180) / 360) * WIDTH
}

function projectY(latitude: number): number {
  return ((90 - latitude) / 180) * HEIGHT
}

function drawMap(context: CanvasRenderingContext2D, now: number) {
  context.clearRect(0, 0, WIDTH, HEIGHT)

  context.fillStyle = '#010208'
  context.fillRect(0, 0, WIDTH, HEIGHT)

  context.strokeStyle = 'rgba(255, 255, 255, 0.03)'
  context.lineWidth = 0.5
  for (let latitude = -60; latitude <= 90; latitude += 30) {
    const screenY = projectY(latitude)
    context.beginPath()
    context.moveTo(0, screenY)
    context.lineTo(WIDTH, screenY)
    context.stroke()
  }
  for (let longitude = -180; longitude <= 180; longitude += 30) {
    const screenX = projectX(longitude)
    context.beginPath()
    context.moveTo(screenX, 0)
    context.lineTo(screenX, HEIGHT)
    context.stroke()
  }

  for (const continent of CONTINENTS) {
    context.beginPath()
    const firstPoint = continent[0]
    if (!firstPoint) continue
    context.moveTo(projectX(firstPoint[1]), projectY(firstPoint[0]))
    for (let index = 1; index < continent.length; index++) {
      const point = continent[index]
      if (!point) continue
      context.lineTo(projectX(point[1]), projectY(point[0]))
    }
    context.closePath()
    context.fillStyle = '#0a0a14'
    context.fill()
    context.strokeStyle = '#1a1a2e'
    context.lineWidth = 1
    context.stroke()
  }

  rebuildCountryData()

  const maxCount = countryAttacks.length > 0
    ? (countryAttacks[0]?.count ?? 1)
    : 1

  const pulse = Math.sin(now * 0.003) * 2

  for (const attack of countryAttacks) {
    const screenX = projectX(attack.longitude)
    const screenY = projectY(attack.latitude)
    const fraction = attack.count / maxCount
    const baseRadius = 4 + fraction * 16
    const radius = baseRadius + pulse * fraction

    for (let layer = 3; layer >= 0; layer--) {
      const layerRadius = radius + layer * 4
      const opacity = 0.05 - layer * 0.012
      context.beginPath()
      context.arc(screenX, screenY, layerRadius, 0, Math.PI * 2)
      context.fillStyle = `rgba(0, 229, 255, ${Math.max(0, opacity)})`
      context.fill()
    }

    context.beginPath()
    context.arc(screenX, screenY, radius, 0, Math.PI * 2)
    const coreOpacity = 0.3 + fraction * 0.4
    context.fillStyle = `rgba(0, 229, 255, ${coreOpacity})`
    context.fill()

    context.beginPath()
    context.arc(screenX, screenY, radius * 0.4, 0, Math.PI * 2)
    context.fillStyle = `rgba(0, 229, 255, ${0.6 + fraction * 0.3})`
    context.fill()
  }

  const topFive = countryAttacks.slice(0, 5)
  const labelFade = Math.min(1, (now % 10000) / 2000)
  context.font = '600 16px "JetBrains Mono", monospace'

  for (const attack of topFive) {
    const screenX = projectX(attack.longitude)
    const screenY = projectY(attack.latitude)
    const fraction = attack.count / maxCount
    const labelRadius = 4 + fraction * 16 + 8

    context.fillStyle = `rgba(0, 229, 255, ${0.7 * labelFade})`
    context.fillText(
      `${attack.country}  ${attack.count}`,
      screenX + labelRadius,
      screenY + 4,
    )
  }

  const topPorts = store.sansTopPorts.slice(0, 5)
  const portStartX = WIDTH - 200
  const portStartY = HEIGHT - 30 - topPorts.length * 18

  context.font = '500 16px "JetBrains Mono", monospace'
  for (let index = 0; index < topPorts.length; index++) {
    const port = topPorts[index]
    if (!port) continue
    const isWellKnown = WELL_KNOWN_PORTS.has(port.targetport)
    context.fillStyle = isWellKnown
      ? 'rgba(0, 229, 255, 0.7)'
      : 'rgba(255, 190, 11, 0.7)'
    context.fillText(
      `PORT ${String(port.targetport).padStart(5, ' ')}  ${port.records} attacks`,
      portStartX,
      portStartY + index * 18,
    )
  }

  const displayCount = totalAttackCount > 0
    ? totalAttackCount
    : countryAttacks.reduce((sum, attack) => sum + attack.count, 0)

  context.font = '700 16px "JetBrains Mono", monospace'
  context.fillStyle = 'rgba(0, 229, 255, 0.5)'
  context.fillText('ATTACKS TRACKED', 24, 32)
  context.font = '700 32px "JetBrains Mono", monospace'
  context.fillStyle = 'rgba(0, 229, 255, 0.8)'
  context.fillText(displayCount.toLocaleString(), 24, 58)
}

export function MapScene() {
  const canvasReference = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasReference.current
    if (!canvas) return

    canvas.width = WIDTH
    canvas.height = HEIGHT
    const context = canvas.getContext('2d')
    if (!context) return

    let frameHandle: number

    const frame = () => {
      const now = performance.now()
      drawMap(context, now)
      frameHandle = requestAnimationFrame(frame)
    }

    frameHandle = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(frameHandle)
  }, [])

  return (
    <div className="absolute inset-0" style={{ background: '#010208' }}>
      <canvas
        ref={canvasReference}
        className="absolute inset-0 w-full h-full"
      />
    </div>
  )
}
