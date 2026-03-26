import { useEffect, useRef } from 'react'
import type { HlsConstructor, HlsInstance } from './hls-types'

// -- Types ------------------------------------------------------------------

interface HydrophoneNode {
  id: string
  name: string
  slug: string
}

interface NodeState {
  node: HydrophoneNode
  audio: HTMLAudioElement | null
  analyser: AnalyserNode | null
  hls: HlsInstance | null
  freqData: Uint8Array<ArrayBuffer> | null
  retryCount: number
  connected: boolean
}

// -- Constants --------------------------------------------------------------

const WIDTH = 1280
const HEIGHT = 720
const FFT_SIZE = 4096
const SAMPLE_RATE = 48000
const MARGIN_TOP = 30
const MARGIN_BOTTOM = 30
const SPECTROGRAM_HEIGHT = HEIGHT - MARGIN_TOP - MARGIN_BOTTOM
const NODE_SWITCH_INTERVAL = 150_000 // 2.5 minutes in ms
const CROSSFADE_DURATION = 2_000 // 2 seconds in ms
const RETRY_DELAY_MS = 8000
const MAX_RETRIES = 50
const NOISE_FLOOR = 0.03
const POWER_CURVE = 0.4
const S3_BASE = 'https://audio-orcasound-net.s3.us-west-2.amazonaws.com'
const HLS_CDN_URL = 'https://cdn.jsdelivr.net/npm/hls.js@latest'
const WHALE_BAND_LOW_HZ = 1000
const WHALE_BAND_HIGH_HZ = 6000

const NODES: HydrophoneNode[] = [
  { id: 'port_townsend', name: 'PORT TOWNSEND', slug: 'rpi_port_townsend' },
  { id: 'sunset_bay', name: 'SUNSET BAY', slug: 'rpi_sunset_bay' },
  { id: 'north_sjc', name: 'NORTH SAN JUAN CHANNEL', slug: 'rpi_north_sjc' },
]

// -- Colormap LUT (pre-computed 256 entries x 4 channels) ------------------

const COLORMAP_ANCHORS: [number, number, number, number][] = [
  // [r, g, b, position 0-1]
  [1, 2, 8, 0],             // background — near-black with blue undertone
  [10, 4, 40, 0.15],        // deep indigo
  [12, 58, 58, 0.30],       // dark teal
  [26, 138, 122, 0.50],     // medium cyan
  [64, 232, 208, 0.70],     // bright cyan
  [232, 160, 32, 0.88],     // warm amber
  [255, 248, 240, 1.0],     // hot white
]

function buildColormapLUT(): Uint8Array {
  const lut = new Uint8Array(256 * 4)
  for (let i = 0; i < 256; i++) {
    const t = i / 255
    // Find which two anchors we're between
    let loIdx = 0
    for (let a = 0; a < COLORMAP_ANCHORS.length - 1; a++) {
      const anchor = COLORMAP_ANCHORS[a]
      const nextAnchor = COLORMAP_ANCHORS[a + 1]
      if (anchor && nextAnchor && t >= anchor[3]) {
        loIdx = a
      }
    }
    const lo = COLORMAP_ANCHORS[loIdx]
    const hi = COLORMAP_ANCHORS[Math.min(loIdx + 1, COLORMAP_ANCHORS.length - 1)]
    if (!lo || !hi) continue

    const range = hi[3] - lo[3]
    const frac = range > 0 ? (t - lo[3]) / range : 0
    // Smoothstep for nicer interpolation
    const s = frac * frac * (3 - 2 * frac)

    const offset = i * 4
    lut[offset] = Math.round(lo[0] + (hi[0] - lo[0]) * s)
    lut[offset + 1] = Math.round(lo[1] + (hi[1] - lo[1]) * s)
    lut[offset + 2] = Math.round(lo[2] + (hi[2] - lo[2]) * s)
    lut[offset + 3] = 255
  }
  return lut
}

