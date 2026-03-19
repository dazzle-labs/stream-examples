import type { FileEntry, AgentEntry, SessionStats, UsageData } from '../types'

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000)
  if (seconds < 5) return 'now'
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m`
}

// A file touched in the last 2 seconds gets a glow
function isRecent(ts: number): boolean {
  return Date.now() - ts < 2000
}

interface SidebarProps {
  files: Map<string, FileEntry>
  agents: Map<string, AgentEntry>
  stats: SessionStats
  usage: UsageData | null
  model: string
  totalEvents: number
  sparkline: React.RefObject<number[]>
  lastBucket: React.RefObject<number>
}

function PanelHeader({ title, right, rightColor }: { title: string, right?: string, rightColor?: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-border">
      <span className="font-mono text-xs font-bold tracking-wider text-text/80">{title}</span>
      {right && <span className={`font-mono text-xs ${rightColor ?? 'text-dim'}`}>{right}</span>}
    </div>
  )
}

function FileActivityPanel({ files }: { files: Map<string, FileEntry> }) {
  const sorted = [...files.values()]
    .sort((a, b) => b.lastTouched - a.lastTouched)
    .slice(0, 10)

  return (
    <div className="bg-panel rounded border border-border/50">
      <PanelHeader title="FILE ACTIVITY" right={`${files.size} files`} />
      <div className="p-2 space-y-1 max-h-[200px] overflow-hidden">
        {sorted.length === 0 ? (
          <div className="text-xs text-dim text-center py-4">No files touched</div>
        ) : (
          sorted.map(f => (
            <div
              key={f.path}
              className={`flex items-start gap-2 text-xs rounded px-1 py-0.5 transition-colors duration-300 ${isRecent(f.lastTouched) ? 'animate-glow' : ''}`}
            >
              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 transition-colors duration-300 ${isRecent(f.lastTouched) ? 'bg-cyan' : 'bg-cyan/40'}`} />
              <div className="min-w-0 flex-1">
                <div className="text-text/90 font-mono truncate">{f.name}</div>
                <div className="text-dim/60 font-mono text-[10px] truncate">{f.dir}</div>
              </div>
              <div className="text-dim font-mono shrink-0">{f.ops}x</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function AgentsPanel({ agents }: { agents: Map<string, AgentEntry> }) {
  const entries = [...agents.values()]

  return (
    <div className="bg-panel rounded border border-border/50">
      <PanelHeader title="AGENTS" right={entries.length > 0 ? `${entries.length} active` : undefined} />
      <div className="p-2">
        {entries.length === 0 ? (
          <div className="text-xs text-dim text-center py-1">No agents</div>
        ) : (
          <div className="space-y-1.5">
            {entries.map(a => (
              <div key={a.id} className="flex items-center gap-2 text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan animate-pulse shrink-0" />
                <div className="truncate text-text/80 font-mono">{a.type}</div>
                <div className="text-dim font-mono ml-auto shrink-0">{timeAgo(a.startTime)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SessionPanel({ stats, model }: { stats: SessionStats, model: string }) {
  const items = [
    { label: 'READS', value: stats.reads },
    { label: 'EDITS', value: stats.edits },
    { label: 'WRITES', value: stats.writes },
    { label: 'CMDS', value: stats.commands },
    { label: 'SEARCHES', value: stats.searches },
    { label: 'ERRORS', value: stats.errors, errorHighlight: true },
  ]

  const linesRight = stats.linesAdded > 0
    ? `+${stats.linesAdded} lines`
    : (model || undefined)

  return (
    <div className="bg-panel rounded border border-border/50">
      <PanelHeader
        title="SESSION"
        right={linesRight}
        rightColor={stats.linesAdded > 0 ? 'text-success/60' : undefined}
      />
      <div className="grid grid-cols-3 gap-1 p-2">
        {items.map(item => (
          <div key={item.label} className="text-center">
            <div className={`font-mono text-lg font-bold ${
              item.value === 0
                ? 'text-dim/20'
                : item.errorHighlight && item.value > 0
                  ? 'text-error'
                  : 'text-text'
            }`}>
              {item.value}
            </div>
            <div className="font-mono text-[10px] text-dim/50 tracking-wider">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SparklinePanel({ sparkline, lastBucket, totalEvents }: {
  sparkline: React.RefObject<number[]>
  lastBucket: React.RefObject<number>
  totalEvents: number
}) {
  const data = sparkline.current ?? []
  const currentBucket = (lastBucket.current ?? 0) % 120

  // Show 60 bars instead of 120 for wider bars with visible gaps
  const barCount = 60
  const condensed: number[] = []
  for (let i = 0; i < barCount; i++) {
    const idx1 = i * 2
    const idx2 = i * 2 + 1
    condensed.push((data[idx1] ?? 0) + (data[idx2] ?? 0))
  }
  const condensedMax = Math.max(1, ...condensed)
  const condensedCurrentBucket = Math.floor(currentBucket / 2)

  return (
    <div className="bg-panel rounded border border-border/50">
      <PanelHeader title="ACTIVITY" right={`${totalEvents} events`} />
      <div className="p-2 h-[50px] flex items-end gap-[2px]">
        {condensed.map((val, i) => {
          const height = val > 0 ? Math.max(3, (val / condensedMax) * 40) : 0
          const recency = ((i - condensedCurrentBucket + barCount) % barCount) / barCount
          const opacity = val > 0 ? 0.2 + (1 - recency) * 0.6 : 0.04
          return (
            <div
              key={i}
              className="flex-1 bg-cyan rounded-t-sm transition-all duration-300"
              style={{ height: `${height}px`, opacity }}
            />
          )
        })}
      </div>
    </div>
  )
}

function UsageBar({ label, pct, detail, color }: { label: string, pct: number, detail?: string, color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-text/80 font-medium">{label}</span>
        <span className="font-mono text-xs text-dim">{pct}% used</span>
      </div>
      <div className="h-2 bg-border/60 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-700`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      {detail && (
        <div className="font-mono text-[10px] text-dim/60">{detail}</div>
      )}
    </div>
  )
}

function UsagePanel({ usage }: { usage: UsageData | null }) {
  if (!usage) {
    return (
      <div className="bg-panel rounded border border-border/50">
        <PanelHeader title="USAGE" />
        <div className="p-2 text-xs text-dim text-center py-3">Waiting for usage data</div>
      </div>
    )
  }

  const formatTokens = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
  const contextColor = usage.contextUsedPct > 80 ? 'bg-error' : usage.contextUsedPct > 50 ? 'bg-claude' : 'bg-cyan'

  // Estimate session usage as percentage (rough: $5/hr baseline, cap display at 100%)
  const sessionPct = Math.min(100, Math.round(usage.contextUsedPct))

  return (
    <div className="bg-panel rounded border border-border/50">
      <PanelHeader title="USAGE" />
      <div className="p-2 space-y-3">
        <UsageBar
          label="Context window"
          pct={sessionPct}
          color={contextColor}
        />
        <UsageBar
          label="Tokens"
          pct={Math.min(100, Math.round((usage.inputTokens + usage.outputTokens) / 2000))}
          detail={`${formatTokens(usage.inputTokens)} in / ${formatTokens(usage.outputTokens)} out`}
          color="bg-cyan"
        />
        <div className="flex items-center justify-between pt-1 border-t border-border/30">
          <span className="font-mono text-xs text-dim">Session cost</span>
          <span className="font-mono text-sm text-text font-bold">${usage.costUsd.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}

export function Sidebar(props: SidebarProps) {
  return (
    <div className="w-[380px] shrink-0 flex flex-col gap-2 p-2 overflow-hidden">
      <FileActivityPanel files={props.files} />
      <AgentsPanel agents={props.agents} />
      <SessionPanel stats={props.stats} model={props.model} />
      <UsagePanel usage={props.usage} />
      <SparklinePanel sparkline={props.sparkline} lastBucket={props.lastBucket} totalEvents={props.totalEvents} />
    </div>
  )
}
