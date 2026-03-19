interface StatusBarProps {
  totalEvents: number
  fileCount: number
  commandCount: number
  lastTool: string
  model: string
  agentCount: number
  costUsd?: number
}

export function StatusBar({ totalEvents, fileCount, commandCount, lastTool, model, agentCount, costUsd }: StatusBarProps) {
  return (
    <div className="h-8 bg-black/90 border-t border-border/30 flex items-center px-4 gap-4 text-xs font-mono text-dim shrink-0">
      {/* Heartbeat dot */}
      <div className="w-2 h-2 rounded-full bg-cyan/60 animate-pulse" />

      <span>{totalEvents} events</span>
      <span className="text-border">·</span>
      <span>{fileCount} files</span>
      <span className="text-border">·</span>
      <span>{commandCount} cmds</span>

      {/* Center: last tool */}
      <div className="flex-1 text-center text-text/50">
        {lastTool}
      </div>

      {/* Right side */}
      {costUsd !== undefined && costUsd > 0 && (
        <span className="text-success/70">${costUsd.toFixed(2)}</span>
      )}
      {agentCount > 0 && (
        <span className="text-cyan/70">{agentCount} agent{agentCount > 1 ? 's' : ''}</span>
      )}
      {model && (
        <span className="text-dim/40">{model}</span>
      )}
    </div>
  )
}
