import { useState, useEffect, useCallback, useRef } from 'react'
import type { HistoryEvent, Era, ScenePhase } from './types'
import { fetchHistoryEvents } from './fetchEvents'
import { SystemChrome } from './SystemChrome'
import { EventScene } from './EventScene'
import { EraTransition } from './EraTransition'
import { Timeline } from './Timeline'
import { Vignette } from './Vignette'
import { BreathingGlow } from './BreathingGlow'

type PlaybackItem =
  | { type: 'era_intro', era: Era, eventCount: number }
  | { type: 'event', event: HistoryEvent }

const PHASE_DURATIONS: Record<ScenePhase, number> = {
  entering: 3000,
  holding: 12000,
  exiting: 1200,
  transition: 1000,
  era_intro: 3000,
}

function seededShuffle<T>(array: T[], seed: number): T[] {
  const result = [...array]
  let current = seed
  for (let i = result.length - 1; i > 0; i--) {
    current = (current * 1664525 + 1013904223) & 0x7fffffff
    const j = current % (i + 1)
    const temporary = result[i]!
    result[i] = result[j]!
    result[j] = temporary
  }
  return result
}

const EVENTS_PER_ERA_BATCH = 5

function buildEraGroups(events: HistoryEvent[]): Map<string, { era: Era, events: HistoryEvent[] }> {
  const groups = new Map<string, { era: Era, events: HistoryEvent[] }>()
  for (const historyEvent of events) {
    const existing = groups.get(historyEvent.era.name)
    if (existing) {
      existing.events.push(historyEvent)
    } else {
      groups.set(historyEvent.era.name, { era: historyEvent.era, events: [historyEvent] })
    }
  }
  for (const group of groups.values()) {
    group.events.sort((a, b) => a.year - b.year)
  }
  return groups
}

function buildPlaybackSequence(
  eraGroups: Map<string, { era: Era, events: HistoryEvent[] }>,
  round: number,
  seed: number,
): PlaybackItem[] {
  const groupEntries = Array.from(eraGroups.values())
  const shuffledGroups = seededShuffle(groupEntries, seed + round * 7919)

  const sequence: PlaybackItem[] = []

  for (const group of shuffledGroups) {
    const totalEvents = group.events.length
    const startOffset = (round * EVENTS_PER_ERA_BATCH) % totalEvents
    const batch: HistoryEvent[] = []

    for (let i = 0; i < Math.min(EVENTS_PER_ERA_BATCH, totalEvents); i++) {
      const event = group.events[(startOffset + i) % totalEvents]
      if (event) batch.push(event)
    }

    batch.sort((a, b) => a.year - b.year)

    if (batch.length === 0) continue

    sequence.push({ type: 'era_intro', era: group.era, eventCount: batch.length })
    for (const historyEvent of batch) {
      sequence.push({ type: 'event', event: historyEvent })
    }
  }

  return sequence
}

function preloadImages(sequence: PlaybackItem[], startIndex: number, count: number) {
  for (let offset = 1; offset <= count; offset++) {
    const index = (startIndex + offset) % sequence.length
    const item = sequence[index]
    if (item && item.type === 'event' && item.event.image) {
      const preloader = new Image()
      preloader.src = item.event.image
    }
  }
}

function getCurrentEvent(sequence: PlaybackItem[], currentIndex: number): HistoryEvent | undefined {
  const currentItem = sequence[currentIndex]
  if (!currentItem) return
  if (currentItem.type === 'event') return currentItem.event
  return
}

function getProgressLabel(sequence: PlaybackItem[], currentIndex: number): string | undefined {
  const currentItem = sequence[currentIndex]
  if (!currentItem || currentItem.type !== 'event') return

  let eraStart = currentIndex
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (sequence[i]?.type === 'era_intro') {
      eraStart = i + 1
      break
    }
  }

  let eraEnd = sequence.length
  for (let i = currentIndex + 1; i < sequence.length; i++) {
    if (sequence[i]?.type === 'era_intro') {
      eraEnd = i
      break
    }
  }

  const positionInEra = currentIndex - eraStart + 1
  const totalInEra = eraEnd - eraStart
  return `${positionInEra} / ${totalInEra}`
}

function getNextEraAccent(sequence: PlaybackItem[], currentIndex: number): string {
  for (let i = currentIndex + 1; i < sequence.length; i++) {
    const item = sequence[i]
    if (item && item.type === 'era_intro') return item.era.accent
  }
  const firstIntro = sequence.find((item) => item.type === 'era_intro')
  if (firstIntro && firstIntro.type === 'era_intro') return firstIntro.era.accent
  return '#ffffff'
}

