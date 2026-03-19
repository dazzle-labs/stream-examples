import { useEventStream } from './hooks/useEventStream'
import { Feed } from './components/Feed'
import { Sidebar } from './components/Sidebar'
import { StatusBar } from './components/StatusBar'

export function App() {
  const {
    feedEvents,
    files,
    agents,
    stats,
    usage,
    model,
    totalEvents,
    sparkline,
    lastBucket,
  } = useEventStream()

  const lastEvent = feedEvents[feedEvents.length - 1]
  const lastTool = lastEvent?.label ?? ''

  return (
    <div className="w-[1280px] h-[720px] bg-bg flex flex-col overflow-hidden">
      {/* Main content area */}
      <div className="flex-1 flex min-h-0">
        {/* Feed */}
        <Feed events={feedEvents} />

        {/* Divider */}
        <div className="w-px bg-border/30 shrink-0" />

        {/* Sidebar */}
        <Sidebar
          files={files}
          agents={agents}
          stats={stats}
          usage={usage}
          model={model}
          totalEvents={totalEvents}
          sparkline={sparkline}
          lastBucket={lastBucket}
        />
      </div>

      {/* Status bar */}
      <StatusBar
        totalEvents={totalEvents}
        fileCount={files.size}
        commandCount={stats.commands}
        lastTool={lastTool}
        model={model}
        agentCount={agents.size}
        costUsd={usage?.costUsd}
      />
    </div>
  )
}
