import { useCallback, useEffect, useRef, useState } from 'react'
import type { PulseState, ActivityEvent } from './types'
import { createDataManager } from './data'
import { SystemBar } from './components/SystemBar'
import { PaperHero } from './components/PaperHero'
import { ActivityCanvas } from './components/ActivityCanvas'
import { Leaderboard } from './components/Leaderboard'
import { ModelTicker } from './components/ModelTicker'
import { SocialFeed } from './components/SocialFeed'
import { PaperTicker } from './components/PaperTicker'

const INITIAL_STATE: PulseState = {
  papers: [],
  heroPaper: null,
  leaderboard: [],
  trendingModels: [],
  socialFeed: [],
  stocks: [],
  activityEvents: [],
  connected: false,
  paperCount: 0,
  modelCount: 0,
  eventRate: 0,
}

export function AiPulse() {
  const [state, setState] = useState<PulseState>(INITIAL_STATE)
  const canvasRef = useRef<{ addEvent: (event: ActivityEvent) => void }>(null)

  const handleActivity = useCallback((event: ActivityEvent) => {
    canvasRef.current?.addEvent(event)
  }, [])

  const pendingRef = useRef<PulseState | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleState = useCallback((newState: PulseState) => {
    pendingRef.current = newState
    if (!timerRef.current) {
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        if (pendingRef.current) setState(pendingRef.current)
      }, 300)
    }
  }, [])

  useEffect(() => {
    const manager = createDataManager(handleState, handleActivity)
    return () => manager.destroy()
  }, [handleState, handleActivity])

  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: '#03070b' }}>
      <div className="grain-overlay" />
      <div className="vignette" />
      <div className="scan-line" />

      <div className="relative flex flex-col w-[1280px] h-[720px]" style={{ zIndex: 10 }}>
        <SystemBar
          stocks={state.stocks}
          connected={state.connected}
          paperCount={state.paperCount}
          eventRate={state.eventRate}
        />

        <div className="flex flex-1" style={{ minHeight: 0 }}>
          <div className="relative flex flex-col" style={{ width: 760 }}>
            <div className="relative flex-1" style={{ minHeight: 0 }}>
              <ActivityCanvas ref={canvasRef} />
              <div className="absolute inset-0 flex flex-col" style={{ zIndex: 20 }}>
                <PaperHero paper={state.heroPaper} />
              </div>
            </div>
          </div>

          <div
            className="w-px shrink-0"
            style={{
              background: 'linear-gradient(to bottom, transparent, rgba(0, 212, 255, 0.1) 20%, rgba(0, 212, 255, 0.1) 80%, transparent)',
            }}
          />

          <div className="flex flex-col flex-1" style={{ minWidth: 0 }}>
            <Leaderboard entries={state.leaderboard} />

            <div
              className="h-px shrink-0"
              style={{ background: 'linear-gradient(to right, rgba(0, 212, 255, 0.1), transparent)' }}
            />

            <ModelTicker models={state.trendingModels} />

            <div
              className="h-px shrink-0"
              style={{ background: 'linear-gradient(to right, rgba(0, 212, 255, 0.1), transparent)' }}
            />

            <SocialFeed posts={state.socialFeed} />
          </div>
        </div>

        <PaperTicker papers={state.papers} />
      </div>
    </div>
  )
}
