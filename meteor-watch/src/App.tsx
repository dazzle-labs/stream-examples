import { useMeteorData } from './useMeteorData'
import { MeteorGlobe } from './MeteorGlobe'
import { TitleBar, StatsBar, RadiantMap } from './Overlays'

export function App() {
  const { points, stats } = useMeteorData()

  return (
    <div className="relative w-[1280px] h-[720px] bg-black overflow-hidden">
      {/* Full-screen radiant sky chart (the hero) */}
      <RadiantMap points={points} />

      {/* Small globe inset, bottom-left, with signal-lock corner brackets */}
      <div
        className="absolute z-10"
        style={{
          bottom: 48,
          left: 20,
          width: 252,
          height: 252,
        }}
      >
        {/* Corner brackets around globe */}
        <GlobeCornerBrackets />

        {/* Globe with pulsing border glow */}
        <div
          className="animate-glow-pulse"
          style={{
            position: 'absolute',
            inset: 6,
            borderRadius: '50%',
            overflow: 'hidden',
            border: '1px solid rgba(245, 158, 11, 0.15)',
          }}
        >
          <MeteorGlobe points={points} />
        </div>
      </div>

      {/* Animated vignette overlay */}
      <div
        className="absolute inset-0 z-15 pointer-events-none animate-vignette-breathe"
        style={{
          background: 'radial-gradient(ellipse 70% 65% at 50% 50%, transparent 0%, rgba(0,0,0,0.5) 80%, rgba(0,0,0,0.85) 100%)',
        }}
      />

      {/* CRT scan line */}
      <div
        className="absolute inset-0 z-16 pointer-events-none overflow-hidden"
        style={{ opacity: 0.03 }}
      >
        <div
          className="animate-scan-line"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: 2,
            background: 'rgba(255,255,255,0.8)',
            top: 0,
          }}
        />
      </div>

      {/* Overlays */}
      <TitleBar stats={stats} />
      <StatsBar stats={stats} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Corner brackets around the globe inset (signal lock style)         */
/* ------------------------------------------------------------------ */

function GlobeCornerBrackets() {
  const bracketStyle = {
    position: 'absolute' as const,
    width: 16,
    height: 16,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderStyle: 'solid' as const,
    borderWidth: 0,
  }

  return (
    <>
      <div style={{ ...bracketStyle, top: 0, left: 0, borderTopWidth: 1, borderLeftWidth: 1 }} />
      <div style={{ ...bracketStyle, top: 0, right: 0, borderTopWidth: 1, borderRightWidth: 1 }} />
      <div style={{ ...bracketStyle, bottom: 0, left: 0, borderBottomWidth: 1, borderLeftWidth: 1 }} />
      <div style={{ ...bracketStyle, bottom: 0, right: 0, borderBottomWidth: 1, borderRightWidth: 1 }} />
    </>
  )
}