export function App() {
  const [allEvents, setAllEvents] = useState<HistoryEvent[]>([])
  const [playbackSequence, setPlaybackSequence] = useState<PlaybackItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [phase, setPhase] = useState<ScenePhase>('era_intro')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [recalibrating, setRecalibrating] = useState(false)
  const dateReference = useRef(new Date().getDate())
  const roundReference = useRef(0)
  const eraGroupsReference = useRef<Map<string, { era: Era, events: HistoryEvent[] }>>(new Map())
  const seedReference = useRef(0)

  const currentItem = playbackSequence[currentIndex]
  const currentEvent = getCurrentEvent(playbackSequence, currentIndex)
  const currentEra = currentItem
    ? currentItem.type === 'era_intro'
      ? currentItem.era
      : currentItem.type === 'event'
        ? currentItem.event.era
        : undefined
    : undefined

  const advanceToNextRound = useCallback(() => {
    roundReference.current += 1
    const sequence = buildPlaybackSequence(
      eraGroupsReference.current,
      roundReference.current,
      seedReference.current,
    )
    setPlaybackSequence(sequence)
    setCurrentIndex(0)
    setPhase('era_intro')
  }, [])

  const loadEvents = useCallback(async () => {
    try {
      setError(false)
      setLoading(true)
      const today = new Date()
      const historyEvents = await fetchHistoryEvents(today)
      setAllEvents(historyEvents)
      const seed = (today.getMonth() + 1) * 31 + today.getDate()
      seedReference.current = seed
      roundReference.current = 0
      eraGroupsReference.current = buildEraGroups(historyEvents)
      const sequence = buildPlaybackSequence(eraGroupsReference.current, 0, seed)
      setPlaybackSequence(sequence)
      setCurrentIndex(0)
      setPhase('era_intro')
      setLoading(false)
      dateReference.current = new Date().getDate()
    } catch {
      setError(true)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  useEffect(() => {
    if (error) {
      const retryInterval = window.setInterval(loadEvents, 30000)
      return () => window.clearInterval(retryInterval)
    }
  }, [error, loadEvents])

  useEffect(() => {
    const midnightCheck = window.setInterval(() => {
      const today = new Date().getDate()
      if (today !== dateReference.current) {
        setRecalibrating(true)
        window.setTimeout(() => {
          loadEvents().then(() => setRecalibrating(false))
        }, 2000)
      }
    }, 60000)
    return () => window.clearInterval(midnightCheck)
  }, [loadEvents])

  useEffect(() => {
    if (playbackSequence.length === 0 || loading) return

    preloadImages(playbackSequence, currentIndex, 3)

    const timeout = window.setTimeout(() => {
      const isLastItem = currentIndex >= playbackSequence.length - 1

      if (phase === 'era_intro') {
        if (isLastItem) {
          advanceToNextRound()
        } else {
          setCurrentIndex(currentIndex + 1)
          setPhase('entering')
        }
      } else if (phase === 'entering') {
        setPhase('holding')
      } else if (phase === 'holding') {
        setPhase('exiting')
      } else if (phase === 'exiting') {
        if (isLastItem) {
          setPhase('transition')
        } else {
          const nextItem = playbackSequence[currentIndex + 1]
          if (nextItem && nextItem.type === 'era_intro') {
            setPhase('transition')
          } else {
            setCurrentIndex(currentIndex + 1)
            setPhase('entering')
          }
        }
      } else if (phase === 'transition') {
        if (isLastItem) {
          advanceToNextRound()
        } else {
          setCurrentIndex(currentIndex + 1)
          setPhase('era_intro')
        }
      }
    }, PHASE_DURATIONS[phase])

    return () => window.clearTimeout(timeout)
  }, [phase, playbackSequence, currentIndex, loading])

  if (recalibrating) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: '#0a0a0f',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          className="font-mono signal-pulse"
          style={{
            fontSize: 14,
            letterSpacing: '0.3em',
            color: 'white',
            opacity: 0.5,
          }}
        >
          RECALIBRATING...
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: '#0a0a0f',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          className="font-mono signal-pulse"
          style={{
            fontSize: 14,
            letterSpacing: '0.3em',
            color: 'white',
            opacity: 0.5,
          }}
        >
          ACQUIRING SIGNAL...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: '#0a0a0f',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
        }}
      >
        <div
          className="font-mono"
          style={{
            fontSize: 14,
            letterSpacing: '0.3em',
            color: '#ef4444',
            opacity: 0.7,
          }}
        >
          NO SIGNAL
        </div>
        <div
          className="font-mono signal-pulse"
          style={{
            fontSize: 11,
            letterSpacing: '0.2em',
            color: 'white',
            opacity: 0.3,
          }}
        >
          RETRYING...
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: '#0a0a0f' }}>
      <SystemChrome />

      <BreathingGlow accent={currentEra?.accent ?? '#ffffff'} />

      {currentItem && currentItem.type === 'era_intro' && phase === 'era_intro' && (
        <EraTransition era={currentItem.era} eventCount={currentItem.eventCount} />
      )}

      {currentItem && currentItem.type === 'event' && (
        <EventScene
          event={currentItem.event}
          phase={phase}
          progressLabel={getProgressLabel(playbackSequence, currentIndex)}
        />
      )}

      <Vignette
        accent={currentEra?.accent ?? '#ffffff'}
        intensity={currentEra ? (currentEra.sepia > 0.3 ? 0.8 : currentEra.sepia > 0 ? 0.5 : 0.3) : 0.5}
      />

      {phase === 'transition' && (
        <div
          className="tune-flash"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: getNextEraAccent(playbackSequence, currentIndex),
            zIndex: 10,
            pointerEvents: 'none',
          }}
        />
      )}

      <Timeline
        allEvents={allEvents}
        currentEvent={currentEvent}
        phase={phase}
      />
    </div>
  )
}
