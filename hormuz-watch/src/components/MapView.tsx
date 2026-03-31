import { useMemo } from 'react'
import topology from 'world-atlas/countries-50m.json'
import { feature } from 'topojson-client'
import { geoMercator, geoPath } from 'd3-geo'
import type { Vessel } from '../types'
import { classifyVessel, VESSEL_COLORS, REGION_BOUNDS } from '../types'
import type { GeometryCollection } from 'topojson-specification'

interface MapViewProps {
  vessels: Map<string, Vessel>
  connectionStatus: string
}

const COUNTRY_LABELS: Array<{ name: string, longitude: number, latitude: number }> = [
  { name: 'IRAN', longitude: 53.5, latitude: 27.8 },
  { name: 'SAUDI\nARABIA', longitude: 50.5, latitude: 24.2 },
  { name: 'U.A.E.', longitude: 54.8, latitude: 24.0 },
  { name: 'OMAN', longitude: 57.8, latitude: 23.8 },
  { name: 'QATAR', longitude: 51.0, latitude: 25.4 },
]

const CITY_MARKERS: Array<{ name: string, longitude: number, latitude: number }> = [
  { name: 'Bandar Abbas', longitude: 56.27, latitude: 27.19 },
  { name: 'Dubai', longitude: 55.27, latitude: 25.20 },
  { name: 'Muscat', longitude: 58.54, latitude: 23.59 },
  { name: 'Fujairah', longitude: 56.33, latitude: 25.12 },
  { name: 'Doha', longitude: 51.53, latitude: 25.29 },
  { name: 'Manama', longitude: 50.58, latitude: 26.22 },
]

const INBOUND_LANE: Array<[number, number]> = [
  [56.55, 26.22],
  [56.30, 26.37],
  [56.00, 26.48],
  [55.50, 26.58],
  [55.00, 26.68],
]

const OUTBOUND_LANE: Array<[number, number]> = [
  [55.00, 26.55],
  [55.50, 26.45],
  [56.00, 26.35],
  [56.30, 26.20],
  [56.55, 26.05],
]

const MAP_WIDTH = 832
const MAP_HEIGHT = 616