const COLORMAP_LUT = buildColormapLUT()

// -- Logarithmic frequency mapping -----------------------------------------
// Pre-compute the mapping from pixel row to FFT bin index

function buildFreqMap(height: number, maxBin: number): Float64Array {
  // Map each pixel row to a frequency bin using log scale
  // Bottom row = low freq, top row = high freq
  const minFreq = 20  // Hz
  const maxFreq = SAMPLE_RATE / 2
  const logMin = Math.log(minFreq)
  const logMax = Math.log(maxFreq)
  const map = new Float64Array(height)

  for (let y = 0; y < height; y++) {
    // y=0 is top (high freq), y=height-1 is bottom (low freq)
    const ratio = 1 - y / (height - 1)
    const logFreq = logMin + ratio * (logMax - logMin)
    const freq = Math.exp(logFreq)
    const bin = freq / (SAMPLE_RATE / FFT_SIZE)
    map[y] = Math.min(bin, maxBin - 1)
  }
  return map
}

// -- Whale band glow row range ---------------------------------------------

function getWhaleBandRows(height: number): [number, number] {
  const minFreq = 20
  const maxFreq = SAMPLE_RATE / 2
  const logMin = Math.log(minFreq)
  const logMax = Math.log(maxFreq)

  const logLow = Math.log(WHALE_BAND_LOW_HZ)
  const logHigh = Math.log(WHALE_BAND_HIGH_HZ)

  const ratioLow = (logLow - logMin) / (logMax - logMin)
  const ratioHigh = (logHigh - logMin) / (logMax - logMin)

  // y=0 is top (high freq), so invert
  const yHigh = Math.floor((1 - ratioHigh) * (height - 1))
  const yLow = Math.floor((1 - ratioLow) * (height - 1))
  return [yHigh, yLow]
}

// -- Frequency label positions (log-scaled) --------------------------------

interface FreqLabel {
  freq: number
  text: string
  y: number
}

function buildFreqLabels(height: number): FreqLabel[] {
  const freqs = [100, 1000, 5000, 10000]
  const minFreq = 20
  const maxFreq = SAMPLE_RATE / 2
  const logMin = Math.log(minFreq)
  const logMax = Math.log(maxFreq)

  return freqs.map((freq) => {
    const ratio = (Math.log(freq) - logMin) / (logMax - logMin)
    const y = Math.floor((1 - ratio) * (height - 1))
    const text = freq >= 1000 ? `${freq / 1000}kHz` : `${freq}Hz`
    return { freq, text, y: y + MARGIN_TOP }
  })
}

// -- HLS loader -------------------------------------------------------------

declare global {
  interface Window {
    Hls?: HlsConstructor
  }
}

let hlsLoadPromise: Promise<HlsConstructor> | null = null

function loadHls(): Promise<HlsConstructor> {
  if (window.Hls) return Promise.resolve(window.Hls)
  if (hlsLoadPromise) return hlsLoadPromise

  hlsLoadPromise = new Promise<HlsConstructor>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = HLS_CDN_URL
    script.onload = () => {
      if (window.Hls) {
        resolve(window.Hls)
      } else {
        reject(new Error('hls.js loaded but Hls not found on window'))
      }
    }
    script.onerror = () => reject(new Error('Failed to load hls.js from CDN'))
    document.head.appendChild(script)
  })
  return hlsLoadPromise
}

async function fetchManifestUrl(slug: string): Promise<string> {
  const latestUrl = `${S3_BASE}/${slug}/latest.txt`
  const resp = await fetch(latestUrl)
  if (!resp.ok) throw new Error(`Failed to fetch latest.txt for ${slug}: ${resp.status}`)
  const timestamp = (await resp.text()).trim()
  return `${S3_BASE}/${slug}/hls/${timestamp}/live.m3u8`
}

// -- Font loader ------------------------------------------------------------

