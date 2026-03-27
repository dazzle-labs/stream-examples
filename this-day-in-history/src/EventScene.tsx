import { useRef, useEffect, useState } from 'react'
import type { HistoryEvent, ScenePhase } from './types'
import type { CSSProperties } from 'react'

type EventSceneProps = {
  event: HistoryEvent,
  phase: ScenePhase,
  progressLabel?: string,
}

const CATEGORY_LABELS: Record<string, string> = {
  selected: 'HISTORIC EVENT',
  event: 'EVENT',
  birth: 'BORN THIS DAY',
  death: 'DIED THIS DAY',
}

export function EventScene({ event, phase, progressLabel }: EventSceneProps) {
  if (phase === 'transition' || phase === 'era_intro') return null

  const contentReference = useRef<HTMLDivElement>(null)
  const [contentOverflows, setContentOverflows] = useState(false)
  const [scrollDuration, setScrollDuration] = useState(6)
  const [scrollDistance, setScrollDistance] = useState(0)

  useEffect(() => {
    const container = contentReference.current
    if (!container) return
    const checkOverflow = () => {
      const overflows = container.scrollHeight > container.clientHeight + 10
      setContentOverflows(overflows)
      if (overflows) {
        const overflowAmount = container.scrollHeight - container.clientHeight
        const fullText = (event.text ?? '') + ' ' + (event.extract ?? '')
        const wordCount = fullText.split(/\s+/).length
        setScrollDuration(Math.max(5, wordCount / 2.5))
        setScrollDistance(overflowAmount)
      }
    }
    requestAnimationFrame(() => requestAnimationFrame(checkOverflow))
  }, [event.text, event.extract])

  const eraStyles = {
    '--era-sepia': event.era.sepia,
    '--era-saturation': event.era.saturation,
    '--era-accent': event.era.accent,
    '--era-tint': event.era.backgroundTint,
  } as CSSProperties

  const showExtract = event.extract
    && event.extract.length > 10
    && !event.text.startsWith(event.extract.slice(0, 30))

  const yearsAgo = new Date().getFullYear() - event.year
  const categoryLabel = CATEGORY_LABELS[event.category] ?? 'EVENT'
  const headerParts = [categoryLabel, `${yearsAgo} YRS AGO`]
  if (progressLabel) headerParts.push(progressLabel)

  return (
    <div
      className={phase === 'exiting' ? 'scene-exit' : 'scene-enter'}
      style={{
        ...eraStyles,
        position: 'fixed',
        inset: 0,
        zIndex: 5,
        overflow: 'hidden',
      }}
    >
      {event.image ? (
        <div className="image-layer" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          <img src={event.image} alt="" className="ken-burns" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.3, willChange: 'transform' }} />
          <div style={{ position: 'absolute', inset: 0, backgroundColor: event.era.backgroundTint, mixBlendMode: 'color', opacity: event.era.sepia > 0.3 ? 0.6 : 0.2 }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,10,15,0.95) 0%, rgba(10,10,15,0.4) 40%, rgba(10,10,15,0.2) 100%)' }} />
        </div>
      ) : (
        <div className="image-layer" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          <img src={event.era.backgroundImage} alt="" className="ken-burns" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.2, willChange: 'transform' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,10,15,0.95) 0%, rgba(10,10,15,0.5) 40%, rgba(10,10,15,0.3) 100%)' }} />
        </div>
      )}

      <div
        className="text-reveal text-reveal-fast"
        style={{
          position: 'absolute',
          right: 40,
          top: 40,
          fontSize: 180,
          fontWeight: 600,
          lineHeight: 1,
          fontFamily: event.era.titleFont,
          color: event.era.accent,
          opacity: 0.18,
          pointerEvents: 'none',
          zIndex: 6,
        }}
      >
        {event.year}
      </div>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '60px 40px 80px 40px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ width: '100%', maxWidth: 1100 }}>
          <div
            className="fade-up"
            style={{
              fontSize: 13,
              fontFamily: event.era.bodyFont,
              letterSpacing: '0.12em',
              color: event.era.accent,
              marginBottom: 14,
              textTransform: 'uppercase',
            }}
          >
            {headerParts.join('  ·  ')}
          </div>

          <div
            ref={contentReference}
            style={{
              maxHeight: 440,
              overflow: 'hidden',
              ...(contentOverflows ? {
                maskImage: 'linear-gradient(to bottom, black 0%, black calc(100% - 50px), transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black calc(100% - 50px), transparent 100%)',
              } : {}),
            }}
          >
            <div
              style={contentOverflows ? {
                '--scroll-distance': `-${scrollDistance}px`,
                animation: `scrollUp ${scrollDuration}s ease-in-out 5s forwards`,
              } as CSSProperties : undefined}
            >
              <div
                className="fade-up fade-up-delay-1"
                style={{
                  fontSize: 42,
                  fontWeight: 500,
                  color: '#e8e4df',
                  lineHeight: 1.2,
                  marginBottom: showExtract ? 14 : 0,
                  fontFamily: event.era.titleFont,
                }}
              >
                {event.text}
              </div>

              {showExtract && (
                <div
                  className="fade-up-delay-2"
                  style={{
                    fontSize: 19,
                    fontWeight: 300,
                    color: '#c9cdd3',
                    lineHeight: 1.5,
                    fontFamily: event.era.bodyFont,
                  }}
                >
                  {event.extract}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
