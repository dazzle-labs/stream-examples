import { AbsoluteFill, interpolate, spring, useVideoConfig, Easing } from 'remotion'

// Scene: The Number
// One number, impossibly large, fills the frame. It counts up from zero.
// "Awe at scale" — a number filling the screen should feel like staring up at a building.
// No fake metrics — this is abstract. The number IS the content.

const TARGET_VALUE = 27384
const LABEL = 'FRAMES RENDERED'

export function SceneTheNumber({ frame, sceneStart }: { frame: number; sceneStart: number }) {
  const { fps } = useVideoConfig()
  const local = frame - sceneStart

  // Number count-up: eases in fast, decelerates near target
  const countDuration = 60 // frames to count up
  const countProgress = interpolate(local, [8, 8 + countDuration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  })
  const currentNumber = Math.round(countProgress * TARGET_VALUE)

  // Format with commas
  const displayNumber = currentNumber.toLocaleString()

  // Spring entrance for the number
  const numberSpring = spring({
    frame: local - 5,
    fps,
    config: { damping: 14, stiffness: 60, mass: 1.2 },
  })
  const numberScale = interpolate(numberSpring, [0, 1], [1.15, 1])
  const numberY = interpolate(numberSpring, [0, 1], [80, 0])

  // Label decode
  const labelStart = 30
  const labelOpacity = interpolate(local, [labelStart, labelStart + 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const labelY = interpolate(local, [labelStart, labelStart + 20], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  })

  // Ambient breathing — the number pulses ever so slightly
  const breathe = local > 70 ? 1 + 0.003 * Math.sin(local * 0.06) : 1

  // Accent line width animates in
  const lineWidth = interpolate(local, [15, 50], [0, 400], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  })

  // Subtle color shift on the number as it counts
  const hue = interpolate(countProgress, [0, 0.5, 1], [180, 200, 220])
  const numberColor = countProgress >= 1 ? '#ffffff' : `hsl(${hue}, 60%, 80%)`

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* The number — massive, centered */}
      <div
        style={{
          fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
          fontSize: 200,
          fontWeight: 800,
          color: numberColor,
          letterSpacing: -6,
          lineHeight: 1,
          transform: `translateY(${numberY}px) scale(${numberScale * breathe})`,
          textAlign: 'center',
          minWidth: '70%',
        }}
      >
        {displayNumber}
      </div>

      {/* Accent line */}
      <div
        style={{
          width: lineWidth,
          height: 2,
          background: 'linear-gradient(90deg, transparent, rgba(0, 200, 255, 0.5), transparent)',
          marginTop: 20,
          marginBottom: 16,
        }}
      />

      {/* Label */}
      <div
        style={{
          fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
          fontSize: 14,
          fontWeight: 400,
          color: 'rgba(140, 200, 220, 0.5)',
          letterSpacing: 8,
          textTransform: 'uppercase',
          opacity: labelOpacity,
          transform: `translateY(${labelY}px)`,
        }}
      >
        {LABEL}
      </div>

      {/* Corner markers — broadcast framing */}
      <CornerMarker position="top-left" opacity={numberSpring * 0.3} />
      <CornerMarker position="top-right" opacity={numberSpring * 0.3} />
      <CornerMarker position="bottom-left" opacity={numberSpring * 0.3} />
      <CornerMarker position="bottom-right" opacity={numberSpring * 0.3} />
    </AbsoluteFill>
  )
}

function CornerMarker({
  position,
  opacity,
}: {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  opacity: number
}) {
  const size = 24
  const offset = 40
  const color = `rgba(0, 200, 180, ${opacity})`

  const style: React.CSSProperties = {
    position: 'absolute',
    width: size,
    height: size,
    borderColor: color,
    borderStyle: 'solid',
    borderWidth: 0,
  }

  if (position.includes('top')) {
    style.top = offset
    style.borderTopWidth = 1
  }
  if (position.includes('bottom')) {
    style.bottom = offset
    style.borderBottomWidth = 1
  }
  if (position.includes('left')) {
    style.left = offset
    style.borderLeftWidth = 1
  }
  if (position.includes('right')) {
    style.right = offset
    style.borderRightWidth = 1
  }

  return <div style={style} />
}