export function MapView({ vessels, connectionStatus }: MapViewProps) {
  const projection = useMemo(() => {
    const boundingFeature: GeoJSON.Feature = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [REGION_BOUNDS.minLon, REGION_BOUNDS.minLat],
          [REGION_BOUNDS.minLon, REGION_BOUNDS.maxLat],
          [REGION_BOUNDS.maxLon, REGION_BOUNDS.maxLat],
          [REGION_BOUNDS.maxLon, REGION_BOUNDS.minLat],
          [REGION_BOUNDS.minLon, REGION_BOUNDS.minLat],
        ]],
      },
    }
    return geoMercator().fitExtent(
      [[0, 0], [MAP_WIDTH, MAP_HEIGHT]],
      boundingFeature,
    )
  }, [])

  const pathGenerator = useMemo(() => geoPath(projection), [projection])

  const coastlinePaths = useMemo(() => {
    const countriesObject = topology.objects['countries']
    if (!countriesObject) return []

    const countries = feature(topology, countriesObject as GeometryCollection)
    const paths: string[] = []

    for (const countryFeature of countries.features) {
      const pathString = pathGenerator(countryFeature)
      if (pathString) {
        paths.push(pathString)
      }
    }

    return paths
  }, [pathGenerator])

  const projectPoint = (longitude: number, latitude: number): [number, number] | null => {
    const result = projection([longitude, latitude])
    if (!result) return null
    return result
  }

  const laneToSvgPath = (lane: Array<[number, number]>): string => {
    const segments: string[] = []
    for (const [longitude, latitude] of lane) {
      const point = projectPoint(longitude, latitude)
      if (!point) continue
      segments.push(segments.length === 0
        ? `M${point[0]},${point[1]}`
        : `L${point[0]},${point[1]}`)
    }
    return segments.join(' ')
  }

  const inboundPath = laneToSvgPath(INBOUND_LANE)
  const outboundPath = laneToSvgPath(OUTBOUND_LANE)

  const straitLabelPosition = projectPoint(56.0, 26.65)

  return (
    <svg
      width={MAP_WIDTH}
      height={MAP_HEIGHT}
      className="block"
      style={{ overflow: 'hidden' }}
    >
      <defs>
        <filter id="vessel-glow" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id="map-clip">
          <rect width={MAP_WIDTH} height={MAP_HEIGHT} />
        </clipPath>
      </defs>

      <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="#0a0e1a" />

      <g clipPath="url(#map-clip)">
        {coastlinePaths.map((pathString, index) => (
          <path
            key={index}
            d={pathString}
            fill="#141828"
            stroke="#1e2440"
            strokeWidth={0.5}
          />
        ))}
      </g>

      {COUNTRY_LABELS.map(label => {
        const point = projectPoint(label.longitude, label.latitude)
        if (!point) return null
        const lines = label.name.split('\n')
        return (
          <text
            key={label.name}
            x={point[0]}
            y={point[1]}
            fill="#252d48"
            fontSize={13}
            fontFamily="'Inter', system-ui, sans-serif"
            fontWeight={700}
            textAnchor="middle"
            letterSpacing="0.2em"
          >
            {lines.map((line, lineIndex) => (
              <tspan key={lineIndex} x={point[0]} dy={lineIndex === 0 ? 0 : 16}>
                {line}
              </tspan>
            ))}
          </text>
        )
      })}

      {CITY_MARKERS.map(city => {
        const point = projectPoint(city.longitude, city.latitude)
        if (!point) return null
        return (
          <g key={city.name}>
            <circle cx={point[0]} cy={point[1]} r={2.5} fill="#3a4060" />
            <text
              x={point[0] + 8}
              y={point[1] + 4}
              fill="#4a5070"
              fontSize={10}
              fontFamily="'Inter', system-ui, sans-serif"
              fontWeight={500}
            >
              {city.name}
            </text>
          </g>
        )
      })}

      <path
        d={inboundPath}
        stroke="#1e2a40"
        strokeWidth={3}
        strokeDasharray="10 5"
        fill="none"
        opacity={0.5}
      />
      <path
        d={outboundPath}
        stroke="#1e2a40"
        strokeWidth={3}
        strokeDasharray="10 5"
        fill="none"
        opacity={0.5}
      />

      {straitLabelPosition && (
        <text
          x={straitLabelPosition[0]}
          y={straitLabelPosition[1]}
          fill="#2a3a5a"
          fontSize={11}
          fontFamily="'Inter', system-ui, sans-serif"
          fontWeight={600}
          textAnchor="middle"
          letterSpacing="0.25em"
        >
          STRAIT OF HORMUZ
        </text>
      )}

      {Array.from(vessels.values()).map(vessel => {
        const point = projectPoint(vessel.longitude, vessel.latitude)
        if (!point) return null

        const vesselType = classifyVessel(vessel.shipType)
        const vesselColor = VESSEL_COLORS[vesselType]
        const isMoving = vessel.speed > 1

        const trailPoints = vessel.trail
          .map(([longitude, latitude]) => projectPoint(longitude, latitude))
          .filter((trailPoint): trailPoint is [number, number] => trailPoint !== null)

        return (
          <g key={vessel.mmsi}>
            {trailPoints.length > 1 && (
              <polyline
                points={trailPoints.map(trailPoint => `${trailPoint[0]},${trailPoint[1]}`).join(' ')}
                fill="none"
                stroke={vesselColor}
                strokeWidth={1.5}
                opacity={0.25}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            <circle
              cx={point[0]}
              cy={point[1]}
              r={5}
              fill={vesselColor}
              filter="url(#vessel-glow)"
              style={isMoving ? { animation: 'pulse-glow 2s ease-in-out infinite' } : undefined}
            />
          </g>
        )
      })}

      <g transform={`translate(16, ${MAP_HEIGHT - 36})`}>
        <rect width={130} height={24} rx={4} fill="rgba(10, 14, 26, 0.85)" stroke="#1a1e30" strokeWidth={1} />
        <circle cx={14} cy={12} r={4} fill="#00ff88" filter="url(#vessel-glow)" />
        <text x={26} y={16} fill="#6b7194" fontSize={11} fontFamily="'Inter', system-ui, sans-serif" fontWeight={500}>
          {vessels.size} vessels in view
        </text>
      </g>

      <g transform="translate(16, 20)">
        {connectionStatus === 'connected' ? (
          <g>
            <rect width={86} height={22} rx={4} fill="rgba(34, 197, 94, 0.12)" />
            <circle cx={14} cy={11} r={3} fill="#22c55e" />
            <text x={24} y={15} fill="#22c55e" fontSize={10} fontFamily="'Inter', system-ui, sans-serif" fontWeight={600}>
              AIS LIVE
            </text>
          </g>
        ) : connectionStatus === 'connecting' ? (
          <g>
            <rect width={100} height={22} rx={4} fill="rgba(99, 102, 241, 0.12)" />
            <text x={10} y={15} fill="#818cf8" fontSize={10} fontFamily="'Inter', system-ui, sans-serif" fontWeight={600}>
              CONNECTING...
            </text>
          </g>
        ) : connectionStatus === 'no-key' ? (
          <g>
            <rect width={160} height={22} rx={4} fill="rgba(99, 102, 241, 0.08)" />
            <text x={10} y={15} fill="#6b7194" fontSize={10} fontFamily="'Inter', system-ui, sans-serif" fontWeight={500}>
              AIS: set API key for live
            </text>
          </g>
        ) : connectionStatus === 'rest-only' ? (
          <g>
            <rect width={86} height={22} rx={4} fill="rgba(34, 197, 94, 0.08)" />
            <circle cx={14} cy={11} r={3} fill="#22c55e" opacity={0.6} />
            <text x={24} y={15} fill="#6b7194" fontSize={10} fontFamily="'Inter', system-ui, sans-serif" fontWeight={600}>
              AIS DATA
            </text>
          </g>
        ) : connectionStatus === 'unavailable' ? (
          <g>
            <rect width={130} height={22} rx={4} fill="rgba(99, 102, 241, 0.08)" />
            <text x={10} y={15} fill="#6b7194" fontSize={10} fontFamily="'Inter', system-ui, sans-serif" fontWeight={500}>
              AIS UNAVAILABLE
            </text>
          </g>
        ) : (
          <g>
            <rect width={110} height={22} rx={4} fill="rgba(239, 68, 68, 0.12)" />
            <text x={10} y={15} fill="#ef4444" fontSize={10} fontFamily="'Inter', system-ui, sans-serif" fontWeight={600}>
              DISCONNECTED
            </text>
          </g>
        )}
      </g>
    </svg>
  )
}
