import { useState, useEffect, useRef } from 'react'
import { store } from '../data/store'
import type { FeedItem, ServiceStatus } from '../data/types'

function cvssColor(score: number): string {
  if (score >= 9) return '#ef233c'
  if (score >= 7) return '#f77f00'
  if (score >= 4) return '#ffbe0b'
  return '#06d6a0'
}

function threatColor(score: number): string {
  if (score < 20) return '#3b82f6'
  if (score < 40) return '#00e5ff'
  if (score < 60) return '#ffbe0b'
  if (score < 80) return '#f77f00'
  return '#ef233c'
}

function threatLabel(score: number): string {
  if (score < 20) return 'CLEAR'
  if (score < 40) return 'ADVISORY'
  if (score < 60) return 'WATCH'
  if (score < 80) return 'WARNING'
  return 'CRITICAL'
}

function timeAgo(timestamp: string): string {
  const now = Date.now()
  const then = new Date(timestamp).getTime()
  const diffMinutes = Math.floor((now - then) / 60000)
  if (diffMinutes < 1) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return `${Math.floor(diffHours / 24)}d ago`
}

function statusLabel(indicator: string): string {
  if (indicator === 'major') return 'major outage'
  if (indicator === 'minor') return 'partial outage'
  if (indicator === 'maintenance') return 'maintenance'
  return 'degraded'
}

function HeroCard({ item, opacity }: { item: FeedItem, opacity: number }) {
  return (
    <div
      className="absolute inset-0 flex flex-col justify-center px-10"
      style={{ opacity, transition: 'opacity 0.8s ease-in-out' }}
    >
      {item.isKEV && (
        <div
          className="text-[15px] font-bold uppercase tracking-[0.25em] mb-4"
          style={{ color: '#ef233c' }}
        >
          ACTIVELY EXPLOITED IN THE WILD
        </div>
      )}

      <div className="flex items-start gap-6 mb-3">
        <div className="flex-1 min-w-0">
          <div
            className="font-bold leading-tight text-white"
            style={{ fontSize: '30px' }}
          >
            {item.title}
          </div>
        </div>
        {item.cvssScore > 0 && (
          <div className="shrink-0 text-right">
            <div
              className="font-bold leading-none tabular-nums"
              style={{ fontSize: '52px', color: cvssColor(item.cvssScore) }}
            >
              {item.cvssScore.toFixed(1)}
            </div>
            <div className="text-[14px] uppercase tracking-wider mt-1" style={{ color: '#505060' }}>
              CVSS SCORE
            </div>
          </div>
        )}
      </div>

      <div className="text-[18px] leading-relaxed mb-4" style={{ color: '#909098' }}>
        {item.description.length > 140 ? item.description.slice(0, 140) + '...' : item.description}
      </div>

      <div className="text-[14px] whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: '#606070' }}>
        <span style={{ color: '#00e5ff' }}>{item.id}</span>
        {item.vendorProject && <span> · {item.vendorProject}</span>}
        {item.timestamp && <span> · {timeAgo(item.timestamp)}</span>}
        <span> · {item.source}</span>
      </div>
    </div>
  )
}

const SERVICE_NAMES: Record<string, string> = {
  github: 'GitHub',
  cloudflare: 'Cloudflare',
  discord: 'Discord',
  openai: 'OpenAI',
  datadog: 'Datadog',
  reddit: 'Reddit',
  atlassian: 'Atlassian',
  gcp: 'GCP',
  aws: 'AWS',
}

const FEED_ITEM_HEIGHT = 40

