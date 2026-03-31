export interface MetroCity {
  readonly name: string
  readonly state: string
  readonly center: readonly [number, number]
  readonly zoom: number
  readonly bbox: {
    readonly minLon: number
    readonly minLat: number
    readonly maxLon: number
    readonly maxLat: number
  }
  readonly timezone: string
}

export interface TomTomIncidentGeometry {
  readonly type: 'LineString' | 'Point' | 'MultiPoint'
  readonly coordinates: readonly (readonly [number, number])[] | readonly [number, number]
}

export interface TomTomIncidentEvent {
  readonly description: string
  readonly code: number
}

export interface TomTomIncidentProperties {
  readonly iconCategory: number
  readonly magnitudeOfDelay: number
  readonly events: readonly TomTomIncidentEvent[]
  readonly from: string
  readonly to: string
  readonly length: number
  readonly delay: number
}

export interface TomTomIncident {
  readonly type: string
  readonly geometry: TomTomIncidentGeometry
  readonly properties: TomTomIncidentProperties
}

export interface TomTomResponse {
  readonly incidents: readonly TomTomIncident[]
}

export type Severity = 'low' | 'moderate' | 'heavy' | 'severe'

export interface CityTrafficData {
  readonly city: MetroCity
  readonly incidents: readonly TomTomIncident[]
  readonly fetchedAt: number
  readonly jamCount: number
  readonly accidentCount: number
  readonly worstDelaySeconds: number
  readonly totalDelayMinutes: number
  readonly severityCounts: {
    readonly low: number
    readonly moderate: number
    readonly heavy: number
    readonly severe: number
  }
}

export type CyclePhase = 'tuning' | 'arriving' | 'holding' | 'departing'

export interface NationalSummary {
  readonly totalJams: number
  readonly totalAccidents: number
  readonly citiesScanned: number
  readonly avgDelaySeconds: number
}
