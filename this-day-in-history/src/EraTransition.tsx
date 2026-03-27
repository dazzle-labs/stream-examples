import type { Era } from './types'

type EraTransitionProps = {
  era: Era,
  eventCount: number,
}

export function EraTransition({ era, eventCount }: EraTransitionProps) {
  const yearLabel = `${era.yearRange[0]} // ${era.yearRange[1]}`

  return (
    <div
      className="scene-enter"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 5,
        backgroundColor: '#0a0a0f',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
      }}
    >
      <img
        src={era.backgroundImage}
        alt=""
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: 0.15,
        }}
      />
      <div
        className="fade-up"
        style={{
          fontSize: 80,
          letterSpacing: '0.15em',
          color: era.accent,
          textAlign: 'center',
          lineHeight: 1,
          marginBottom: 20,
          fontFamily: era.titleFont,
        }}
      >
        {era.name}
      </div>

      <div
        className="font-mono fade-up-delay-1"
        style={{
          fontSize: 24,
          letterSpacing: '0.3em',
          color: 'white',
          opacity: 0.4,
          textAlign: 'center',
          marginBottom: 24,
        }}
      >
        {yearLabel}
      </div>

      <div
        className="era-line"
        style={{
          height: 1,
          backgroundColor: era.accent,
          marginBottom: 24,
        }}
      />

      <div
        className="font-mono fade-up-delay-2"
        style={{
          fontSize: 12,
          letterSpacing: '0.4em',
          color: 'white',
          opacity: 0.3,
          textAlign: 'center',
        }}
      >
        {eventCount} TRANSMISSIONS
      </div>
    </div>
  )
}
