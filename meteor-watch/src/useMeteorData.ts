import { useCallback, useEffect, useRef, useState } from 'react'
import type { MeteorPoint, MeteorStats, ShowerCount } from './types'
import { fetchGmnMeteors, gmnToPoint } from './api'
import { getActiveShower } from './showers'

const REFETCH_INTERVAL_MIN = 30
const REFETCH_INTERVAL_MS = REFETCH_INTERVAL_MIN * 60 * 1000
const LS_KEY = 'meteor-watch-data'
const LS_TS_KEY = 'meteor-watch-updated'

function saveToStorage(points: readonly MeteorPoint[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(points))
    localStorage.setItem(LS_TS_KEY, String(Date.now()))
  } catch {
    // Storage full or unavailable
  }
}

function loadFromStorage(): { points: MeteorPoint[], updatedAt: number } | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    const ts = localStorage.getItem(LS_TS_KEY)
    if (!raw || !ts) return null
    const points = JSON.parse(raw) as MeteorPoint[]
    return { points, updatedAt: Number(ts) }
  } catch {
    return null
  }
}

function computeStats(points: readonly MeteorPoint[], lastUpdated: number): MeteorStats {
  if (points.length === 0) {
    return {
      totalCount: 0,
      showerBreakdown: [],
      avgVelocity: 0,
      brightestMag: 0,
      activeShower: getActiveShower(),
      dataAge: '',
      lastUpdated,
      refreshIntervalMin: REFETCH_INTERVAL_MIN,
    }
  }

  const showerMap = new Map<string, number>()
  let totalVelocity = 0
  let brightestMag = 99

  for (const p of points) {
    const name = p.showerName
    showerMap.set(name, (showerMap.get(name) ?? 0) + 1)
    totalVelocity += p.velocity
    if (p.magnitude < brightestMag) brightestMag = p.magnitude
  }

  const showerBreakdown: ShowerCount[] = [...showerMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  const newest = points[0]?.timestamp ?? ''
  const oldest = points[points.length - 1]?.timestamp ?? ''
  const newestDate = new Date(newest.replace(' ', 'T') + 'Z')
  const oldestDate = new Date(oldest.replace(' ', 'T') + 'Z')
  const spanHours = Math.round((newestDate.getTime() - oldestDate.getTime()) / 3_600_000)
  const dataAge = spanHours > 24 ? `${Math.round(spanHours / 24)}d window` : `${spanHours}h window`

  return {
    totalCount: points.length,
    showerBreakdown,
    avgVelocity: Math.round(totalVelocity / points.length),
    brightestMag,
    activeShower: getActiveShower(),
    dataAge,
    lastUpdated,
    refreshIntervalMin: REFETCH_INTERVAL_MIN,
  }
}

export function useMeteorData(): {
  points: readonly MeteorPoint[]
  stats: MeteorStats
} {
  const [points, setPoints] = useState<readonly MeteorPoint[]>(() => {
    const cached = loadFromStorage()
    return cached ? cached.points : []
  })
  const [stats, setStats] = useState<MeteorStats>(() => {
    const cached = loadFromStorage()
    return computeStats(cached?.points ?? [], cached?.updatedAt ?? 0)
  })
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    const raw = await fetchGmnMeteors()
    const mapped = raw.map(gmnToPoint)
    const now = Date.now()
    setPoints(mapped)
    setStats(computeStats(mapped, now))
    saveToStorage(mapped)
  }, [])

  useEffect(() => {
    void load()
    intervalRef.current = setInterval(() => { void load() }, REFETCH_INTERVAL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [load])

  return { points, stats }
}
