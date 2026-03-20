// Procedural audio engine — generative drone that evolves forever
// Bass drone, sub, detuned pad cluster, filtered noise atmosphere,
// metallic ping echoes synced to the visual beat

export function initAudio() {
  const ctx = new AudioContext()
  const master = ctx.createGain()
  master.gain.value = 0.35
  master.connect(ctx.destination)

  // Bass drone — shifting sawtooth through resonant lowpass
  const bass = ctx.createOscillator()
  bass.type = 'sawtooth'
  bass.frequency.value = 55
  const bassFilter = ctx.createBiquadFilter()
  bassFilter.type = 'lowpass'
  bassFilter.frequency.value = 200
  bassFilter.Q.value = 8
  const bassGain = ctx.createGain()
  bassGain.gain.value = 0.3
  bass.connect(bassFilter).connect(bassGain).connect(master)
  bass.start()

  // Sub bass — pure sine a fifth below
  const sub = ctx.createOscillator()
  sub.type = 'sine'
  sub.frequency.value = 36.7
  const subGain = ctx.createGain()
  subGain.gain.value = 0.25
  sub.connect(subGain).connect(master)
  sub.start()

  // Pad — detuned saw cluster cycling through dark chords
  const padGain = ctx.createGain()
  padGain.gain.value = 0.08
  const padFilter = ctx.createBiquadFilter()
  padFilter.type = 'lowpass'
  padFilter.frequency.value = 1200
  padFilter.Q.value = 2
  padGain.connect(padFilter).connect(master)
  const padOscs: OscillatorNode[] = []
  for (let i = 0; i < 4; i++) {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = 110 * (1 + (i - 1.5) * 0.003)
    o.connect(padGain)
    o.start()
    padOscs.push(o)
  }

  // Atmosphere — filtered noise with sweeping bandpass
  const noiseLen = ctx.sampleRate * 2
  const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate)
  const noiseData = noiseBuf.getChannelData(0)
  for (let i = 0; i < noiseLen; i++) noiseData[i] = Math.random() * 2 - 1
  const noise = ctx.createBufferSource()
  noise.buffer = noiseBuf
  noise.loop = true
  const noiseFilter = ctx.createBiquadFilter()
  noiseFilter.type = 'bandpass'
  noiseFilter.frequency.value = 800
  noiseFilter.Q.value = 3
  const noiseGain = ctx.createGain()
  noiseGain.gain.value = 0.06
  noise.connect(noiseFilter).connect(noiseGain).connect(master)
  noise.start()

  // Ping delay — metallic echoes with feedback
  const pingGain = ctx.createGain()
  pingGain.gain.value = 0.12
  const delay = ctx.createDelay(1.0)
  delay.delayTime.value = 0.375
  const feedback = ctx.createGain()
  feedback.gain.value = 0.45
  const delayFilter = ctx.createBiquadFilter()
  delayFilter.type = 'highpass'
  delayFilter.frequency.value = 400
  pingGain.connect(delay).connect(feedback).connect(delayFilter).connect(delay)
  pingGain.connect(master)
  delay.connect(master)

  const chords = [
    [110, 130.81, 164.81, 196],
    [98, 123.47, 146.83, 174.61],
    [82.41, 110, 130.81, 155.56],
    [92.5, 116.54, 138.59, 164.81],
  ]

  function update(t: number) {
    // Drift bass frequency
    const baseFreq = 55 + Math.sin(t * 0.07) * 15 + Math.sin(t * 0.13) * 8
    bass.frequency.setTargetAtTime(baseFreq, ctx.currentTime, 0.5)
    sub.frequency.setTargetAtTime(baseFreq * 0.667, ctx.currentTime, 0.5)

    // Sweep bass filter — opens on beat
    bassFilter.frequency.setTargetAtTime(
      150 + Math.sin(t * 0.1) * 80 + Math.pow(Math.max(Math.sin(t * Math.PI), 0), 16) * 800,
      ctx.currentTime, 0.1,
    )

    // Pad chord changes
    const chordIdx = Math.floor(t * 0.05) % 4
    const chord = chords[chordIdx]!
    padOscs.forEach((o, i) => {
      o.frequency.setTargetAtTime(chord[i]! + Math.sin(t * 0.3 + i) * 0.5, ctx.currentTime, 2.0)
    })

    // Noise sweep
    noiseFilter.frequency.setTargetAtTime(
      600 + Math.sin(t * 0.08) * 400 + Math.sin(t * 0.23) * 200,
      ctx.currentTime, 0.3,
    )

    // Rhythmic ping on beat
    if (Math.sin(t * Math.PI) > 0.998) {
      const ping = ctx.createOscillator()
      ping.type = 'sine'
      ping.frequency.value = 440 * Math.pow(2, Math.floor(Math.random() * 12) / 12)
      const env = ctx.createGain()
      env.gain.setValueAtTime(0.15, ctx.currentTime)
      env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
      ping.connect(env).connect(pingGain)
      ping.start(ctx.currentTime)
      ping.stop(ctx.currentTime + 0.3)
    }
  }

  return { ctx, update }
}
