/* ------------------------------------------------------------------ */
/*  Procedural ambient sound design via Web Audio API                   */
/*  All synthesis is procedural; no audio files are fetched.            */
/* ------------------------------------------------------------------ */

export interface AudioEngine {
  startDrone(): void
  playTick(): void
  playClusterResolve(): void
  setVolume(v: number): void
}

export function initAudio(): AudioEngine | null {
  let actx: AudioContext
  try {
    actx = new AudioContext()
  } catch {
    return null
  }

  const master = actx.createGain()
  master.gain.value = 1.0
  master.connect(actx.destination)

  let droneStarted = false

  function startDrone(): void {
    if (droneStarted) return
    droneStarted = true

    // Resume context if suspended (autoplay policy)
    if (actx.state === 'suspended') {
      void actx.resume()
    }

    // Low fundamental drone at ~65Hz
    const osc = actx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 65

    // Very subtle LFO modulating drone frequency
    const lfo = actx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 0.08 // ~12 second cycle
    const lfoGain = actx.createGain()
    lfoGain.gain.value = 1.5 // +/- 1.5Hz wobble
    lfo.connect(lfoGain)
    lfoGain.connect(osc.frequency)
    lfo.start()

    // Second harmonic for warmth
    const osc2 = actx.createOscillator()
    osc2.type = 'sine'
    osc2.frequency.value = 130
    const osc2Gain = actx.createGain()
    osc2Gain.gain.value = 0.01
    osc2.connect(osc2Gain)
    osc2Gain.connect(master)
    osc2.start()

    // Drone gain: very quiet
    const droneGain = actx.createGain()
    droneGain.gain.value = 0.03
    osc.connect(droneGain)
    droneGain.connect(master)
    osc.start()
  }

  function playTick(): void {
    if (actx.state === 'suspended') {
      void actx.resume()
    }

    const now = actx.currentTime

    // Brief high-frequency sine burst
    const osc = actx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 2000

    const env = actx.createGain()
    env.gain.setValueAtTime(0.05, now)
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.05)

    osc.connect(env)
    env.connect(master)
    osc.start(now)
    osc.stop(now + 0.06)
  }

  function playClusterResolve(): void {
    if (actx.state === 'suspended') {
      void actx.resume()
    }

    const now = actx.currentTime

    // Deeper tone that swells then decays
    const osc = actx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 200

    // Slight frequency drop for warmth
    osc.frequency.setValueAtTime(200, now)
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.8)

    const env = actx.createGain()
    env.gain.setValueAtTime(0.001, now)
    // 300ms attack
    env.gain.linearRampToValueAtTime(0.04, now + 0.3)
    // 500ms decay
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.8)

    osc.connect(env)
    env.connect(master)
    osc.start(now)
    osc.stop(now + 0.85)
  }

  function setVolume(v: number): void {
    master.gain.setValueAtTime(Math.max(0, Math.min(1, v)), actx.currentTime)
  }

  return {
    startDrone,
    playTick,
    playClusterResolve,
    setVolume,
  }
}