function loadGeistMono(): void {
  const fontFace = new FontFace(
    'Geist Mono',
    'url(https://cdn.jsdelivr.net/npm/geist@1.2.0/dist/fonts/geist-mono/GeistMono-Variable.woff2)',
    { weight: '100 900' },
  )
  fontFace.load().then((loaded) => {
    document.fonts.add(loaded)
  }).catch(() => {
    // Falls back to monospace — fine
  })
}

// -- App component -----------------------------------------------------------

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    loadGeistMono()

    const canvas = canvasRef.current
    if (!canvas) return

    const maybeCtx = canvas.getContext('2d', { alpha: false })
    if (!maybeCtx) return
    const ctx: CanvasRenderingContext2D = maybeCtx

    // -- Audio context --
    const audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE })
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => { /* autoplay policy */ })
    }

    // -- Pre-compute lookup tables --
    const maxBin = Math.floor((SAMPLE_RATE / 2) / (SAMPLE_RATE / FFT_SIZE))
    const freqMap = buildFreqMap(SPECTROGRAM_HEIGHT, maxBin)
    const freqLabels = buildFreqLabels(SPECTROGRAM_HEIGHT)
    const [whaleBandTop, whaleBandBottom] = getWhaleBandRows(SPECTROGRAM_HEIGHT)

    // -- Spectrogram buffer (pixel data for full canvas) --
    // Store as a 2D array: each column is a Uint8Array of RGBA for SPECTROGRAM_HEIGHT pixels
    const spectrogramColumns: Uint8Array[] = []
    const columnImageData = ctx.createImageData(1, SPECTROGRAM_HEIGHT)

    // -- Node states --
    const nodeStates: NodeState[] = NODES.map((node) => ({
      node,
      audio: null,
      analyser: null,
      hls: null,
      freqData: null,
      retryCount: 0,
      connected: false,
    }))

    // -- Active node tracking --
    let activeNodeIndex = 0
    let previousNodeIndex = -1
    let switchStartTime = 0
    let isCrossfading = false
    let lastSwitchTime = Date.now()

    // -- Connect all hydrophones --
    function connectNode(state: NodeState): void {
      loadHls().then((Hls) => {
        return fetchManifestUrl(state.node.slug).then((manifestUrl) => {
          const audio = document.createElement('audio')
          audio.crossOrigin = 'anonymous'
          // Only the active node should be audible; mute others
          audio.volume = state.node.id === NODES[activeNodeIndex]?.id ? 0.7 : 0

          if (Hls.isSupported()) {
            const hls = new Hls({
              liveDurationInfinity: true,
              enableWorker: true,
              lowLatencyMode: false,
              backBufferLength: 30,
              maxBufferLength: 30,
              maxMaxBufferLength: 60,
            })
            state.hls = hls
            hls.loadSource(manifestUrl)
            hls.attachMedia(audio)
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              audio.play().catch(() => { /* autoplay blocked */ })
            })
            hls.on(Hls.Events.ERROR, (...args: unknown[]) => {
              const errorData = args[1]
              if (errorData && typeof errorData === 'object' && 'fatal' in errorData && errorData.fatal) {
                hls.destroy()
                state.hls = null
                state.connected = false
                scheduleRetry(state)
              }
            })
          } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
            audio.src = manifestUrl
            audio.play().catch(() => { /* autoplay blocked */ })
          } else {
            scheduleRetry(state)
            return
          }

          const source = audioCtx.createMediaElementSource(audio)
          const analyser = audioCtx.createAnalyser()
          analyser.fftSize = FFT_SIZE
          analyser.smoothingTimeConstant = 0.3
          source.connect(analyser)
          analyser.connect(audioCtx.destination)

          state.audio = audio
          state.analyser = analyser
          state.freqData = new Uint8Array(analyser.frequencyBinCount)
          state.connected = true
          state.retryCount = 0

          audio.addEventListener('error', () => {
            state.connected = false
            scheduleRetry(state)
          })
        })
      }).catch(() => {
        scheduleRetry(state)
      })
    }

    function scheduleRetry(state: NodeState): void {
      if (state.retryCount >= MAX_RETRIES) return
      state.retryCount++
      setTimeout(() => { connectNode(state) }, RETRY_DELAY_MS)
    }

    for (const state of nodeStates) {
      connectNode(state)
    }

    // -- Manage audio volumes for node switching --
    function updateAudioVolumes(fadeProgress: number): void {
      for (let i = 0; i < nodeStates.length; i++) {
        const state = nodeStates[i]
        if (!state || !state.audio) continue
        if (isCrossfading) {
          if (i === activeNodeIndex) {
            state.audio.volume = fadeProgress * 0.7
          } else if (i === previousNodeIndex) {
            state.audio.volume = (1 - fadeProgress) * 0.7
          } else {
            state.audio.volume = 0
          }
        } else {
          state.audio.volume = i === activeNodeIndex ? 0.7 : 0
        }
      }
    }

    // -- Render a single spectrogram column from FFT data --
    function renderColumn(freqData: Uint8Array<ArrayBufferLike>): Uint8Array {
      const pixels = new Uint8Array(SPECTROGRAM_HEIGHT * 4)

      for (let y = 0; y < SPECTROGRAM_HEIGHT; y++) {
        const binFloat = freqMap[y]
        if (binFloat === undefined) continue

        // Interpolate between adjacent bins for smoother rendering
        const binLo = Math.floor(binFloat)
        const binHi = Math.min(binLo + 1, freqData.length - 1)
        const frac = binFloat - binLo
        const valLo = freqData[binLo]
        const valHi = freqData[binHi]
        if (valLo === undefined || valHi === undefined) continue

        const rawVal = valLo + (valHi - valLo) * frac
        const normalized = rawVal / 255

        // Apply noise floor and power curve
        const withFloor = NOISE_FLOOR + normalized * (1 - NOISE_FLOOR)
        const shaped = Math.pow(withFloor, POWER_CURVE)

        // Clamp to 0-255 for LUT lookup
        const lutIndex = Math.min(255, Math.max(0, Math.round(shaped * 255)))
        const lutOffset = lutIndex * 4

        const offset = y * 4
        pixels[offset] = COLORMAP_LUT[lutOffset] ?? 0
        pixels[offset + 1] = COLORMAP_LUT[lutOffset + 1] ?? 0
        pixels[offset + 2] = COLORMAP_LUT[lutOffset + 2] ?? 0
        pixels[offset + 3] = 255
      }

      return pixels
    }

    // -- Blend two columns (for crossfade) --
    function blendColumns(colA: Uint8Array, colB: Uint8Array, t: number): Uint8Array {
      const result = new Uint8Array(colA.length)
      const invT = 1 - t
      for (let i = 0; i < colA.length; i++) {
        const a = colA[i]
        const b = colB[i]
        if (a !== undefined && b !== undefined) {
          result[i] = Math.round(a * invT + b * t)
        }
      }
      return result
    }

    // -- Vignette (pre-rendered as ImageData) --
    const vignetteCanvas = document.createElement('canvas')
    vignetteCanvas.width = WIDTH
    vignetteCanvas.height = HEIGHT
    const vignetteCtx = vignetteCanvas.getContext('2d')
    if (vignetteCtx) {
      const cx = WIDTH / 2
      const cy = HEIGHT / 2
      const maxR = Math.sqrt(cx * cx + cy * cy)
      const grad = vignetteCtx.createRadialGradient(cx, cy, maxR * 0.3, cx, cy, maxR)
      grad.addColorStop(0, 'rgba(0,0,0,0)')
      grad.addColorStop(1, 'rgba(0,0,0,0.4)')
      vignetteCtx.fillStyle = grad
      vignetteCtx.fillRect(0, 0, WIDTH, HEIGHT)
    }

    // -- Scanline pattern (pre-rendered) --
    const scanlineCanvas = document.createElement('canvas')
    scanlineCanvas.width = WIDTH
    scanlineCanvas.height = HEIGHT
    const scanlineCtx = scanlineCanvas.getContext('2d')
    if (scanlineCtx) {
      scanlineCtx.fillStyle = 'rgba(0,0,0,0.035)'
      for (let y = 0; y < HEIGHT; y += 2) {
        scanlineCtx.fillRect(0, y, WIDTH, 1)
      }
    }

    // -- Frame timing --
    let animationId = 0

    function tick(_timestamp: number): void {
      animationId = requestAnimationFrame(tick)

      const now = Date.now()

      // -- Node switching logic --
      if (now - lastSwitchTime > NODE_SWITCH_INTERVAL && !isCrossfading) {
        previousNodeIndex = activeNodeIndex
        activeNodeIndex = (activeNodeIndex + 1) % NODES.length
        switchStartTime = now
        isCrossfading = true
        lastSwitchTime = now
      }

      let crossfadeProgress = 1
      if (isCrossfading) {
        crossfadeProgress = Math.min(1, (now - switchStartTime) / CROSSFADE_DURATION)
        if (crossfadeProgress >= 1) {
          isCrossfading = false
          previousNodeIndex = -1
        }
      }

      updateAudioVolumes(crossfadeProgress)

      // -- Capture FFT from active node --
      const activeState = nodeStates[activeNodeIndex]
      if (activeState && activeState.analyser && activeState.connected && activeState.freqData) {
        activeState.analyser.getByteFrequencyData(activeState.freqData)
        const newCol = renderColumn(activeState.freqData)

        // During crossfade, blend with previous node's data
        if (isCrossfading && previousNodeIndex >= 0) {
          const prevState = nodeStates[previousNodeIndex]
          if (prevState && prevState.analyser && prevState.connected && prevState.freqData) {
            prevState.analyser.getByteFrequencyData(prevState.freqData)
            const prevCol = renderColumn(prevState.freqData)
            const blended = blendColumns(prevCol, newCol, crossfadeProgress)
            spectrogramColumns.push(blended)
          } else {
            spectrogramColumns.push(newCol)
          }
        } else {
          spectrogramColumns.push(newCol)
        }

        // Keep buffer at canvas width
        while (spectrogramColumns.length > WIDTH) {
          spectrogramColumns.shift()
        }
      }

      // -- Render --
      // Fill background
      ctx.fillStyle = '#010208'
      ctx.fillRect(0, 0, WIDTH, HEIGHT)

      // Draw spectrogram — one column at a time using putImageData
      const colCount = spectrogramColumns.length
      if (colCount > 0) {
        // Columns scroll right-to-left: newest on right, oldest on left
        const startX = WIDTH - colCount

        for (let c = 0; c < colCount; c++) {
          const col = spectrogramColumns[c]
          if (!col) continue

          // Copy pixel data into the ImageData buffer
          const imgData = columnImageData.data
          for (let y = 0; y < SPECTROGRAM_HEIGHT; y++) {
            const srcOff = y * 4
            const dstOff = y * 4
            imgData[dstOff] = col[srcOff] ?? 0
            imgData[dstOff + 1] = col[srcOff + 1] ?? 0
            imgData[dstOff + 2] = col[srcOff + 2] ?? 0
            imgData[dstOff + 3] = 255
          }

          ctx.putImageData(columnImageData, startX + c, MARGIN_TOP)
        }
      }

      // -- Whale band glow: subtle brightness in the 1-6kHz range --
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      const whaleBandHeight = whaleBandBottom - whaleBandTop
      const whaleBandY = whaleBandTop + MARGIN_TOP
      const whaleGlow = ctx.createLinearGradient(0, whaleBandY, 0, whaleBandY + whaleBandHeight)
      whaleGlow.addColorStop(0, 'rgba(64, 232, 208, 0)')
      whaleGlow.addColorStop(0.3, 'rgba(64, 232, 208, 0.012)')
      whaleGlow.addColorStop(0.5, 'rgba(64, 232, 208, 0.018)')
      whaleGlow.addColorStop(0.7, 'rgba(64, 232, 208, 0.012)')
      whaleGlow.addColorStop(1, 'rgba(64, 232, 208, 0)')
      ctx.fillStyle = whaleGlow
      ctx.fillRect(0, whaleBandY, WIDTH, whaleBandHeight)
      ctx.restore()

      // -- Post-processing overlays --
      // Vignette
      ctx.drawImage(vignetteCanvas, 0, 0)
      // Scanlines
      ctx.drawImage(scanlineCanvas, 0, 0)

      // -- Typography --
      const fontFamily = '\'Geist Mono\', monospace'

      // Title: DEEP LISTEN
      ctx.font = `600 16px ${fontFamily}`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.letterSpacing = '6px'
      // Dark background behind title
      const titleMetrics = ctx.measureText('DEEP LISTEN')
      const titleW = titleMetrics.width + 8
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
      ctx.fillRect(34, 35, titleW + 12, 24)
      ctx.fillStyle = 'rgba(160, 220, 230, 0.85)'
      ctx.fillText('DEEP LISTEN', 40, 38)
      ctx.letterSpacing = '0px'

      // Current node name
      const activeNode = NODES[activeNodeIndex]
      if (activeNode) {
        ctx.font = `500 12px ${fontFamily}`
        const nodeMetrics = ctx.measureText(activeNode.name)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
        ctx.fillRect(34, 61, nodeMetrics.width + 12, 18)
        ctx.fillStyle = 'rgba(160, 220, 230, 0.75)'
        ctx.fillText(activeNode.name, 40, 64)
      }

      // Frequency markers on left edge
      ctx.font = `500 13px ${fontFamily}`
      ctx.textBaseline = 'middle'
      for (const label of freqLabels) {
        if (label.y > MARGIN_TOP + 10 && label.y < HEIGHT - MARGIN_BOTTOM - 10) {
          // Dark background behind frequency label
          const labelMetrics = ctx.measureText(label.text)
          ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
          ctx.fillRect(2, label.y - 9, labelMetrics.width + 12, 18)
          ctx.fillStyle = 'rgba(160, 220, 230, 0.80)'
          ctx.fillText(label.text, 8, label.y)
          // Tick mark extending into spectrogram
          ctx.beginPath()
          ctx.strokeStyle = 'rgba(160, 220, 230, 0.35)'
          ctx.lineWidth = 1
          ctx.moveTo(0, label.y)
          ctx.lineTo(labelMetrics.width + 18, label.y)
          ctx.stroke()
        }
      }

      // UTC time — bottom right
      const utcNow = new Date()
      const timeStr = utcNow.toISOString().slice(11, 19) + ' UTC'
      ctx.font = `500 12px ${fontFamily}`
      ctx.textAlign = 'right'
      ctx.textBaseline = 'bottom'
      // Dark background behind UTC time
      const timeMetrics = ctx.measureText(timeStr)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
      ctx.fillRect(WIDTH - 46 - timeMetrics.width, HEIGHT - 56, timeMetrics.width + 12, 20)
      ctx.fillStyle = 'rgba(160, 220, 230, 0.80)'
      ctx.fillText(timeStr, WIDTH - 40, HEIGHT - 40)
      ctx.textAlign = 'left'
    }

    animationId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(animationId)
      for (const state of nodeStates) {
        if (state.hls) state.hls.destroy()
        if (state.audio) {
          state.audio.pause()
          state.audio.src = ''
        }
      }
      if (audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => { /* ignore */ })
      }
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={WIDTH}
      height={HEIGHT}
      style={{
        display: 'block',
        width: '100vw',
        height: '100vh',
        background: '#010208',
      }}
    />
  )
}