export function DashboardScene() {
  const [tick, setTick] = useState(0)
  const [heroIndex, setHeroIndex] = useState(0)
  const [heroOpacity, setHeroOpacity] = useState(1)
  const [feedOffset, setFeedOffset] = useState(0)
  const [feedTranslateY, setFeedTranslateY] = useState(0)
  const heroTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const handle = setInterval(() => setTick(previous => previous + 1), 2000)
    return () => clearInterval(handle)
  }, [])

  useEffect(() => {
    const handle = setInterval(() => {
      setFeedTranslateY(-FEED_ITEM_HEIGHT)
      setTimeout(() => {
        setFeedOffset(previous => previous + 1)
        setFeedTranslateY(0)
      }, 500)
    }, 4000)
    return () => clearInterval(handle)
  }, [])

  useEffect(() => {
    heroTimerRef.current = setInterval(() => {
      setHeroOpacity(0)
      setTimeout(() => {
        setHeroIndex(previous => previous + 1)
        setHeroOpacity(1)
      }, 800)
    }, 10000)
    return () => {
      if (heroTimerRef.current) clearInterval(heroTimerRef.current)
    }
  }, [])

  const score = store.threatWeather
  const color = threatColor(score)

  const criticalItems = store.feedQueue.filter(item => item.cvssScore >= 9 || item.isKEV)
  const heroItems = criticalItems.length > 0 ? criticalItems : store.feedQueue
  const currentHeroItem = heroItems.length > 0
    ? heroItems[heroIndex % heroItems.length]
    : undefined

  const allFeedItems = store.feedQueue
  const feedWindowSize = 14
  const feedStart = allFeedItems.length > feedWindowSize
    ? feedOffset % Math.max(1, allFeedItems.length - feedWindowSize + 1)
    : 0
  const feedItems = allFeedItems.slice(feedStart, feedStart + feedWindowSize)

  const degradedServices: Array<{ key: string, status: ServiceStatus }> = []
  for (const key of Object.keys(SERVICE_NAMES)) {
    const status = store.serviceStatuses[key]
    if (status && status.indicator !== 'none' && status.indicator !== 'operational') {
      degradedServices.push({ key, status })
    }
  }

  const malwareFamilies = new Map<string, number>()
  for (const c2 of store.feodoC2s) {
    malwareFamilies.set(c2.malware, (malwareFamilies.get(c2.malware) ?? 0) + 1)
  }

  void tick

  return (
    <div
      className="absolute inset-0"
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      <div className="absolute top-0 bottom-0 left-0 flex flex-col overflow-hidden" style={{ width: '60%', borderRight: '1px solid #1a1a2e' }}>

        <div className="flex-1 relative overflow-hidden">
          {currentHeroItem ? (
            <HeroCard item={currentHeroItem} opacity={heroOpacity} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[20px]" style={{ color: '#303040' }}>
                MONITORING THREAT LANDSCAPE...
              </span>
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid #1a1a2e' }}>
          {degradedServices.length > 0 && (
            <div
              className="flex items-center gap-5 px-8 py-2.5"
              style={{ borderBottom: '1px solid #1a1a2e', background: 'rgba(239, 35, 60, 0.04)' }}
            >
              {degradedServices.map(({ key, status }) => (
                <div key={key} className="flex items-center gap-2 whitespace-nowrap">
                  <div className="w-2.5 h-2.5 rounded-full breathing" style={{ background: '#f77f00' }} />
                  <span className="text-[14px] font-bold" style={{ color: '#f77f00' }}>
                    {SERVICE_NAMES[key] ?? status.name}
                  </span>
                  <span className="text-[14px]" style={{ color: '#806000' }}>
                    {statusLabel(status.indicator)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-4 px-6 py-3">
            {[
              { value: Math.round(score), label: threatLabel(score), valueColor: color },
              { value: store.cvesPublishedToday, label: 'CVEs today', valueColor: '#00e5ff' },
              { value: store.kevAdditionsThisWeek, label: 'Exploited', valueColor: store.kevAdditionsThisWeek > 0 ? '#ef233c' : '#00e5ff' },
              { value: store.activeC2Count, label: 'C2 online', valueColor: '#ffbe0b' },
            ].map(stat => (
              <div key={stat.label} className="text-center">
                <div
                  className="font-bold tabular-nums stat-number"
                  style={{ fontSize: '24px', color: stat.valueColor }}
                >
                  {stat.value}
                </div>
                <div className="text-[12px] uppercase" style={{ color: '#505060' }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute top-0 bottom-0 right-0 flex flex-col overflow-hidden" style={{ left: '60%' }}>
        <div
          className="px-5 py-2.5 flex items-center justify-between shrink-0"
          style={{ borderBottom: '1px solid #1a1a2e', color: '#606070' }}
        >
          <span className="text-[14px] uppercase tracking-[0.15em]">
            Vulnerability Feed
          </span>
          <span className="text-[14px] tabular-nums" style={{ color: '#404050' }}>
            {store.feedQueue.length} today
          </span>
        </div>

        <div className="flex-1 overflow-hidden relative">
          <div
            style={{
              transform: `translateY(${feedTranslateY}px)`,
              transition: feedTranslateY !== 0 ? 'transform 0.5s ease-in-out' : 'none',
            }}
          >
            {feedItems.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center gap-3 px-5 overflow-hidden"
                style={{
                  height: `${FEED_ITEM_HEIGHT}px`,
                  borderBottom: '1px solid #0a0a12',
                  opacity: 1 - index * 0.03,
                  maxWidth: '100%',
                }}
              >
                {item.cvssScore > 0 && (
                  <span
                    className="text-[14px] font-bold px-2 py-0.5 rounded shrink-0 tabular-nums"
                    style={{ background: cvssColor(item.cvssScore), color: '#010208' }}
                  >
                    {item.cvssScore.toFixed(1)}
                  </span>
                )}
                {item.isKEV && (
                  <span className="text-[14px] font-bold px-2 py-0.5 rounded shrink-0" style={{ background: '#ef233c', color: 'white' }}>
                    KEV
                  </span>
                )}
                <span className="text-[14px] text-white truncate flex-1">
                  {item.title}
                </span>
                <span className="text-[14px] shrink-0 tabular-nums" style={{ color: '#404050' }}>
                  {item.timestamp ? timeAgo(item.timestamp) : ''}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
