import { useMemo } from 'react'
import type { HistoryEvent, Era } from './types'

type TimelineProps = {
  allEvents: HistoryEvent[],
  currentEvent: HistoryEvent | undefined,
  phase: string,
}

type EraSegment = {
  era: Era,
  eventCount: number,
  startPercent: number,
  widthPercent: number,
}

export function Timeline({ allEvents, currentEvent }: TimelineProps) {
  if (allEvents.length === 0) return null

  const segments = useMemo(() => {
    const eraMap = new Map<string, { era: Era, count: number }>()
    const eraOrder: string[] = []

    for (const historyEvent of allEvents) {
      const existing = eraMap.get(historyEvent.era.name)
      if (existing) {
        existing.count += 1
      } else {
        eraMap.set(historyEvent.era.name, { era: historyEvent.era, count: 1 })
        eraOrder.push(historyEvent.era.name)
      }
    }

    const totalEvents = allEvents.length
    const result: EraSegment[] = []
    let runningPercent = 0

    for (const eraName of eraOrder) {
      const group = eraMap.get(eraName)
      if (!group) continue
      const widthPercent = (group.count / totalEvents) * 100
      result.push({
        era: group.era,
        eventCount: group.count,
        startPercent: runningPercent,
        widthPercent,
      })
      runningPercent += widthPercent
    }

    return result
  }, [allEvents])

  const currentSegmentIndex = currentEvent
    ? segments.findIndex((segment) => segment.era.name === currentEvent.era.name)
    : -1

  const currentPositionInEra = useMemo(() => {
    if (!currentEvent) return 0
    const eraEvents = allEvents.filter(
      (historyEvent) => historyEvent.era.name === currentEvent.era.name,
    )
    const index = eraEvents.findIndex(
      (historyEvent) => historyEvent.year === currentEvent.year && historyEvent.text === currentEvent.text,
    )
    if (eraEvents.length <= 1) return 0.5
    return index / (eraEvents.length - 1)
  }, [allEvents, currentEvent])

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 56,
        zIndex: 15,
        padding: '0 40px',
        display: 'flex',
        alignItems: 'flex-start',
        paddingTop: 12,
        gap: 2,
      }}
    >
      {segments.map((segment, index) => {
        const isCurrent = index === currentSegmentIndex
        const showLabel = segment.widthPercent > 6

        return (
          <div
            key={segment.era.name}
            style={{
              flex: `${segment.widthPercent} 0 0`,
              position: 'relative',
              height: 32,
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: isCurrent ? 4 : 2,
                borderRadius: 1,
                backgroundColor: segment.era.accent,
                opacity: isCurrent ? 0.8 : 0.2,
                transition: 'opacity 1s ease, height 0.6s ease',
              }}
            />

            {isCurrent && (
              <div
                className="glow-pulse"
                style={{
                  position: 'absolute',
                  top: -3,
                  left: `${currentPositionInEra * 100}%`,
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: segment.era.accent,
                  color: segment.era.accent,
                  transform: 'translateX(-50%)',
                  transition: 'left 1.2s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            )}

            {showLabel && (
              <div
                className="font-mono"
                style={{
                  position: 'absolute',
                  top: 10,
                  left: 0,
                  right: 0,
                  fontSize: 9,
                  color: isCurrent ? segment.era.accent : 'white',
                  opacity: isCurrent ? 0.7 : 0.2,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  transition: 'opacity 1s ease',
                }}
              >
                {segment.era.name}
              </div>
            )}

            {showLabel && (
              <div
                className="font-mono"
                style={{
                  position: 'absolute',
                  top: 22,
                  left: 0,
                  fontSize: 8,
                  color: 'white',
                  opacity: isCurrent ? 0.35 : 0.1,
                  transition: 'opacity 1s ease',
                }}
              >
                {segment.era.yearRange[0]}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
