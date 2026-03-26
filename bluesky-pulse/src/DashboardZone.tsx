import { useEffect, useRef, useState } from 'react'
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

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
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
      <div className="flex justify-between mt-1.5">
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
    <div className="flex flex-col gap-1.5">
      {sorted.map(([lang, count]) => {
        const pct = (count / total) * 100
        const color = LANGUAGE_COLORS[lang] ?? LANGUAGE_COLORS['other'] ?? '#a78bfa'
        const label = LANGUAGE_LABELS[lang] ?? lang
        return (
          <div key={lang} className="flex items-center gap-2">
            <span className="font-mono text-[9px] w-[52px] text-right" style={{ color: '#6b7a8d' }}>
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
            <span className="font-mono text-[9px] w-[30px]" style={{ color: '#6b7a8d' }}>
              {pct.toFixed(0)}%
            </span>
          </div>
        )
      })}
    </div>
  )
}

function FeaturedPost({ posts }: { posts: ParsedEvent[] }) {
  const [currentPost, setCurrentPost] = useState<ParsedEvent | null>(null)
  const [opacity, setOpacity] = useState(0)
  const indexRef = useRef(0)

  useEffect(() => {
    if (posts.length === 0) return

    const interval = setInterval(() => {
      // Fade out
      setOpacity(0)

      setTimeout(() => {
        // Pick an interesting post
        const interestingPosts = posts.filter(
          (p) => p.text.length > 40 && (p.hashtags.length > 0 || p.language === 'en'),
        )
        const pool = interestingPosts.length > 0 ? interestingPosts : posts
        const idx = indexRef.current % pool.length
        const post = pool[idx]
        if (post) {
          setCurrentPost(post)
        }
        indexRef.current++
        setOpacity(1)
      }, 400)
    }, 8000)

    // Show first post immediately
    if (!currentPost && posts.length > 0) {
      const first = posts[posts.length - 1]
      if (first) {
        setCurrentPost(first)
        setOpacity(1)
      }
    }

    return () => clearInterval(interval)
  }, [posts, currentPost])

  if (!currentPost) {
    return (
      <div className="text-[10px] font-mono" style={{ color: '#3a4656' }}>
        Listening...
      </div>
    )
  }

  const langColor = LANGUAGE_COLORS[currentPost.language] ?? LANGUAGE_COLORS['other'] ?? '#a78bfa'
  let displayText = currentPost.text.trim()
  if (displayText.length > 140) {
    displayText = displayText.slice(0, 137) + '...'
  }

  return (
    <div
      className="transition-opacity duration-400"
      style={{ opacity }}
    >
      <div
        className="rounded-lg p-3"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: langColor }} />
          <span className="font-mono text-[9px]" style={{ color: '#6b7a8d' }}>
            {LANGUAGE_LABELS[currentPost.language] ?? currentPost.language}
            {currentPost.hashtags.length > 0 && ` \u00b7 #${currentPost.hashtags[0]}`}
          </span>
        </div>
        <p className="font-display text-[12px] leading-[1.5]" style={{ color: 'rgba(232, 236, 242, 0.8)' }}>
          {displayText}
        </p>
      </div>
    </div>
  )
}

export function DashboardZone({ stats }: { stats: FirehoseStats }) {
  // Get top trending hashtag
  const topTrending = [...stats.hashtagCounts.entries()]
    .sort((a, b) => b[1] - a[1])

  const topTag = topTrending[0]

  return (
    <div className="h-full flex flex-col px-5 py-5 overflow-hidden">
      {/* Title */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-[22px] font-bold tracking-tight" style={{ color: '#e8ecf2' }}>
          BLUESKY PULSE
        </h1>
        <div className="flex items-center gap-1.5 flex-shrink-0">
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

      {/* Thin separator */}
      <div className="h-px mb-4" style={{ background: 'rgba(255,255,255,0.06)' }} />

      {/* Events per second - hero number */}
      <div className="mb-3">
        <div className="font-mono text-[10px] font-medium mb-1" style={{ color: '#6b7a8d' }}>
          EVENTS / SECOND
        </div>
        <div className="flex items-end gap-3">
          <span
            className="font-mono text-[44px] font-bold leading-none tracking-tighter"
            style={{ color: '#0085ff' }}
          >
            {stats.eventsPerSecond}
          </span>
          <span className="font-mono text-[11px] mb-1" style={{ color: '#3a4656' }}>
            evt/s
          </span>
        </div>
      </div>

      {/* Sparkline */}
      <div className="mb-4">
        <Sparkline data={stats.sparkline} width={350} height={40} />
        <div className="flex justify-between mt-0.5">
          <span className="font-mono text-[8px]" style={{ color: '#3a4656' }}>60s ago</span>
          <span className="font-mono text-[8px]" style={{ color: '#3a4656' }}>now</span>
        </div>
      </div>

      {/* Activity breakdown */}
      <div className="mb-4">
        <div className="font-mono text-[10px] font-medium mb-2" style={{ color: '#6b7a8d' }}>
          ACTIVITY
        </div>
        <ActivityBar stats={stats} />
      </div>

      {/* Language distribution */}
      <div className="mb-4">
        <div className="font-mono text-[10px] font-medium mb-2" style={{ color: '#6b7a8d' }}>
          LANGUAGES
        </div>
        <LanguageBars languageCounts={stats.languageCounts} />
      </div>

      {/* Top trending */}
      <div className="mb-4">
        <div className="font-mono text-[10px] font-medium mb-1.5" style={{ color: '#6b7a8d' }}>
          TOP TRENDING
        </div>
        {topTag ? (
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[20px] font-bold" style={{ color: '#0085ff' }}>
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

      {/* Featured post */}
      <div className="mb-4 flex-1 min-h-0">
        <div className="font-mono text-[10px] font-medium mb-2" style={{ color: '#6b7a8d' }}>
          SAMPLE POST
        </div>
        <FeaturedPost posts={stats.recentPosts} />
      </div>

      {/* Connection stats footer */}
      <div className="mt-auto pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex justify-between">
          <span className="font-mono text-[9px]" style={{ color: '#3a4656' }}>
            {formatNumber(stats.totalEvents)} events processed
          </span>
          <span className="font-mono text-[9px]" style={{ color: '#3a4656' }}>
            uptime {formatUptime(stats.uptimeSeconds)}
          </span>
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="font-mono text-[9px]" style={{ color: '#3a4656' }}>
            ~{(stats.eventsPerSecond * 0.5).toFixed(0)} KB/s
          </span>
          <span className="font-mono text-[9px]" style={{ color: '#3a4656' }}>
            {formatNumber(stats.postCount + stats.replyCount)} posts
          </span>
        </div>
      </div>
    </div>
  )
}
