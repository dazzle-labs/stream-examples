import type { FeedEvent } from '../types'

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000)
  if (seconds < 3) return 'now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ago`
}

const accentColors = {
  cyan: 'border-l-cyan bg-cyan/[0.03]',
  claude: 'border-l-claude bg-claude/[0.03]',
  white: 'border-l-text bg-white/[0.03]',
  error: 'border-l-error bg-error/[0.03]',
  success: 'border-l-success bg-success/[0.03]',
} as const

const labelColors = {
  cyan: 'text-cyan',
  claude: 'text-claude',
  white: 'text-text',
  error: 'text-error',
  success: 'text-success',
} as const

const detailColorMap: Record<string, string> = {
  error: 'text-error/70',
  success: 'text-success/70',
}

// User and Claude messages get more visible text; tool cards stay compact
function heroClamp(type: string): string {
  if (type === 'user_message' || type === 'assistant_message') {
    return 'line-clamp-4'
  }
  return 'line-clamp-1'
}

interface FeedCardProps {
  event: FeedEvent
  isNewest: boolean
}

export function FeedCard({ event, isNewest }: FeedCardProps) {
  return (
    <div
      className={`
        animate-slide-in border-l-3 rounded-sm px-3 py-2.5 mb-1.5
        transition-opacity duration-500
        ${accentColors[event.accent]}
        ${isNewest ? 'opacity-100' : 'opacity-70'}
      `}
    >
      {/* Header row: label + timestamp */}
      <div className="flex items-center justify-between mb-1">
        <span className={`font-mono text-xs font-semibold tracking-wider ${labelColors[event.accent]}`}>
          {event.label}
        </span>
        <span className="font-mono text-xs text-dim">
          {timeAgo(event.timestamp)}
        </span>
      </div>

      {/* Hero text */}
      <div className={`font-mono leading-snug ${isNewest ? 'text-base' : 'text-sm'} text-text ${heroClamp(event.type)}`}>
        {event.heroText}
      </div>

      {/* Secondary text */}
      {event.secondaryText && (
        <div className="font-mono text-xs text-text-dim mt-0.5 truncate">
          {event.secondaryText}
        </div>
      )}

      {/* Detail lines (diffs, output, etc.) */}
      {event.detailLines && event.detailLines.length > 0 && (
        <div className="mt-1.5 font-mono text-xs space-y-0.5">
          {event.detailLines.map((line, i) => (
            <div key={i} className={`truncate ${detailColorMap[line.color ?? ''] ?? 'text-dim'}`}>
              {line.text}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
