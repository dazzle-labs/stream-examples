import { useState, useEffect, useRef, useCallback } from 'react'
import { TransitDay, NORMAL_DAILY_TRANSITS } from '../types'

const ARCGIS_URL = 'https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/Daily_Chokepoints_Data/FeatureServer/0/query?where=portid%3D%27chokepoint6%27&outFields=date,n_total,n_tanker,n_container,n_dry_bulk,n_general_cargo,n_roro,capacity&orderByFields=date+DESC&resultRecordCount=90&f=json'

const SIX_HOURS = 6 * 60 * 60 * 1000

interface ArcGISFeature {
  attributes: {
    date: number
    n_total: number
    n_tanker: number
    n_container: number
    n_dry_bulk: number
    n_general_cargo: number
    n_roro: number
    capacity: number
  }
}

interface ArcGISResponse {
  features?: ArcGISFeature[]
}

function parseFeatures(features: ArcGISFeature[]): TransitDay[] {
  return features.map(feature => {
    const attributes = feature.attributes
    const dateObject = new Date(attributes.date)
    const dateString = dateObject.toISOString().slice(0, 10)

    return {
      date: dateString,
      total: attributes.n_total ?? 0,
      tanker: attributes.n_tanker ?? 0,
      container: attributes.n_container ?? 0,
      dryBulk: attributes.n_dry_bulk ?? 0,
      generalCargo: attributes.n_general_cargo ?? 0,
      roro: attributes.n_roro ?? 0,
      capacityTons: attributes.capacity ?? 0,
    }
  }).reverse()
}

export function useTransitData(): {
  days: TransitDay[]
  latest: TransitDay | null
  normalAverage: number
  loading: boolean
} {
  const [days, setDays] = useState<TransitDay[]>([])
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchTransitData = useCallback(async () => {
    try {
      const response = await fetch(ARCGIS_URL)
      if (!response.ok) return

      const data: ArcGISResponse = await response.json()
      if (!data.features || data.features.length === 0) return

      const parsed = parseFeatures(data.features)
      if (parsed.length > 0) {
        setDays(parsed)
      }
    } catch {
      // Keep existing data on failure
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTransitData()
    intervalRef.current = setInterval(fetchTransitData, SIX_HOURS)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [fetchTransitData])

  const latest = days.length > 0 ? days[days.length - 1] : null

  return {
    days,
    latest,
    normalAverage: NORMAL_DAILY_TRANSITS,
    loading,
  }
}
