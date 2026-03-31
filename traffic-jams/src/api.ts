import type {
  CityTrafficData,
  MetroCity,
  Severity,
  TomTomIncident,
  TomTomResponse,
} from './types'

const API_KEY: string = import.meta.env.VITE_TOMTOM_API_KEY

const BASE_URL = 'https://api.tomtom.com/traffic/services/5/incidentDetails'

export function magnitudeToSeverity(magnitude: number): Severity {
  if (magnitude <= 0) return 'low'
  if (magnitude === 1) return 'moderate'
  if (magnitude === 2) return 'heavy'
  return 'severe'
}

export async function fetchTrafficData(city: MetroCity): Promise<CityTrafficData> {
  const { bbox } = city
  const bboxParam = `${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}`

  const params = new URLSearchParams({
    key: API_KEY,
    bbox: bboxParam,
    fields: '{incidents{type,geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,events{description},from,to,length,delay}}}',
    categoryFilter: 'Jam,Accident',
    timeValidityFilter: 'present',
  })

  const url = `${BASE_URL}?${params.toString()}`

  const response = await fetch(url, {
    signal: AbortSignal.timeout(8000),
  })

  if (!response.ok) {
    throw new Error(`TomTom API error: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as TomTomResponse
  const incidents: readonly TomTomIncident[] = data.incidents ?? []

  let jamCount = 0
  let accidentCount = 0
  let worstDelaySeconds = 0
  let totalDelaySeconds = 0
  const severityCounts = { low: 0, moderate: 0, heavy: 0, severe: 0 }

  for (const incident of incidents) {
    const { iconCategory, magnitudeOfDelay, delay } = incident.properties

    // iconCategory 6 = Accident, 1-5 and 7+ are various jam/road types
    if (iconCategory === 6) {
      accidentCount++
    } else {
      jamCount++
    }

    if (delay > worstDelaySeconds) {
      worstDelaySeconds = delay
    }
    totalDelaySeconds += delay

    const severity = magnitudeToSeverity(magnitudeOfDelay)
    severityCounts[severity]++
  }

  return {
    city,
    incidents,
    fetchedAt: Date.now(),
    jamCount,
    accidentCount,
    worstDelaySeconds,
    totalDelayMinutes: Math.round(totalDelaySeconds / 60),
    severityCounts,
  }
}
