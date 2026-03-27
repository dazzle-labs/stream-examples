import { useCallback, useEffect, useRef, useState } from 'react'
import { createFirehose } from './firehose'
import type { ParsedEvent, FirehoseStats } from './firehose'
import { StreamZone } from './StreamZone'
import { TrendingZone } from './TrendingZone'
import { DashboardZone } from './DashboardZone'

const EMPTY_STATS: FirehoseStats = {
  eventsPerSecond: 0,
  totalEvents: 0,
  postCount: 0,
  replyCount: 0,
  repostCount: 0,
  likeCount: 0,
  followCount: 0,
  sparkline: new Array(60).fill(0) as number[],
  languageCounts: new Map(),
  hashtagCounts: new Map(),
  recentPosts: [],
  connected: false,
  uptimeSeconds: 0,
}

export function BlueskyPulse() {
  const [stats, setStats] = useState<FirehoseStats>(EMPTY_STATS)
  const streamRef = useRef<{ addEvent: (event: ParsedEvent) => void }>(null)
  const trendingRef = useRef<{ addEvent: (event: ParsedEvent) => void }>(null)

  const handleEvent = useCallback((event: ParsedEvent) => {
    streamRef.current?.addEvent(event)
    trendingRef.current?.addEvent(event)
  }, [])

  // Throttle React state updates — firehose emits every 250ms but we only
  // need to re-render the dashboard at 500ms. The canvas zones read stats
  // via refs so they're unaffected by this throttle.
  const lastStatsUpdateRef = useRef(0)
  const handleStats = useCallback((newStats: FirehoseStats) => {
    const now = performance.now()
    if (now - lastStatsUpdateRef.current >= 500) {
      lastStatsUpdateRef.current = now
      setStats(newStats)
    }
  }, [])

  useEffect(() => {
    const firehose = createFirehose(handleEvent, handleStats)
    return () => firehose.destroy()
  }, [handleEvent, handleStats])

  return (
    <div
      className="flex w-screen h-screen overflow-hidden relative"
      style={{ background: '#06080c' }}
    >
      {/* Subtle vignette overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)',
          zIndex: 50,
        }}
      />

      {/* Left zone: The Stream */}
      <div className="relative w-[350px] h-full flex-shrink-0">
        <StreamZone ref={streamRef} stats={stats} />
      </div>

      {/* Subtle divider */}
      <div
        className="w-px h-full flex-shrink-0"
        style={{ background: 'linear-gradient(to bottom, transparent, rgba(0,133,255,0.15) 30%, rgba(0,133,255,0.15) 70%, transparent)' }}
      />

      {/* Center zone: Trending Gravity */}
      <div className="relative flex-1 h-full min-w-0">
        <TrendingZone ref={trendingRef} stats={stats} />
      </div>

      {/* Subtle divider */}
      <div
        className="w-px h-full flex-shrink-0"
        style={{ background: 'linear-gradient(to bottom, transparent, rgba(0,133,255,0.15) 30%, rgba(0,133,255,0.15) 70%, transparent)' }}
      />

      {/* Right zone: The Dashboard */}
      <div
        className="relative w-[360px] h-full flex-shrink-0 overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(10, 14, 20, 0.8) 0%, rgba(6, 8, 12, 0.95) 100%)',
        }}
      >
        <DashboardZone stats={stats} />
      </div>
    </div>
  )
}
