import type { SocialPost } from '../types'

const SOURCE_CONFIG: Record<string, { label: string; color: string }> = {
  hn: { label: 'HN', color: '#ff6600' },
  bluesky: { label: 'BSKY', color: '#0085ff' },
  mastodon: { label: 'MSTDN', color: '#6364ff' },
  reddit: { label: 'RDDT', color: '#ff4500' },
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h`
}

interface SocialFeedProps {
  posts: SocialPost[]
}

export function SocialFeed({ posts }: SocialFeedProps) {
  return (
    <div className="flex flex-col flex-1" style={{ padding: '12px 20px', minHeight: 0 }}>
      <div className="flex items-center" style={{ gap: 8, marginBottom: 10 }}>
        <span
          className="font-mono text-[9px] font-bold uppercase text-primary"
          style={{ letterSpacing: '0.1em' }}
        >
          Community Signal
        </span>
        <span className="font-mono text-[9px] text-text-dim animate-pulse-soft">
          {posts.length} active
        </span>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden mask-fade-vertical" style={{ gap: 6 }}>
        {posts.map((post, index) => {
          const config = SOURCE_CONFIG[post.source] ?? { label: '???', color: '#5a7089' }

          return (
            <div
              key={post.id}
              className="flex items-start"
              style={{
                gap: 8,
                padding: '6px 0',
                borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                opacity: 0,
                animation: `fade-in 0.3s ease-out ${index * 0.05}s forwards`,
              }}
            >
              <span
                className="font-mono text-[8px] font-bold uppercase shrink-0 rounded"
                style={{
                  color: config.color,
                  background: `${config.color}10`,
                  padding: '2px 5px',
                  letterSpacing: '0.06em',
                  marginTop: 1,
                }}
              >
                {config.label}
              </span>

              <div className="flex-1 min-w-0">
                <p
                  className="font-mono text-[10px] text-text leading-snug"
                  style={{
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {post.title}
                </p>
              </div>

              <div className="flex items-center shrink-0" style={{ gap: 6 }}>
                <span className="font-mono text-[9px] font-semibold text-text-secondary">
                  {post.score > 999
                    ? `${(post.score / 1000).toFixed(1)}K`
                    : post.score}
                </span>
                <span className="font-mono text-[8px] text-text-dim">
                  {timeAgo(post.timestamp)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
