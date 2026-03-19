import { AbsoluteFill } from 'remotion'

// Atmospheric background layer — the dark of a screen that's powered on.
// Subtle grid, drifting gradient, scan lines. Always breathing, never static.
// Pure CSS/DOM — no canvas, no shaders. Software renderer safe.

export function Atmosphere({ frame }: { frame: number }) {
  // Slow drifting color wash
  const hueShift = Math.sin(frame * 0.005) * 20
  const gradientX = 50 + Math.sin(frame * 0.008) * 15
  const gradientY = 50 + Math.cos(frame * 0.006) * 15
  const gradientOpacity = 0.06 + 0.02 * Math.sin(frame * 0.012)

  // Grid breathing
  const gridPulse = 0.03 + 0.015 * Math.sin(frame * 0.025)
  const gridHue = 200 + hueShift

  // Subtle noise texture (simulated with overlapping gradients)
  const noisePhase1 = (frame * 0.7) % 360
  const noisePhase2 = (frame * 1.1) % 360

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {/* Base gradient wash — drifts slowly */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at ${gradientX}% ${gradientY}%, hsla(${220 + hueShift}, 60%, 15%, ${gradientOpacity}), transparent 70%)`,
        }}
      />

      {/* Secondary wash — opposing drift */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at ${100 - gradientX}% ${100 - gradientY}%, hsla(${280 + hueShift}, 50%, 12%, ${gradientOpacity * 0.6}), transparent 60%)`,
        }}
      />

      {/* Grid lines — sparse, breathing */}
      <GridLines hue={gridHue} opacity={gridPulse} />

      {/* Scan line artifact — slow drift */}
      <ScanArtifact frame={frame} />

      {/* Faint noise texture overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `
            repeating-linear-gradient(${noisePhase1}deg, transparent, transparent 3px, rgba(255,255,255,0.003) 3px, rgba(255,255,255,0.003) 4px),
            repeating-linear-gradient(${noisePhase2}deg, transparent, transparent 5px, rgba(255,255,255,0.002) 5px, rgba(255,255,255,0.002) 6px)
          `,
        }}
      />

      {/* Vignette — cinematic edges */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(0,0,0,0.4) 100%)',
        }}
      />
    </AbsoluteFill>
  )
}

function GridLines({ hue, opacity }: { hue: number; opacity: number }) {
  const spacing = 80
  const lines: React.ReactNode[] = []

  // Vertical lines — fade toward edges
  for (let x = spacing; x < 1280; x += spacing) {
    const distFromCenter = Math.abs(x - 640) / 640
    const lineOpacity = (1 - distFromCenter * 0.8) * opacity
    lines.push(
      <div
        key={`v-${x}`}
        style={{
          position: 'absolute',
          left: x,
          top: 0,
          width: 1,
          height: 720,
          backgroundColor: `hsla(${hue}, 40%, 40%, ${lineOpacity})`,
        }}
      />,
    )
  }

  // Horizontal lines
  for (let y = spacing; y < 720; y += spacing) {
    const distFromCenter = Math.abs(y - 360) / 360
    const lineOpacity = (1 - distFromCenter * 0.8) * opacity
    lines.push(
      <div
        key={`h-${y}`}
        style={{
          position: 'absolute',
          left: 0,
          top: y,
          width: 1280,
          height: 1,
          backgroundColor: `hsla(${hue}, 40%, 40%, ${lineOpacity})`,
        }}
      />,
    )
  }

  return <>{lines}</>
}

function ScanArtifact({ frame }: { frame: number }) {
  // A faint horizontal band that drifts slowly down the screen
  const y = ((frame * 0.8) % 800) - 40
  const scanOpacity = 0.025

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: y,
        width: 1280,
        height: 60,
        background: `linear-gradient(180deg, transparent, rgba(150, 200, 255, ${scanOpacity}), transparent)`,
      }}
    />
  )
}
