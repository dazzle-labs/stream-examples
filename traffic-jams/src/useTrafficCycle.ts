import { useCallback, useEffect, useRef, useState } from 'react'
import type { CityTrafficData, CyclePhase, MetroCity, NationalSummary } from './types'
import { CITIES } from './cities'
import { fetchTrafficData } from './api'

const PHASE_DURATIONS: Record<CyclePhase, number> = {
  tuning: 2000,
  arriving: 3000,
  holding: 25000,
  departing: 2000,
}

const PHASE_ORDER: readonly CyclePhase[] = ['tuning', 'arriving', 'holding', 'departing']

const CACHE_MAX_AGE_MS = 10 * 60 * 1000

interface CacheEntry {
  data: CityTrafficData
  timestamp: number
}

function computeNationalSummary(cache: Map<number, CacheEntry>): NationalSummary {
  let totalJams = 0
  let totalAccidents = 0
  let totalDelay = 0
  let citiesScanned = 0

  for (const entry of cache.values()) {
    totalJams += entry.data.jamCount
    totalAccidents += entry.data.accidentCount
    totalDelay += entry.data.worstDelaySeconds
    citiesScanned++
  }

  return {
    totalJams,
    totalAccidents,
    citiesScanned,
    avgDelaySeconds: citiesScanned > 0 ? Math.round(totalDelay / citiesScanned) : 0,
  }
}

export function useTrafficCycle(): {
  currentCity: MetroCity
  nextCity: MetroCity
  currentData: CityTrafficData | null
  phase: CyclePhase
  nationalSummary: NationalSummary
} {
  const [currentCityIndex, setCurrentCityIndex] = useState(0)
  const [phase, setPhase] = useState<CyclePhase>('tuning')
  const [currentData, setCurrentData] = useState<CityTrafficData | null>(null)
  const [nationalSummary, setNationalSummary] = useState<NationalSummary>({
    totalJams: 0,
    totalAccidents: 0,
    citiesScanned: 0,
    avgDelaySeconds: 0,
  })

  const cacheRef = useRef<Map<number, CacheEntry>>(new Map())
  const abortRef = useRef<AbortController | null>(null)

  const nextCityIndex = (currentCityIndex + 1) % CITIES.length
  // CITIES is a fixed 12-element array and indices are always mod CITIES.length
  const currentCity = CITIES[currentCityIndex] ?? CITIES[0]!
  const nextCity = CITIES[nextCityIndex] ?? CITIES[0]!

  const isCacheValid = useCallback((cityIndex: number): boolean => {
    const entry = cacheRef.current.get(cityIndex)
    if (!entry) return false
    return Date.now() - entry.timestamp < CACHE_MAX_AGE_MS
  }, [])

  const fetchAndCache = useCallback(async (cityIndex: number): Promise<CityTrafficData | null> => {
    if (abortRef.current) {
      abortRef.current.abort()
    }
    abortRef.current = new AbortController()

    try {
      const city = CITIES[cityIndex]
      if (!city) return null
      const data = await fetchTrafficData(city)
      const entry: CacheEntry = { data, timestamp: Date.now() }
      cacheRef.current.set(cityIndex, entry)
      setNationalSummary(computeNationalSummary(cacheRef.current))
      return data
    } catch {
      const cached = cacheRef.current.get(cityIndex)
      if (cached) {
        return cached.data
      }
      return null
    }
  }, [])

  // Fetch data when entering tuning phase for a new city
  useEffect(() => {
    if (phase !== 'tuning') return

    let cancelled = false

    const load = async () => {
      if (isCacheValid(currentCityIndex)) {
        const cached = cacheRef.current.get(currentCityIndex)
        if (cached && !cancelled) {
          setCurrentData(cached.data)
        }
      } else {
        const data = await fetchAndCache(currentCityIndex)
        if (!cancelled) {
          setCurrentData(data)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [phase, currentCityIndex, isCacheValid, fetchAndCache])

  // Prefetch next city when entering holding phase
  useEffect(() => {
    if (phase !== 'holding') return

    if (!isCacheValid(nextCityIndex)) {
      void fetchAndCache(nextCityIndex)
    }
  }, [phase, nextCityIndex, isCacheValid, fetchAndCache])

  // Phase transition timer
  useEffect(() => {
    const duration = PHASE_DURATIONS[phase]

    const timer = setTimeout(() => {
      const currentPhaseIdx = PHASE_ORDER.indexOf(phase)

      const nextPhase = PHASE_ORDER[currentPhaseIdx + 1]
      if (nextPhase) {
        setPhase(nextPhase)
      } else {
        // After departing, advance to next city and reset to tuning
        setCurrentCityIndex((prev) => (prev + 1) % CITIES.length)
        setPhase('tuning')
      }
    }, duration)

    return () => {
      clearTimeout(timer)
    }
  }, [phase, currentCityIndex])

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort()
      }
    }
  }, [])

  return {
    currentCity,
    nextCity,
    currentData,
    phase,
    nationalSummary,
  }
}
