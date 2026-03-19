import { AbsoluteFill, interpolate, spring, useVideoConfig, Easing } from 'remotion'

// Scene: Transmission
// A message types out, character by character. Movie title card energy.
// Big sans-serif editorial type. The reveal IS the content.

const LINES = [
  { text: 'THE SIGNAL', delay: 0, size: 110, weight: 800, spacing: 6 },
  { text: 'IS THE SHOW', delay: 20, size: 110, weight: 800, spacing: 6 },
]

const CHAR_REVEAL_SPEED = 2.5 // frames per character

export function SceneTransmission({ frame, sceneStart }: { frame: number; sceneStart: number }) {
  const { fps } = useVideoConfig()
  const local = frame - sceneStart

  // Cursor blink
  const cursorOn = Math.sin(local * 0.3) > 0

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      {LINES.map((line, lineIndex) => {
        const lineLocal = local - line.delay
        if (lineLocal < 0) return null

        // Spring entrance for the line
        const lineSpring = spring({
          frame: lineLocal,
          fps,
          config: { damping: 20, stiffness: 80 },
        })
        const lineY = interpolate(lineSpring, [0, 1], [30, 0])

        // Character reveal
        const totalChars = line.text.length
        const revealedCount = Math.min(totalChars, Math.floor(lineLocal / CHAR_REVEAL_SPEED))

        // Displayed text (use string slicing per Remotion best practices)
        const displayText = line.text.slice(0, revealedCount)
        const isComplete = revealedCount >= totalChars

        // Show cursor at end of current typing line
        const showCursor = !isComplete && lineLocal > 0

        return (
          <div
            key={lineIndex}
            style={{
              fontFamily: 'system-ui, -apple-system, "Helvetica Neue", sans-serif',
              fontSize: line.size,
              fontWeight: line.weight,
              color: '#ffffff',
              letterSpacing: line.spacing,
              textTransform: 'uppercase',
              transform: `translateY(${lineY}px)`,
              opacity: lineSpring,
              textAlign: 'center',
              lineHeight: 1.1,
              minHeight: line.size * 1.1,
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {displayText}
            {showCursor && (
              <span
                style={{
                  display: 'inline-block',
                  width: 3,
                  height: line.size * 0.8,
                  backgroundColor: cursorOn ? 'rgba(0, 255, 200, 0.8)' : 'transparent',
                  marginLeft: 4,
                  verticalAlign: 'middle',
                }}
              />
            )}
          </div>
        )
      })}

      {/* Decorative accent — thin line that expands */}
      <TransmissionAccent local={local} />

      {/* Bottom timestamp */}
      <div
        style={{
          position: 'absolute',
          bottom: 60,
          right: 60,
          fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
          fontSize: 11,
          fontWeight: 400,
          color: 'rgba(150, 180, 200, 0.3)',
          letterSpacing: 3,
        }}
      >
        TX::{String(Math.floor(local / 30)).padStart(3, '0')}
      </div>
    </AbsoluteFill>
  )
}

function TransmissionAccent({ local }: { local: number }) {
  const accentDelay = 50
  const accentWidth = interpolate(local, [accentDelay, accentDelay + 30], [0, 600], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  })
  const accentOpacity = interpolate(local, [accentDelay, accentDelay + 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Pulse after fully expanded
  const breathe = local > accentDelay + 30
    ? 0.4 + 0.2 * Math.sin(local * 0.05)
    : accentOpacity * 0.5

  return (
    <div
      style={{
        width: accentWidth,
        height: 1,
        background: `linear-gradient(90deg, transparent, rgba(255, 0, 180, ${breathe}), transparent)`,
        marginTop: 24,
      }}
    />
  )
}
