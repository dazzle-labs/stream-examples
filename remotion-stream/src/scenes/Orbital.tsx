import { AbsoluteFill, interpolate, spring, useVideoConfig, Easing } from 'remotion'

// Scene: Orbital
// A single ring of particles rotates slowly. Particles pulse and breathe.
// Minimal, meditative. The calm before the loop resets.
// One hero — the ring. Everything else is negative space.

const PARTICLE_COUNT = 16
const RING_RADIUS = 180
const CENTER_X = 640
const CENTER_Y = 340

export function SceneOrbital({ frame, sceneStart }: { frame: number; sceneStart: number }) {
  const { fps } = useVideoConfig()
  const local = frame - sceneStart

  // Ring entrance: scale from center
  const ringSpring = spring({
    frame: local,
    fps,
    config: { damping: 12, stiffness: 50 },
  })
  const ringScale = interpolate(ringSpring, [0, 1], [0.4, 1])
  const ringOpacity = interpolate(ringSpring, [0, 1], [0, 1])

  // Slow rotation
  const rotation = local * 0.25

  // Build particles
  const particles: React.ReactNode[] = []
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const baseAngle = (i / PARTICLE_COUNT) * 360
    const angle = baseAngle + rotation
    const rad = (angle * Math.PI) / 180

    // Each particle has its own breathing rhythm
    const breathe = 1 + 0.15 * Math.sin(local * 0.05 + i * 0.9)
    const r = RING_RADIUS * breathe

    const x = Math.cos(rad) * r
    const y = Math.sin(rad) * r

    // Particle stagger entrance
    const particleEntrance = spring({
      frame: local - 5 - i * 2,
      fps,
      config: { damping: 15, stiffness: 100 },
    })

    const hue = 260 + i * 6
    const size = 3 + 2 * Math.sin(local * 0.04 + i * 1.3)
    const particleOpacity = (0.5 + 0.4 * Math.sin(local * 0.06 + i * 0.7)) * particleEntrance

    // Glow
    particles.push(
      <circle
        key={`glow-${i}`}
        cx={CENTER_X + x}
        cy={CENTER_Y + y}
        r={size * 4 * particleEntrance}
        fill={`hsla(${hue}, 70%, 60%, ${particleOpacity * 0.12})`}
      />,
    )

    // Core particle
    particles.push(
      <circle
        key={`core-${i}`}
        cx={CENTER_X + x}
        cy={CENTER_Y + y}
        r={size * particleEntrance}
        fill={`hsla(${hue}, 80%, 70%, ${particleOpacity})`}
      />,
    )
  }

  // Connecting ring — thin, ghostly
  const ringTrailOpacity = 0.06 + 0.03 * Math.sin(local * 0.03)

  // Center element — small pulsing dot
  const centerPulse = 0.5 + 0.3 * Math.sin(local * 0.08)
  const centerSize = 4 + 2 * Math.sin(local * 0.06)

  // "END TRANSMISSION" text decode
  const endText = 'END TRANSMISSION'
  const endStart = 70
  const endOpacity = interpolate(local, [endStart, endStart + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const endResolved = Math.floor(Math.max(0, (local - endStart) * 0.5))
  const endChars = endText.split('').map((char, i) => {
    if (char === ' ') return ' '
    if (i < endResolved) return char
    const seed = Math.sin((i + 1) * 127.1 + local * 311.7) * 43758.5453
    const charIndex = Math.floor((seed - Math.floor(seed)) * 26)
    return String.fromCharCode(65 + (charIndex % 26))
  })

  return (
    <AbsoluteFill>
      <svg
        width={1280}
        height={720}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          opacity: ringOpacity,
          transform: `scale(${ringScale})`,
          transformOrigin: `${CENTER_X}px ${CENTER_Y}px`,
        }}
      >
        {/* Ghost ring track */}
        <circle
          cx={CENTER_X}
          cy={CENTER_Y}
          r={RING_RADIUS}
          fill="none"
          stroke={`rgba(160, 140, 255, ${ringTrailOpacity})`}
          strokeWidth={1}
        />

        {/* Inner reference ring */}
        <circle
          cx={CENTER_X}
          cy={CENTER_Y}
          r={RING_RADIUS * 0.5}
          fill="none"
          stroke={`rgba(140, 120, 220, ${ringTrailOpacity * 0.5})`}
          strokeWidth={1}
          strokeDasharray="4 8"
        />

        {/* Particles */}
        {particles}

        {/* Center dot */}
        <circle
          cx={CENTER_X}
          cy={CENTER_Y}
          r={centerSize}
          fill={`rgba(200, 180, 255, ${centerPulse})`}
        />
        <circle
          cx={CENTER_X}
          cy={CENTER_Y}
          r={centerSize * 3}
          fill={`rgba(200, 180, 255, ${centerPulse * 0.1})`}
        />
      </svg>

      {/* "END TRANSMISSION" — appears late in the scene */}
      <div
        style={{
          position: 'absolute',
          bottom: 120,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
          fontSize: 12,
          fontWeight: 400,
          color: 'rgba(160, 140, 255, 0.35)',
          letterSpacing: 6,
          opacity: endOpacity,
        }}
      >
        {endChars.join('')}
      </div>
    </AbsoluteFill>
  )
}
