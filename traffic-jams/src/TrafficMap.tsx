import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import type { CityTrafficData, CyclePhase, MetroCity, TomTomIncident } from './types'
import { magnitudeToSeverity } from './api'

interface TrafficMapProps {
  city: MetroCity
  nextCity: MetroCity
  data: CityTrafficData | null
  phase: CyclePhase
}

type GeoJSONFeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry>

const EMPTY_FC: GeoJSONFeatureCollection = {
  type: 'FeatureCollection',
  features: [],
}

function incidentsToJamGeoJson(incidents: readonly TomTomIncident[]): GeoJSONFeatureCollection {
  const features: GeoJSON.Feature<GeoJSON.LineString>[] = []

  for (const incident of incidents) {
    const { geometry, properties } = incident
    if (geometry.type !== 'LineString') continue

    const coords = geometry.coordinates as readonly (readonly [number, number])[]
    if (coords.length < 2) continue

    // Jams: iconCategory 0-5 or 7+
    if (properties.iconCategory === 6) continue

    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: coords.map((c) => [c[0], c[1]]),
      },
      properties: {
        severity: magnitudeToSeverity(properties.magnitudeOfDelay),
        delay: properties.delay,
      },
    })
  }

  return { type: 'FeatureCollection', features }
}

function incidentsToAccidentGeoJson(incidents: readonly TomTomIncident[]): GeoJSONFeatureCollection {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = []

  for (const incident of incidents) {
    const { geometry, properties } = incident
    if (properties.iconCategory !== 6) continue

    let point: [number, number]

    if (geometry.type === 'Point') {
      const coords = geometry.coordinates as readonly [number, number]
      point = [coords[0], coords[1]]
    } else if (geometry.type === 'LineString') {
      const coords = geometry.coordinates as readonly (readonly [number, number])[]
      const first = coords[0]
      if (!first) continue
      point = [first[0], first[1]]
    } else {
      continue
    }

    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: point,
      },
      properties: {
        severity: magnitudeToSeverity(properties.magnitudeOfDelay),
      },
    })
  }

  return { type: 'FeatureCollection', features }
}

export function TrafficMap({ city, data, phase }: TrafficMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const cityRef = useRef(city)
  const dataRef = useRef(data)

  cityRef.current = city
  dataRef.current = data

  // Initialize map on mount
  useEffect(() => {
    if (!containerRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [cityRef.current.center[0], cityRef.current.center[1]],
      zoom: cityRef.current.zoom,
      dragPan: false,
      dragRotate: false,
      scrollZoom: false,
      touchZoomRotate: false,
      doubleClickZoom: false,
      keyboard: false,
    })

    map.getCanvas().style.cursor = 'default'

    map.on('load', () => {
      map.addSource('traffic-jams', {
        type: 'geojson',
        data: EMPTY_FC,
      })

      map.addLayer({
        id: 'traffic-jams-layer',
        type: 'line',
        source: 'traffic-jams',
        paint: {
          'line-color': [
            'match',
            ['get', 'severity'],
            'low', '#22c55e',
            'moderate', '#eab308',
            'heavy', '#f97316',
            'severe', '#ef4444',
            '#94a3b8',
          ],
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            8, 2,
            12, 5,
          ],
          'line-opacity': 0.85,
        },
      })

      map.addSource('traffic-accidents', {
        type: 'geojson',
        data: EMPTY_FC,
      })

      map.addLayer({
        id: 'traffic-accidents-layer',
        type: 'circle',
        source: 'traffic-accidents',
        paint: {
          'circle-radius': 5,
          'circle-color': '#ef4444',
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.9,
        },
      })
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Update data when it changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return

    if (!data) {
      const jamSource = map.getSource('traffic-jams') as maplibregl.GeoJSONSource | undefined
      const accidentSource = map.getSource('traffic-accidents') as maplibregl.GeoJSONSource | undefined
      jamSource?.setData(EMPTY_FC)
      accidentSource?.setData(EMPTY_FC)
      return
    }

    const jamGeoJson = incidentsToJamGeoJson(data.incidents)
    const accidentGeoJson = incidentsToAccidentGeoJson(data.incidents)

    const jamSource = map.getSource('traffic-jams') as maplibregl.GeoJSONSource | undefined
    const accidentSource = map.getSource('traffic-accidents') as maplibregl.GeoJSONSource | undefined
    jamSource?.setData(jamGeoJson)
    accidentSource?.setData(accidentGeoJson)
  }, [data])

  // City transitions
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (phase === 'tuning') {
      // Clear stale data from previous city
      if (map.isStyleLoaded()) {
        const jamSource = map.getSource('traffic-jams') as maplibregl.GeoJSONSource | undefined
        const accidentSource = map.getSource('traffic-accidents') as maplibregl.GeoJSONSource | undefined
        jamSource?.setData(EMPTY_FC)
        accidentSource?.setData(EMPTY_FC)
      }

      map.flyTo({
        center: [city.center[0], city.center[1]],
        zoom: city.zoom,
        duration: 4000,
        curve: 1.6,
        essential: true,
      })
    }
  }, [city, phase])

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', inset: 0 }}
    />
  )
}
