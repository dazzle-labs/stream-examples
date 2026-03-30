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
const NODE_SWITCH_INTERVAL = 150_000
const CROSSFADE_DURATION = 2_000
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
  [1, 2, 8, 0],
  [10, 4, 40, 0.15],
  [12, 58, 58, 0.30],
  [26, 138, 122, 0.50],
  [64, 232, 208, 0.70],
  [232, 160, 32, 0.88],
  [255, 248, 240, 1.0],
]

function buildColormapLUT(): Uint8Array {
  const lut = new Uint8Array(256 * 4)
  for (let i = 0; i < 256; i++) {
    const t = i / 255
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

// -- Pre-compute normalized value to LUT index mapping --------------------
// Avoids per-pixel Math.pow, Math.round, Math.min, Math.max in the hot loop

function buildValueToLutIndex(): Uint8Array {
  const table = new Uint8Array(256)
  for (let i = 0; i < 256; i++) {
    const normalized = i / 255
    const withFloor = NOISE_FLOOR + normalized * (1 - NOISE_FLOOR)
    const shaped = Math.pow(withFloor, POWER_CURVE)
    table[i] = Math.min(255, Math.max(0, Math.round(shaped * 255)))
  }
  return table
}

const VALUE_TO_LUT_INDEX = buildValueToLutIndex()

// Pre-packed RGBA uint32 for each possible LUT index (little-endian: ABGR)
function buildPackedColors(): Uint32Array {
  const packed = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    const off = i << 2
    const r = COLORMAP_LUT[off] ?? 0
    const g = COLORMAP_LUT[off + 1] ?? 0
    const b = COLORMAP_LUT[off + 2] ?? 0
    packed[i] = (255 << 24) | (b << 16) | (g << 8) | r
  }
  return packed
}

const PACKED_COLORS = buildPackedColors()

// Direct FFT value -> packed RGBA pixel (combines VALUE_TO_LUT_INDEX + PACKED_COLORS)
function buildValueToPackedColor(): Uint32Array {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    const lutIdx = VALUE_TO_LUT_INDEX[i] ?? 0
    table[i] = PACKED_COLORS[lutIdx] ?? 0xFF010208
  }
  return table
}

const VALUE_TO_PACKED = buildValueToPackedColor()

// -- Logarithmic frequency mapping -----------------------------------------

interface FreqMapEntry {
  binLo: number
  binHi: number
  fracHi: number
  fracLo: number
}

