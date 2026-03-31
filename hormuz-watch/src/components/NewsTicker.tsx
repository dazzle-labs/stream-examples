import type { Headline } from '../types'

interface NewsTickerProps {
  headlines: Headline[]
}

const CATEGORY_STYLES: Record<Headline['category'], { background: string, text: string }> = {
  military: { background: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b' },
  news: { background: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6' },
  osint: { background: 'rgba(34, 197, 94, 0.15)', text: '#22c55e' },
}

function HeadlineItem({ headline }: { headline: Headline }) {
  const style = CATEGORY_STYLES[headline.category]

  return (
    <span className="inline-flex items-center" style={{ marginRight: 48 }}>
      <span
        className="inline-block rounded text-[9px] font-bold uppercase shrink-0"
        style={{
          backgroundColor: style.background,
          color: style.text,
          padding: '3px 10px',
          marginRight: 12,
          lineHeight: 1,
        }}
      >
        {headline.source}
      </span>
      <span className="text-[12px] font-medium text-[#8890b0]">
        {headline.title}
      </span>
    </span>
  )
}

export function NewsTicker({ headlines }: NewsTickerProps) {
  if (headlines.length === 0) return null

  const duration = Math.max(headlines.length * 12, 80)

  return (
    <div
      className="w-[1280px] h-[56px] bg-[#08080f] border-t border-[#1a1e30] overflow-hidden flex items-center shrink-0"
    >
      <div
        className="whitespace-nowrap"
        style={{
          animation: `ticker-scroll ${duration}s linear infinite`,
          paddingLeft: 1280,
        }}
      >
        {headlines.map(headline => (
          <HeadlineItem key={`a-${headline.id}`} headline={headline} />
        ))}
        {headlines.map(headline => (
          <HeadlineItem key={`b-${headline.id}`} headline={headline} />
        ))}
      </div>
    </div>
  )
}
