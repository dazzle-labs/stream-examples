import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion'
import { SceneSignalLock } from './scenes/SignalLock'
import { SceneTheNumber } from './scenes/TheNumber'
import { SceneWaveform } from './scenes/Waveform'
import { SceneTransmission } from './scenes/Transmission'
import { SceneOrbital } from './scenes/Orbital'
import { Atmosphere } from './Atmosphere'

// Scene timing (frames at 30fps, 600 total for 20s loop)
// Each scene has enter/hold/exit phases. Scenes overlap slightly for transitions.
const SCENES = [
  { start: 0, end: 110 },     // Signal Lock
  { start: 100, end: 230 },   // The Number
  { start: 220, end: 360 },   // Waveform
  { start: 350, end: 480 },   // Transmission
  { start: 470, end: 600 },   // Orbital (fades to black for loop)
] as const

// Hard cut / noise flash transition
function sceneOpacity(frame: number, start: number, end: number): number {
  const enterDuration = 6 // ~0.2s hard snap
  const exitDuration = 4  // even faster exit
  const fadeIn = interpolate(frame, [start, start + enterDuration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  })
  const fadeOut = interpolate(frame, [end - exitDuration, end], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.quad),
  })
  return fadeIn * fadeOut
}

// Noise flash between scenes — a brief white/cyan flash
function TransitionFlash({ frame, at }: { frame: number; at: number }) {
  const intensity = interpolate(frame, [at - 2, at, at + 3], [0, 0.7, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  if (intensity <= 0) return null
  return (
    <AbsoluteFill
      style={{
        backgroundColor: `rgba(120, 220, 255, ${intensity * 0.15})`,
        mixBlendMode: 'screen',
      }}
    />
  )
}

// Scan line that sweeps during transitions
function ScanLine({ frame, at }: { frame: number; at: number }) {
  const progress = interpolate(frame, [at - 3, at + 5], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  if (progress <= 0 || progress >= 1) return null
  const y = progress * 720
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: y - 2,
        width: 1280,
        height: 4,
        background: 'linear-gradient(180deg, transparent, rgba(0, 255, 200, 0.3), transparent)',
        pointerEvents: 'none',
      }}
    />
  )
}

export function Composition() {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()

  // Global envelope: fade from/to black for seamless loop
  const loopFadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  })
  const loopFadeOut = interpolate(frame, [durationInFrames - 15, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
  })
  const globalOpacity = loopFadeIn * loopFadeOut

  const s0 = sceneOpacity(frame, SCENES[0].start, SCENES[0].end)
  const s1 = sceneOpacity(frame, SCENES[1].start, SCENES[1].end)
  const s2 = sceneOpacity(frame, SCENES[2].start, SCENES[2].end)
  const s3 = sceneOpacity(frame, SCENES[3].start, SCENES[3].end)
  const s4 = sceneOpacity(frame, SCENES[4].start, SCENES[4].end)

  return (
    <AbsoluteFill style={{ backgroundColor: '#08090e', opacity: globalOpacity }}>
      {/* Atmospheric background — always present, always breathing */}
      <Atmosphere frame={frame} />

      {/* Scene layers */}
      {s0 > 0 && (
        <AbsoluteFill style={{ opacity: s0 }}>
          <SceneSignalLock frame={frame} sceneStart={SCENES[0].start} />
        </AbsoluteFill>
      )}
      {s1 > 0 && (
        <AbsoluteFill style={{ opacity: s1 }}>
          <SceneTheNumber frame={frame} sceneStart={SCENES[1].start} />
        </AbsoluteFill>
      )}
      {s2 > 0 && (
        <AbsoluteFill style={{ opacity: s2 }}>
          <SceneWaveform frame={frame} sceneStart={SCENES[2].start} />
        </AbsoluteFill>
      )}
      {s3 > 0 && (
        <AbsoluteFill style={{ opacity: s3 }}>
          <SceneTransmission frame={frame} sceneStart={SCENES[3].start} />
        </AbsoluteFill>
      )}
      {s4 > 0 && (
        <AbsoluteFill style={{ opacity: s4 }}>
          <SceneOrbital frame={frame} sceneStart={SCENES[4].start} />
        </AbsoluteFill>
      )}

      {/* Transition flashes between scenes */}
      <TransitionFlash frame={frame} at={SCENES[0].end} />
      <TransitionFlash frame={frame} at={SCENES[1].end} />
      <TransitionFlash frame={frame} at={SCENES[2].end} />
      <TransitionFlash frame={frame} at={SCENES[3].end} />

      {/* Scan lines at transitions */}
      <ScanLine frame={frame} at={SCENES[0].end} />
      <ScanLine frame={frame} at={SCENES[1].end} />
      <ScanLine frame={frame} at={SCENES[2].end} />
      <ScanLine frame={frame} at={SCENES[3].end} />

      {/* Persistent bottom-left system label */}
      <SystemLabel frame={frame} />

      {/* Persistent top-right timecode */}
      <Timecode frame={frame} />
    </AbsoluteFill>
  )
}

// Small monospace system label — the "broadcast infrastructure" always visible
function SystemLabel({ frame }: { frame: number }) {
  const pulse = 0.3 + 0.15 * Math.sin(frame * 0.06)
  const blinkOn = Math.sin(frame * 0.15) > -0.3

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 20,
        left: 24,
        fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
        fontSize: 10,
        fontWeight: 400,
        color: `rgba(100, 200, 180, ${pulse})`,
        letterSpacing: 2,
        textTransform: 'uppercase',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <div
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          backgroundColor: blinkOn ? `rgba(0, 255, 160, ${pulse + 0.2})` : 'transparent',
        }}
      />
      SYS::REMOTION/DAZZLE
    </div>
  )
}

// Timecode display — broadcast infrastructure feel
function Timecode({ frame }: { frame: number }) {
  const totalSeconds = frame / 30
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  const frames = frame % 30
  const timecode = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(frames).padStart(2, '0')}`

  const pulse = 0.2 + 0.1 * Math.sin(frame * 0.04)

  return (
    <div
      style={{
        position: 'absolute',
        top: 20,
        right: 24,
        fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
        fontSize: 10,
        fontWeight: 400,
        color: `rgba(150, 140, 180, ${pulse})`,
        letterSpacing: 2,
      }}
    >
      {timecode}
    </div>
  )
}
