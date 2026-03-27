import React, { useEffect, useRef, useState } from 'react'
import type { FirehoseStats, ParsedEvent } from './firehose'

const LANGUAGE_COLORS: Record<string, string> = {
  en: '#4a9eff',
  ja: '#ff6b9d',
  pt: '#4ade80',
  es: '#fbbf24',
  de: '#e2e8f0',
  other: '#a78bfa',
}

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  ja: 'Japanese',
  pt: 'Portuguese',
  es: 'Spanish',
  de: 'German',
  other: 'Other',
}

function Sparkline({ data, width, height }: { data: number[]; width: number; height: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = width * 2
    canvas.height = height * 2
    ctx.scale(2, 2)

    ctx.clearRect(0, 0, width, height)

    const max = Math.max(1, ...data)
    const stepX = width / (data.length - 1 || 1)

    // Fill gradient
    const fillGrad = ctx.createLinearGradient(0, 0, 0, height)
    fillGrad.addColorStop(0, 'rgba(0, 133, 255, 0.15)')
    fillGrad.addColorStop(1, 'rgba(0, 133, 255, 0.0)')

    ctx.beginPath()
    ctx.moveTo(0, height)
    for (let i = 0; i < data.length; i++) {
      const val = data[i] ?? 0
      const x = i * stepX
      const y = height - (val / max) * (height - 4) - 2
      if (i === 0) {
        ctx.lineTo(x, y)
      } else {
        // Smooth curve
        const prevVal = data[i - 1] ?? 0
        const prevX = (i - 1) * stepX
        const prevY = height - (prevVal / max) * (height - 4) - 2
        const cpx = (prevX + x) / 2
        ctx.bezierCurveTo(cpx, prevY, cpx, y, x, y)
      }
    }
    ctx.lineTo(width, height)
    ctx.closePath()
    ctx.fillStyle = fillGrad
    ctx.fill()

    // Stroke line
    ctx.beginPath()
    for (let i = 0; i < data.length; i++) {
      const val = data[i] ?? 0
      const x = i * stepX
      const y = height - (val / max) * (height - 4) - 2
      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        const prevVal = data[i - 1] ?? 0
        const prevX = (i - 1) * stepX
        const prevY = height - (prevVal / max) * (height - 4) - 2
        const cpx = (prevX + x) / 2
        ctx.bezierCurveTo(cpx, prevY, cpx, y, x, y)
      }
    }
    ctx.strokeStyle = '#0085ff'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Glow on the line tip
    const lastVal = data[data.length - 1] ?? 0
    const lastX = (data.length - 1) * stepX
    const lastY = height - (lastVal / max) * (height - 4) - 2
    const tipGlow = ctx.createRadialGradient(lastX, lastY, 0, lastX, lastY, 6)
    tipGlow.addColorStop(0, 'rgba(0, 133, 255, 0.6)')
    tipGlow.addColorStop(1, 'transparent')
    ctx.fillStyle = tipGlow
    ctx.fillRect(lastX - 6, lastY - 6, 12, 12)

    ctx.beginPath()
    ctx.arc(lastX, lastY, 2, 0, Math.PI * 2)
    ctx.fillStyle = '#0085ff'
    ctx.fill()
  }, [data, width, height])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: `${width}px`, height: `${height}px` }}
    />
  )
}

