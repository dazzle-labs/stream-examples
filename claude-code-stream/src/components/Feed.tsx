import { useEffect, useRef } from 'react'
import type { FeedEvent } from '../types'
import { FeedCard } from './FeedCard'

interface FeedProps {
  events: FeedEvent[]
}

export function Feed({ events }: FeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [events.length])

  if (events.length === 0) {
    return (
      <div className="flex-1 flex items-end justify-center pb-24">
        <div className="text-center">
          <div className="font-mono text-sm text-dim tracking-widest animate-pulse-slow">
            AWAITING SIGNAL
          </div>
          <div className="mt-3 w-32 h-px bg-border mx-auto" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col px-4 pb-2">
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-none flex flex-col justify-end">
        <div>
          {events.map((event, i) => (
            <FeedCard
              key={event.id}
              event={event}
              isNewest={i === events.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
