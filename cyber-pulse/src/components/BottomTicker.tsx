import { useState, useEffect, useMemo } from 'react'
import { store } from '../data/store'
import type { TickerEvent } from '../data/types'

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef233c',
  high: '#f77f00',
  medium: '#ffbe0b',
  low: '#06d6a0',
  info: '#00e5ff',
}

function severityColor(severity: string): string {
  return SEVERITY_COLORS[severity] ?? SEVERITY_COLORS['info'] ?? '#00e5ff'
}

function TickerItem({ event }: { event: TickerEvent }) {
  const color = severityColor(event.severity)
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap mx-6">
      <span className="font-mono text-[16px] opacity-60" style={{ color }}>
        [{event.source}]
      </span>
      <span className="font-mono text-[16px] text-gray-300">
        {event.text}
      </span>
    </span>
  )
}

export function BottomTicker() {
  const [events, setEvents] = useState<TickerEvent[]>([])

  useEffect(() => {
    const interval = setInterval(() => {
      setEvents([...store.tickerEvents])
    }, 2000)
    setEvents([...store.tickerEvents])
    return () => clearInterval(interval)
  }, [])

  const displayEvents = useMemo(() => {
    if (events.length === 0) {
      return [
        { id: 'placeholder-1', source: 'SYS', text: 'Initializing data feeds...', severity: 'info', timestamp: Date.now() },
        { id: 'placeholder-2', source: 'SYS', text: 'Waiting for upstream sources', severity: 'info', timestamp: Date.now() },
        { id: 'placeholder-3', source: 'SYS', text: 'cyber-pulse active', severity: 'info', timestamp: Date.now() },
      ] satisfies TickerEvent[]
    }
    return events.slice(0, 50)
  }, [events])

  const duplicatedEvents = useMemo(() => {
    return [...displayEvents, ...displayEvents]
  }, [displayEvents])

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-40 overflow-hidden font-mono"
      style={{
        height: '24px',
        background: 'rgba(1, 2, 8, 0.85)',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      <div className="flex items-center h-full ticker-scroll">
        {duplicatedEvents.map((event, index) => (
          <TickerItem key={`${event.id}-${index}`} event={event} />
        ))}
      </div>
    </div>
  )
}
