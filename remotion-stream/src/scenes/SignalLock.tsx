import { AbsoluteFill, interpolate, spring, useVideoConfig, Easing } from 'remotion'

// Scene: Signal Lock
// The broadcast begins. A signal indicator resolves, text decodes character by character.
// "SIGNAL ACQUIRED" fills the screen. Haunted infrastructure — the system waking up.

const TARGET_TEXT = 'SIGNAL ACQUIRED'
const CHAR_SET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*'

// Deterministic scramble based on frame
function scrambleChar(index: number, frame: number): string {
  const seed = Math.sin((index + 1) * 127.1 + frame * 311.7) * 43758.5453
  const charIndex = Math.floor((seed - Math.floor(seed)) * CHAR_SET.length)
  return CHAR_SET[charIndex % CHAR_SET.length] ?? 'X'
}

export function SceneSignalLock({ frame, sceneStart }: { frame: number; sceneStart: number }) {
  const { fps } = useVideoConfig()
  const local = frame - sceneStart

  // Signal indicator circle — pulses then locks
  const indicatorSpring = spring({
    frame: local,
    fps,
    config: { damping: 12, stiffness: 120 },
  })
  const indicatorScale = interpolate(indicatorSpring, [0, 1], [0.3, 1])
  const indicatorPulse = local > 30 ? 0.7 + 0.3 * Math.sin(local * 0.12) : indicatorSpring

  // Text decode: each character resolves from scrambled to real
  const decodeStart = 20 // frames after scene start
  const charsPerFrame = 0.4 // speed of decode
  const resolvedCount = Math.floor(Math.max(0, (local - decodeStart) * charsPerFrame))

  const displayChars = TARGET_TEXT.split('').map((char, i) => {
    if (char === ' ') return ' '
    if (i < resolvedCount) return char
    return scrambleChar(i, local)
  })

  // Text entrance: slide up with spring
  const textSpring = spring({
    frame: local - 15,
    fps,
    config: { damping: 18, stiffness: 80 },
  })
  const textY = interpolate(textSpring, [0, 1], [60, 0])
  const textOpacity = interpolate(local, [10, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Subtitle decode
  const subtitleText = 'LOCKING TRANSMISSION'
  const subtitleStart = 45
  const subtitleResolved = Math.floor(Math.max(0, (local - subtitleStart) * 0.6))
  const subtitleChars = subtitleText.split('').map((char, i) => {
    if (char === ' ') return ' '
    if (i < subtitleResolved) return char
    return scrambleChar(i + 100, local)
  })
  const subtitleOpacity = interpolate(local, [subtitleStart, subtitleStart + 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Frequency bars at bottom — signal strength indicator
  const barCount = 40
  const bars: React.ReactNode[] = []
  for (let i = 0; i < barCount; i++) {
    const barDelay = 5 + i * 0.5
    const barEntrance = interpolate(local, [barDelay, barDelay + 8], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.quad),
    })
    const wave = Math.sin(local * 0.08 + i * 0.4) * 0.4 + 0.5
    const height = wave * 40 * barEntrance
    const hue = 170 + i * 1.5

    bars.push(
      <div
        key={i}
        style={{
          width: 6,
          height,
          backgroundColor: `hsla(${hue}, 70%, 55%, ${0.3 + wave * 0.3})`,
          borderRadius: '2px 2px 0 0',
        }}
      />,
    )
  }

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Signal indicator */}
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          backgroundColor: `rgba(0, 255, 180, ${indicatorPulse * 0.9})`,
          boxShadow: `0 0 ${20 * indicatorPulse}px rgba(0, 255, 180, ${indicatorPulse * 0.3})`,
          transform: `scale(${indicatorScale})`,
          marginBottom: 40,
        }}
      />

      {/* Hero text — SIGNAL ACQUIRED */}
      <div
        style={{
          fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
          fontSize: 82,
          fontWeight: 700,
          color: '#fff',
          letterSpacing: 10,
          textTransform: 'uppercase',
          transform: `translateY(${textY}px)`,
          opacity: textOpacity,
          textAlign: 'center',
          lineHeight: 1,
        }}
      >
        {displayChars.map((char, i) => {
          const isResolved = i < resolvedCount || TARGET_TEXT[i] === ' '
          return (
            <span
              key={i}
              style={{
                color: isResolved ? '#fff' : 'rgba(0, 255, 200, 0.4)',
                transition: 'none',
              }}
            >
              {char}
            </span>
          )
        })}
      </div>

      {/* Subtitle */}
      <div
        style={{
          fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
          fontSize: 14,
          fontWeight: 400,
          color: 'rgba(0, 255, 180, 0.4)',
          letterSpacing: 6,
          marginTop: 24,
          opacity: subtitleOpacity,
        }}
      >
        {subtitleChars.join('')}
      </div>

      {/* Frequency bars along bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: 60,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'flex-end',
          gap: 3,
          height: 50,
        }}
      >
        {bars}
      </div>
    </AbsoluteFill>
  )
}
