import { useCallback, useEffect, useRef, useState } from 'react'
import type { MeteorPoint, MeteorStats, ShowerCount } from './types'
import { fetchGmnMeteors, gmnToPoint } from './api'
import { getActiveShower } from './showers'

const REFETCH_INTERVAL = 30 * 60 * 1000

function computeStats(points: readonly MeteorPoint[]): MeteorStats {
  if (points.length === 0) {
    return {
      totalCount: 0,
      showerBreakdown: [],
      avgVelocity: 0,
      brightestMag: 0,
      activeShower: getActiveShower(),
      dataAge: '',
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

  // Compute data age from oldest/newest timestamps
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
  }
}

export function useMeteorData(): {
  points: readonly MeteorPoint[]
  stats: MeteorStats
} {
  const [points, setPoints] = useState<readonly MeteorPoint[]>([])
  const [stats, setStats] = useState<MeteorStats>(() => computeStats([]))
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    const raw = await fetchGmnMeteors()
    const mapped = raw.map(gmnToPoint)
    setPoints(mapped)
    setStats(computeStats(mapped))
  }, [])

  useEffect(() => {
    void load()
    intervalRef.current = setInterval(() => { void load() }, REFETCH_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [load])

  return { points, stats }
}
