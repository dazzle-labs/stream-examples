import { useState, useEffect } from 'react'
import { store } from '../data/store'
import type { BreakingEvent } from '../data/types'

export function BreakingOverlay() {
  const [event, setEvent] = useState<BreakingEvent | null>(store.breakingEvent)

  useEffect(() => {
    const interval = setInterval(() => {
      setEvent(store.breakingEvent ? { ...store.breakingEvent } : null)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  if (!event) return null

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center z-30"
      style={{
        background: 'radial-gradient(ellipse at center, rgba(30, 2, 8, 0.95) 0%, rgba(1, 2, 8, 0.98) 70%)',
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-5"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '256px 256px',
        }}
      />

      <div className="text-[#ef233c] text-base font-mono uppercase tracking-[0.4em] mb-6 breathing">
        Breaking
      </div>

      <div className="text-[#ef233c] text-6xl font-mono font-bold tracking-tight mb-4">
        {event.cveId}
      </div>

      <div className="text-gray-300 text-lg font-mono max-w-lg text-center leading-relaxed mb-8 px-8">
        {event.description}
      </div>

      {event.signals.length > 0 && (
        <div className="flex flex-col items-center gap-2">
          <div className="text-[16px] font-mono uppercase tracking-[0.3em] text-white opacity-30 mb-1">
            Correlated Signals
          </div>
          {event.signals.map((signal, index) => (
            <div
              key={index}
              className="flex items-center gap-2 text-base font-mono text-gray-400"
            >
              <div className="w-1 h-1 rounded-full bg-[#ef233c] opacity-60" />
              {signal}
            </div>
          ))}
        </div>
      )}

      <div
        className="absolute bottom-12 left-1/2 -translate-x-1/2 w-48 h-px opacity-20"
        style={{ background: 'linear-gradient(90deg, transparent, #ef233c, transparent)' }}
      />
    </div>
  )
}
