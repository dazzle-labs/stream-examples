import { AbsoluteFill, interpolate, spring, useVideoConfig, Easing } from 'remotion'

// Scene: Waveform
// A single undulating waveform stretches edge to edge. Full bleed.
// The wave IS the hero. A label decodes beneath it.
// Haunted infrastructure — monitoring a signal that shouldn't exist.

const WAVE_POINTS = 120
const LABEL_TEXT = 'FREQUENCY ANALYSIS'

export function SceneWaveform({ frame, sceneStart }: { frame: number; sceneStart: number }) {
  const { fps } = useVideoConfig()
  const local = frame - sceneStart

  // Wave entrance: amplitude grows from 0
  const waveEntrance = spring({
    frame: local,
    fps,
    config: { damping: 15, stiffness: 40 },
  })

  // Build the waveform path
  const centerY = 340
  const amplitude = 120 * waveEntrance
  const pathPoints: string[] = []
  const fillPoints: string[] = []

  for (let i = 0; i <= WAVE_POINTS; i++) {
    const t = i / WAVE_POINTS
    const x = t * 1280

    // Compound wave — multiple frequencies for organic feel
    const wave1 = Math.sin(t * 6 + local * 0.04) * 0.5
    const wave2 = Math.sin(t * 11 + local * 0.07) * 0.25
    const wave3 = Math.sin(t * 3.5 + local * 0.02) * 0.35
    const wave4 = Math.sin(t * 17 + local * 0.09) * 0.1

    // Envelope — amplitude tapers at edges
    const envelope = Math.sin(t * Math.PI)
    const y = centerY + (wave1 + wave2 + wave3 + wave4) * amplitude * envelope

    pathPoints.push(`${x},${y}`)
    fillPoints.push(`${x},${y}`)
  }

  const pathD = `M ${pathPoints.join(' L ')}`
  const fillD = `M 0,${centerY} L ${fillPoints.join(' L ')} L 1280,${centerY} Z`

  // Secondary wave — thinner, offset
  const secondaryPoints: string[] = []
  for (let i = 0; i <= WAVE_POINTS; i++) {
    const t = i / WAVE_POINTS
    const x = t * 1280
    const wave1 = Math.sin(t * 5 + local * 0.05 + 1.5) * 0.4
    const wave2 = Math.sin(t * 13 + local * 0.08 + 0.8) * 0.2
    const wave3 = Math.sin(t * 4 + local * 0.025 + 2) * 0.3
    const envelope = Math.sin(t * Math.PI)
    const y = centerY + (wave1 + wave2 + wave3) * amplitude * 0.6 * envelope
    secondaryPoints.push(`${x},${y}`)
  }
  const secondaryD = `M ${secondaryPoints.join(' L ')}`

  // Tertiary wave — amber, very subtle
  const tertiaryPoints: string[] = []
  for (let i = 0; i <= WAVE_POINTS; i++) {
    const t = i / WAVE_POINTS
    const x = t * 1280
    const wave1 = Math.sin(t * 8 + local * 0.06 + 3) * 0.35
    const wave2 = Math.sin(t * 15 + local * 0.1 + 1.5) * 0.15
    const envelope = Math.sin(t * Math.PI)
    const y = centerY + (wave1 + wave2) * amplitude * 0.4 * envelope
    tertiaryPoints.push(`${x},${y}`)
  }
  const tertiaryD = `M ${tertiaryPoints.join(' L ')}`

  // Label decode
  const labelStart = 25
  const labelProgress = interpolate(local, [labelStart, labelStart + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const labelChars = LABEL_TEXT.split('').map((char, i) => {
    if (char === ' ') return ' '
    const resolveAt = i / LABEL_TEXT.length
    if (labelProgress > resolveAt) return char
    const seed = Math.sin((i + 1) * 127.1 + local * 311.7) * 43758.5453
    const charIndex = Math.floor((seed - Math.floor(seed)) * 26)
    return String.fromCharCode(65 + (charIndex % 26))
  })

  // Horizontal reference line
  const lineOpacity = interpolate(local, [5, 20], [0, 0.15], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Frequency counter in top right
  const freqValue = (42.7 + Math.sin(local * 0.05) * 3.2).toFixed(1)
  const freqOpacity = interpolate(local, [15, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill>
      {/* SVG waveform — full bleed */}
      <svg
        width={1280}
        height={720}
        style={{ position: 'absolute', left: 0, top: 0 }}
      >
        {/* Center reference line */}
        <line
          x1={0}
          y1={centerY}
          x2={1280}
          y2={centerY}
          stroke={`rgba(100, 180, 200, ${lineOpacity})`}
          strokeWidth={1}
          strokeDasharray="8 12"
        />

        {/* Tick marks along center line */}
        {Array.from({ length: 13 }).map((_, i) => {
          const tx = (i / 12) * 1280
          const tickH = i % 4 === 0 ? 12 : 6
          return (
            <line
              key={`tick-${i}`}
              x1={tx}
              y1={centerY - tickH / 2}
              x2={tx}
              y2={centerY + tickH / 2}
              stroke={`rgba(100, 180, 200, ${lineOpacity * 0.7})`}
              strokeWidth={1}
            />
          )
        })}

        {/* Fill area under wave */}
        <path
          d={fillD}
          fill="url(#waveFill)"
          opacity={waveEntrance * 0.4}
        />

        {/* Tertiary wave — very faint, faster */}
        <path
          d={tertiaryD}
          fill="none"
          stroke="rgba(255, 180, 100, 0.06)"
          strokeWidth={0.5}
        />

        {/* Secondary wave */}
        <path
          d={secondaryD}
          fill="none"
          stroke="rgba(200, 100, 255, 0.15)"
          strokeWidth={1}
        />

        {/* Primary wave */}
        <path
          d={pathD}
          fill="none"
          stroke="url(#waveStroke)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Gradient definitions */}
        <defs>
          <linearGradient id="waveStroke" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(0, 200, 255, 0.2)" />
            <stop offset="30%" stopColor="rgba(0, 255, 200, 0.9)" />
            <stop offset="50%" stopColor="rgba(0, 220, 255, 1)" />
            <stop offset="70%" stopColor="rgba(100, 200, 255, 0.9)" />
            <stop offset="100%" stopColor="rgba(0, 200, 255, 0.2)" />
          </linearGradient>
          <linearGradient id="waveFill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(0, 220, 255, 0.15)" />
            <stop offset="100%" stopColor="rgba(0, 220, 255, 0)" />
          </linearGradient>
        </defs>
      </svg>

      {/* Label — bottom center */}
      <div
        style={{
          position: 'absolute',
          bottom: 100,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
          fontSize: 13,
          fontWeight: 400,
          color: 'rgba(0, 200, 220, 0.5)',
          letterSpacing: 8,
          opacity: labelProgress,
        }}
      >
        {labelChars.join('')}
      </div>

      {/* Frequency readout — top left */}
      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 60,
          fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
          fontSize: 42,
          fontWeight: 700,
          color: 'rgba(0, 255, 220, 0.7)',
          letterSpacing: -1,
          opacity: freqOpacity,
        }}
      >
        {freqValue}
        <span
          style={{
            fontSize: 16,
            fontWeight: 400,
            color: 'rgba(0, 200, 200, 0.4)',
            marginLeft: 6,
          }}
        >
          Hz
        </span>
      </div>
    </AbsoluteFill>
  )
}