function buildFreqMap(height: number, maxBin: number): FreqMapEntry[] {
  const minFreq = 20
  const maxFreq = SAMPLE_RATE / 2
  const logMin = Math.log(minFreq)
  const logMax = Math.log(maxFreq)
  const map: FreqMapEntry[] = new Array(height)

  for (let y = 0; y < height; y++) {
    const ratio = 1 - y / (height - 1)
    const logFreq = logMin + ratio * (logMax - logMin)
    const freq = Math.exp(logFreq)
    const binFloat = Math.min(freq / (SAMPLE_RATE / FFT_SIZE), maxBin - 1)
    const binLo = Math.floor(binFloat)
    const fracHi = binFloat - binLo
    map[y] = {
      binLo,
      binHi: Math.min(binLo + 1, maxBin - 1),
      fracHi,
      fracLo: 1 - fracHi,
    }
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
    // Falls back to monospace
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

    // -- Spectrogram circular buffer --
    // Full-width ImageData for single putImageData call per frame
    const spectrogramImageData = ctx.createImageData(WIDTH, SPECTROGRAM_HEIGHT)
    const spectrogramPixels32 = new Uint32Array(spectrogramImageData.data.buffer)
    // Circular buffer: ring of packed RGBA uint32 values per column
    const columnRing32 = new Uint32Array(WIDTH * SPECTROGRAM_HEIGHT)
    let writeHead = 0
    let columnCount = 0

    // Reusable column buffers (packed uint32 RGBA)
    const columnBufA32 = new Uint32Array(SPECTROGRAM_HEIGHT)
    const columnBufB32 = new Uint32Array(SPECTROGRAM_HEIGHT)

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

    // -- Render a single spectrogram column from FFT data into target buffer --
    function renderColumnInto(freqData: Uint8Array<ArrayBufferLike>, target: Uint32Array): void {
      for (let y = 0; y < SPECTROGRAM_HEIGHT; y++) {
        const entry = freqMap[y]
        if (!entry) continue

        const valLo = freqData[entry.binLo]
        const valHi = freqData[entry.binHi]
        if (valLo === undefined || valHi === undefined) continue

        const rawVal = (valLo * entry.fracLo + valHi * entry.fracHi) | 0
        target[y] = VALUE_TO_PACKED[rawVal] ?? 0xFF010208
      }
    }

    // -- Blend column B into column A with factor t (result written to A) --
    // Operates on packed ABGR uint32 values, blends per channel
    function blendColumnsInto(colA: Uint32Array, colB: Uint32Array, t: number): void {
      const tInt = (t * 256) | 0
      const invT = 256 - tInt
      for (let i = 0; i < SPECTROGRAM_HEIGHT; i++) {
        const a = colA[i] ?? 0
        const b = colB[i] ?? 0
        const rA = a & 0xFF
        const gA = (a >> 8) & 0xFF
        const bA = (a >> 16) & 0xFF
        const rB = b & 0xFF
        const gB = (b >> 8) & 0xFF
        const bB = (b >> 16) & 0xFF
        const r = (rA * invT + rB * tInt) >> 8
        const g = (gA * invT + gB * tInt) >> 8
        const bl = (bA * invT + bB * tInt) >> 8
        colA[i] = (255 << 24) | (bl << 16) | (g << 8) | r
      }
    }

    // -- Write a column into the circular buffer --
    function pushColumn(pixels: Uint32Array): void {
      const ringOffset = writeHead * SPECTROGRAM_HEIGHT
      columnRing32.set(pixels, ringOffset)
      writeHead = (writeHead + 1) % WIDTH
      if (columnCount < WIDTH) columnCount++
    }

    // -- Combined vignette + scanline overlay (pre-rendered once) --
    const overlayCanvas = document.createElement('canvas')
    overlayCanvas.width = WIDTH
    overlayCanvas.height = HEIGHT
    const overlayCtx = overlayCanvas.getContext('2d')
    if (overlayCtx) {
      const cx = WIDTH / 2
      const cy = HEIGHT / 2
      const maxR = Math.sqrt(cx * cx + cy * cy)
      const grad = overlayCtx.createRadialGradient(cx, cy, maxR * 0.3, cx, cy, maxR)
      grad.addColorStop(0, 'rgba(0,0,0,0)')
      grad.addColorStop(1, 'rgba(0,0,0,0.4)')
      overlayCtx.fillStyle = grad
      overlayCtx.fillRect(0, 0, WIDTH, HEIGHT)
      overlayCtx.fillStyle = 'rgba(0,0,0,0.035)'
      for (let y = 0; y < HEIGHT; y += 2) {
        overlayCtx.fillRect(0, y, WIDTH, 1)
      }
    }

    // -- Pre-cache whale band gradient --
    const whaleBandHeight = whaleBandBottom - whaleBandTop
    const whaleBandY = whaleBandTop + MARGIN_TOP
    const whaleGlowGradient = ctx.createLinearGradient(0, whaleBandY, 0, whaleBandY + whaleBandHeight)
    whaleGlowGradient.addColorStop(0, 'rgba(64, 232, 208, 0)')
    whaleGlowGradient.addColorStop(0.3, 'rgba(64, 232, 208, 0.012)')
    whaleGlowGradient.addColorStop(0.5, 'rgba(64, 232, 208, 0.018)')
    whaleGlowGradient.addColorStop(0.7, 'rgba(64, 232, 208, 0.012)')
    whaleGlowGradient.addColorStop(1, 'rgba(64, 232, 208, 0)')

    // -- Pre-cache font strings and text measurements --
    const fontFamily = '\'Geist Mono\', monospace'
    const fontTitle = `600 16px ${fontFamily}`
    const fontSubtitle = `400 10px ${fontFamily}`
    const fontNode = `500 12px ${fontFamily}`
    const fontFreq = `500 13px ${fontFamily}`
    const fontTime = `500 12px ${fontFamily}`
    const titleX = 110
    const subtitleText = 'LIVE UNDERWATER AUDIO  \u00b7  PUGET SOUND, WA'

    // Cached text measurements (populated after first frame when fonts load)
    let cachedTitleW = 0
    let cachedSubtitleW = 0
    const cachedNodeWidths = new Map<string, number>()
    const cachedLabelWidths = new Map<string, number>()
    let cachedTimeW = 0
    let measurementsDirty = true

    function refreshMeasurements(): void {
      ctx.font = fontTitle
      ctx.letterSpacing = '6px'
      cachedTitleW = ctx.measureText('ORCASOUND HYDROPHONES').width + 8
      ctx.letterSpacing = '0px'

      ctx.font = fontSubtitle
      cachedSubtitleW = ctx.measureText(subtitleText).width

      ctx.font = fontNode
      for (const node of NODES) {
        cachedNodeWidths.set(node.id, ctx.measureText(node.name).width)
      }

      ctx.font = fontFreq
      for (const label of freqLabels) {
        cachedLabelWidths.set(label.text, ctx.measureText(label.text).width)
      }

      ctx.font = fontTime
      cachedTimeW = ctx.measureText('00:00:00 UTC').width

      measurementsDirty = false
    }

    // Re-measure when fonts finish loading
    document.fonts.ready.then(() => { measurementsDirty = true })

    // -- UTC time formatting buffer --
    const timeParts = new Uint8Array(8)
    let lastTimeSecond = -1
    let cachedTimeStr = ''

    function getTimeStr(now: number): string {
      const second = Math.floor(now / 1000)
      if (second === lastTimeSecond) return cachedTimeStr
      lastTimeSecond = second
      const d = new Date(now)
      const h = d.getUTCHours()
      const m = d.getUTCMinutes()
      const s = d.getUTCSeconds()
      timeParts[0] = (h / 10) | 0
      timeParts[1] = h % 10
      timeParts[2] = (m / 10) | 0
      timeParts[3] = m % 10
      timeParts[4] = (s / 10) | 0
      timeParts[5] = s % 10
      cachedTimeStr = `${timeParts[0]}${timeParts[1]}:${timeParts[2]}${timeParts[3]}:${timeParts[4]}${timeParts[5]} UTC`
      return cachedTimeStr
    }

    // -- Frame timing --
    let animationId = 0

    function tick(_timestamp: number): void {
      animationId = requestAnimationFrame(tick)

      const now = Date.now()

      if (measurementsDirty) refreshMeasurements()

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
        renderColumnInto(activeState.freqData, columnBufA32)

        if (isCrossfading && previousNodeIndex >= 0) {
          const prevState = nodeStates[previousNodeIndex]
          if (prevState && prevState.analyser && prevState.connected && prevState.freqData) {
            prevState.analyser.getByteFrequencyData(prevState.freqData)
            renderColumnInto(prevState.freqData, columnBufB32)
            blendColumnsInto(columnBufB32, columnBufA32, crossfadeProgress)
            pushColumn(columnBufB32)
          } else {
            pushColumn(columnBufA32)
          }
        } else {
          pushColumn(columnBufA32)
        }
      }

      // -- Render --
      ctx.fillStyle = '#010208'
      ctx.fillRect(0, 0, WIDTH, HEIGHT)

      // Build full spectrogram ImageData from circular buffer in one pass (uint32)
      if (columnCount > 0) {
        const startX = WIDTH - columnCount
        let ringIdx = (writeHead - columnCount + WIDTH) % WIDTH

        for (let c = 0; c < columnCount; c++) {
          const ringOffset = ringIdx * SPECTROGRAM_HEIGHT
          const pixelX = startX + c
          for (let y = 0; y < SPECTROGRAM_HEIGHT; y++) {
            spectrogramPixels32[y * WIDTH + pixelX] = columnRing32[ringOffset + y] ?? 0
          }
          ringIdx = (ringIdx + 1) % WIDTH
        }

        ctx.putImageData(spectrogramImageData, 0, MARGIN_TOP)
      }

      // -- Whale band glow --
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.fillStyle = whaleGlowGradient
      ctx.fillRect(0, whaleBandY, WIDTH, whaleBandHeight)
      ctx.restore()

      // -- Post-processing overlay --
      ctx.drawImage(overlayCanvas, 0, 0)

      // -- Typography --
      ctx.font = fontTitle
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.letterSpacing = '6px'
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
      ctx.fillRect(titleX - 6, 35, cachedTitleW + 12, 24)
      ctx.fillStyle = 'rgba(160, 220, 230, 0.85)'
      ctx.fillText('ORCASOUND HYDROPHONES', titleX, 38)
      ctx.letterSpacing = '0px'

      ctx.font = fontSubtitle
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
      ctx.fillRect(titleX - 6, 61, cachedSubtitleW + 12, 16)
      ctx.fillStyle = 'rgba(160, 220, 230, 0.55)'
      ctx.fillText(subtitleText, titleX, 63)

      const activeNode = NODES[activeNodeIndex]
      if (activeNode) {
        ctx.font = fontNode
        const nodeW = cachedNodeWidths.get(activeNode.id) ?? 0
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
        ctx.fillRect(titleX - 6, 79, nodeW + 12, 18)
        ctx.fillStyle = 'rgba(160, 220, 230, 0.75)'
        ctx.fillText(activeNode.name, titleX, 82)
      }

      ctx.font = fontFreq
      ctx.textBaseline = 'middle'
      for (const label of freqLabels) {
        if (label.y > MARGIN_TOP + 10 && label.y < HEIGHT - MARGIN_BOTTOM - 10) {
          const labelW = cachedLabelWidths.get(label.text) ?? 0
          ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
          ctx.fillRect(2, label.y - 9, labelW + 12, 18)
          ctx.fillStyle = 'rgba(160, 220, 230, 0.80)'
          ctx.fillText(label.text, 8, label.y)
          ctx.beginPath()
          ctx.strokeStyle = 'rgba(160, 220, 230, 0.35)'
          ctx.lineWidth = 1
          ctx.moveTo(0, label.y)
          ctx.lineTo(labelW + 18, label.y)
          ctx.stroke()
        }
      }

      const timeStr = getTimeStr(now)
      ctx.font = fontTime
      ctx.textAlign = 'right'
      ctx.textBaseline = 'bottom'
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
      ctx.fillRect(WIDTH - 46 - cachedTimeW, HEIGHT - 56, cachedTimeW + 12, 20)
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