function ActivityBar({ stats }: { stats: FirehoseStats }) {
  const total = stats.postCount + stats.replyCount + stats.repostCount + stats.likeCount
  if (total === 0) return <div className="h-3 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }} />

  const segments = [
    { label: 'Posts', count: stats.postCount, color: '#4a9eff' },
    { label: 'Replies', count: stats.replyCount, color: '#6b9dff' },
    { label: 'Reposts', count: stats.repostCount, color: '#a78bfa' },
    { label: 'Likes', count: stats.likeCount, color: '#ff6b9d' },
  ]

  return (
    <div>
      <div className="flex h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
        {segments.map((seg) => (
          <div
            key={seg.label}
            style={{
              width: `${(seg.count / total) * 100}%`,
              backgroundColor: seg.color,
              opacity: 0.7,
              transition: 'width 0.5s ease',
            }}
          />
        ))}
      </div>
      <div className="flex justify-between" style={{ marginTop: '8px' }}>
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: seg.color, opacity: 0.7 }} />
            <span className="font-mono text-[9px]" style={{ color: '#6b7a8d' }}>
              {seg.label} {total > 0 ? Math.round((seg.count / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function LanguageBars({ languageCounts }: { languageCounts: Map<string, number> }) {
  const total = [...languageCounts.values()].reduce((a, b) => a + b, 0)
  if (total === 0) {
    return (
      <div className="text-[10px] font-mono" style={{ color: '#3a4656' }}>
        Awaiting data...
      </div>
    )
  }

  const sorted = [...languageCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  return (
    <div className="flex flex-col" style={{ gap: '4px' }}>
      {sorted.map(([lang, count]) => {
        const pct = (count / total) * 100
        const color = LANGUAGE_COLORS[lang] ?? LANGUAGE_COLORS['other'] ?? '#a78bfa'
        const label = LANGUAGE_LABELS[lang] ?? lang
        return (
          <div key={lang} className="flex items-center gap-2 pr-2 overflow-hidden">
            <span className="font-mono text-[9px] w-[52px] text-right flex-shrink-0" style={{ color: '#6b7a8d' }}>
              {label}
            </span>
            <div className="flex-1 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(2, pct)}%`,
                  backgroundColor: color,
                  opacity: 0.65,
                  transition: 'width 0.5s ease',
                }}
              />
            </div>
            <span className="font-mono text-[9px] w-[34px] text-right flex-shrink-0" style={{ color: '#6b7a8d' }}>
              {pct.toFixed(0)}%
            </span>
          </div>
        )
      })}
    </div>
  )
}

interface FeedPost {
  id: string
  event: ParsedEvent
  age: number // 0 = newest, increments as posts push down
}

const MAX_FEED_POSTS = 6
const FEED_INTERVAL_MS = 2500

function truncateText(text: string, max: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return trimmed.slice(0, max - 3) + '...'
}

function LiveFeed({ posts, trendingTag }: { posts: ParsedEvent[]; trendingTag: string | undefined }) {
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([])
  const nextIdRef = useRef(0)
  const lastPickedIndexRef = useRef(-1)
  const postsRef = useRef<ParsedEvent[]>(posts)
  const trendingTagRef = useRef<string | undefined>(trendingTag)

  // Keep refs in sync with latest props without restarting the interval
  useEffect(() => {
    postsRef.current = posts
  }, [posts])

  useEffect(() => {
    trendingTagRef.current = trendingTag
    // Clear feed when trending topic changes so stale posts don't linger
    setFeedPosts([])
    lastPickedIndexRef.current = -1
  }, [trendingTag])

  useEffect(() => {
    const interval = setInterval(() => {
      const currentPosts = postsRef.current
      if (currentPosts.length === 0) return

      const currentTag = trendingTagRef.current

      // ONLY show posts matching the current top trending hashtag
      // Check both hashtags array AND post text (case-insensitive)
      const tagLower = currentTag?.toLowerCase()
      if (!tagLower) return

      const pool = currentPosts.filter(
        (p) => p.text.length > 15 && (
          p.hashtags.some((h) => h.toLowerCase() === tagLower) ||
          p.text.toLowerCase().includes(tagLower)
        ),
      )

      if (pool.length === 0) return

      // Cycle through available posts
      lastPickedIndexRef.current = (lastPickedIndexRef.current + 1) % pool.length
      const picked = pool[lastPickedIndexRef.current]
      if (!picked) return

      const newId = `feed-${nextIdRef.current++}`

      setFeedPosts((prev) => {
        // Age all existing posts, add new one at age 0
        const aged = prev.map((p) => ({ ...p, age: p.age + 1 }))
        const updated: FeedPost[] = [{ id: newId, event: picked, age: 0 }, ...aged]
        // Keep only the max visible
        return updated.slice(0, MAX_FEED_POSTS)
      })
    }, FEED_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [])

  if (feedPosts.length === 0) {
    return (
      <div className="text-[10px] font-mono" style={{ color: '#3a4656' }}>
        Listening for posts...
      </div>
    )
  }

  return (
    <div
      className="flex flex-col gap-3 overflow-hidden"
      style={{ flex: 1 }}
    >
      {feedPosts.map((post) => {
        const langColor = LANGUAGE_COLORS[post.event.language] ?? LANGUAGE_COLORS['other'] ?? '#a78bfa'
        const langLabel = LANGUAGE_LABELS[post.event.language] ?? post.event.language
        const displayText = truncateText(post.event.text, 120)
        const isNewest = post.age === 0

        // Staggered opacity: newest fully opaque, oldest fades out
        const baseOpacity = Math.max(0.2, 1 - post.age * 0.15)

        return (
          <div
            key={post.id}
            style={{
              opacity: baseOpacity,
              transform: isNewest ? 'translateY(0) scale(1)' : 'translateY(0) scale(1)',
              transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
              animation: isNewest ? 'feed-slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1)' : undefined,
            }}
          >
            <div
              className="rounded-lg overflow-hidden"
              style={{
                padding: '7px 10px',
                background: isNewest
                  ? 'rgba(0, 133, 255, 0.12)'
                  : 'rgba(255, 255, 255, 0.06)',
                border: isNewest
                  ? '1px solid rgba(0, 133, 255, 0.30)'
                  : '1px solid rgba(255, 255, 255, 0.10)',
                boxShadow: isNewest
                  ? '0 0 12px rgba(0, 133, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.06)'
                  : 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
              }}
            >
              <div className="flex items-center gap-1.5 mb-2 overflow-hidden">
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: langColor,
                    boxShadow: isNewest ? `0 0 6px ${langColor}` : 'none',
                  }}
                />
                <span className="font-mono text-[8px] truncate" style={{ color: '#6b7a8d' }}>
                  {langLabel}
                  {post.event.hashtags.length > 0 && ` \u00b7 #${post.event.hashtags[0]}`}
                </span>
              </div>
              <p
                className="font-display text-[13px] leading-[1.4] overflow-hidden line-clamp-2"
                style={{
                  color: isNewest ? 'rgba(232, 236, 242, 0.9)' : 'rgba(232, 236, 242, 0.65)',
                }}
              >
                {displayText}
              </p>
            </div>
          </div>
        )
      })}

      <style>{`
        @keyframes feed-slide-in {
          0% {
            opacity: 0;
            transform: translateY(-16px) scale(0.95);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  )
}

export function DashboardZone({ stats }: { stats: FirehoseStats }) {
  // Get top trending hashtag
  const topTrending = [...stats.hashtagCounts.entries()]
    .sort((a, b) => b[1] - a[1])

  const topTag = topTrending[0]

  // Shared section label style — industrial data dashboard aesthetic
  const sectionLabelStyle: React.CSSProperties = {
    color: '#6b7a8d',
    fontSize: '11px',
    letterSpacing: '0.08em',
    marginBottom: '8px',
  }

  // Shared divider style — thin rule between major sections
  const dividerStyle: React.CSSProperties = {
    height: '1px',
    background: 'rgba(255, 255, 255, 0.06)',
    marginTop: '12px',
    marginBottom: '12px',
  }

  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      style={{ padding: '24px 22px' }}
    >
      {/* Title */}
      <div className="flex items-center justify-between" style={{ marginBottom: '18px' }}>
        <h1 className="font-display text-[22px] font-bold tracking-tight" style={{ color: '#e8ecf2' }}>
          BLUESKY PULSE
        </h1>
        <div className="flex items-center gap-1.5 flex-shrink-0 mr-2">
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{
              backgroundColor: stats.connected ? '#4ade80' : '#ef4444',
              boxShadow: stats.connected
                ? '0 0 8px rgba(74, 222, 128, 0.5)'
                : '0 0 8px rgba(239, 68, 68, 0.5)',
              animation: stats.connected ? 'pulse-glow 2s ease-in-out infinite' : 'none',
            }}
          />
          <span className="font-mono text-[9px] font-medium" style={{ color: stats.connected ? '#4ade80' : '#ef4444' }}>
            {stats.connected ? 'LIVE' : 'CONNECTING'}
          </span>
        </div>
      </div>

      {/* Thin separator after title */}
      <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', marginBottom: '20px' }} />

      {/* Events per second - hero number */}
      <div style={{ marginBottom: '8px' }}>
        <div className="font-mono font-medium" style={{ ...sectionLabelStyle, marginBottom: '6px' }}>
          EVENTS / SECOND
        </div>
        <div className="flex items-end gap-3">
          <span
            className="font-mono text-[44px] font-bold leading-none tracking-tighter"
            style={{ color: '#0085ff' }}
          >
            {stats.eventsPerSecond}
          </span>
          <span className="font-mono text-[11px]" style={{ color: '#3a4656', marginBottom: '4px' }}>
            evt/s
          </span>
        </div>
      </div>

      {/* Sparkline — generous bottom margin for hero section breathing room */}
      <div className="overflow-hidden" style={{ marginBottom: '16px' }}>
        <Sparkline data={stats.sparkline} width={300} height={40} />
        <div className="flex justify-between" style={{ marginTop: '3px' }}>
          <span className="font-mono text-[8px]" style={{ color: '#3a4656' }}>60s ago</span>
          <span className="font-mono text-[8px]" style={{ color: '#3a4656' }}>now</span>
        </div>
      </div>

      {/* Divider: sparkline -> activity */}
      <div style={dividerStyle} />

      {/* Activity breakdown */}
      <div style={{ marginBottom: '4px' }}>
        <div className="font-mono font-medium" style={sectionLabelStyle}>
          ACTIVITY
        </div>
        <ActivityBar stats={stats} />
      </div>

      {/* Divider: activity -> languages */}
      <div style={dividerStyle} />

      {/* Language distribution */}
      <div style={{ marginBottom: '4px' }}>
        <div className="font-mono font-medium" style={sectionLabelStyle}>
          LANGUAGES
        </div>
        <LanguageBars languageCounts={stats.languageCounts} />
      </div>

      {/* Divider: languages -> top trending */}
      <div style={dividerStyle} />

      {/* Top trending */}
      <div style={{ marginBottom: '4px' }}>
        <div className="font-mono font-medium" style={sectionLabelStyle}>
          TOP TRENDING
        </div>
        {topTag ? (
          <div className="flex items-baseline gap-2 overflow-hidden">
            <span className="font-display text-[22px] font-bold truncate" style={{ color: '#0085ff' }}>
              #{topTag[0]}
            </span>
            <span className="font-mono text-[11px]" style={{ color: '#6b7a8d' }}>
              {topTag[1]} mentions
            </span>
          </div>
        ) : (
          <span className="font-mono text-[11px]" style={{ color: '#3a4656' }}>
            Discovering...
          </span>
        )}
      </div>

      {/* Live feed — fills remaining vertical space, contextually related to top trending */}
      <div className="flex flex-col" style={{ flex: 1, minHeight: 0, marginTop: '12px' }}>
        <LiveFeed posts={stats.recentPosts} trendingTag={topTag?.[0]} />
      </div>

    </div>
  )
}
