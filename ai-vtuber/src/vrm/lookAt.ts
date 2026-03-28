import type { VRM } from '@pixiv/three-vrm'

// Lissajous drift for head/body
const DRIFT_X_AMPLITUDE = 0.15
const DRIFT_Y_AMPLITUDE = 0.08
const DRIFT_X_FREQ = 0.3
const DRIFT_Y_FREQ = 0.2
const DRIFT_Y_PHASE = 1.0

// Speaking modifiers
const SPEAKING_DRIFT_SCALE = 0.3
const SPEAKING_CENTER_BIAS = 0.7

const RAD_TO_DEG = 180 / Math.PI

// Saccade system
const SACCADE_INTERVALS = [400, 600, 800, 1000, 1500, 2000, 3000, 4000]
const SACCADE_AMPLITUDE_DEG = 3
const SACCADE_LERP_DURATION = 0.05 // 50ms, saccades are fast

let nextSaccadeTime = 0
let saccadeOffsetYaw = 0
let saccadeOffsetPitch = 0
let saccadeTargetYaw = 0
let saccadeTargetPitch = 0
let saccadeLerpElapsed = SACCADE_LERP_DURATION

function pickSaccadeInterval(): number {
  const idx = Math.floor(Math.random() * SACCADE_INTERVALS.length)
  return (SACCADE_INTERVALS[idx] ?? SACCADE_INTERVALS[0] ?? 800) / 1000
}

export function update(vrm: VRM, elapsedSeconds: number, isSpeaking: boolean): void {
  const lookAt = vrm.lookAt
  if (!lookAt) return

  // Disable autoUpdate so we control yaw/pitch directly
  lookAt.autoUpdate = false

  // Lissajous drift pattern
  const rawX = DRIFT_X_AMPLITUDE * Math.sin(elapsedSeconds * DRIFT_X_FREQ * Math.PI * 2)
  const rawY = DRIFT_Y_AMPLITUDE * Math.sin(elapsedSeconds * DRIFT_Y_FREQ * Math.PI * 2 + DRIFT_Y_PHASE)

  let gazeX: number
  let gazeY: number

  if (isSpeaking) {
    gazeX = rawX * SPEAKING_DRIFT_SCALE * (1 - SPEAKING_CENTER_BIAS)
    gazeY = rawY * SPEAKING_DRIFT_SCALE * (1 - SPEAKING_CENTER_BIAS)
  } else {
    gazeX = rawX
    gazeY = rawY
  }

  // Saccade micro eye movements
  if (elapsedSeconds >= nextSaccadeTime) {
    // Generate new fixation target
    saccadeTargetYaw = (Math.random() * 2 - 1) * SACCADE_AMPLITUDE_DEG
    saccadeTargetPitch = (Math.random() * 2 - 1) * SACCADE_AMPLITUDE_DEG
    saccadeLerpElapsed = 0
    nextSaccadeTime = elapsedSeconds + pickSaccadeInterval()
  }

  // Lerp saccade offset toward target
  if (saccadeLerpElapsed < SACCADE_LERP_DURATION) {
    saccadeLerpElapsed += (1 / 60) // approximate frame delta
    const t = Math.min(saccadeLerpElapsed / SACCADE_LERP_DURATION, 1)
    saccadeOffsetYaw += (saccadeTargetYaw - saccadeOffsetYaw) * t
    saccadeOffsetPitch += (saccadeTargetPitch - saccadeOffsetPitch) * t
  }

  // lookAt.yaw and lookAt.pitch are in degrees
  lookAt.yaw = gazeX * RAD_TO_DEG + saccadeOffsetYaw
  lookAt.pitch = gazeY * RAD_TO_DEG + saccadeOffsetPitch
}
