let worker: Worker | null = null
let ready = false
let loading = false
let audioContext: AudioContext | null = null
let currentSource: AudioBufferSourceNode | null = null
let currentDuration = 0
let onSpeakingStart: (() => void) | null = null
let onSpeakingEnd: (() => void) | null = null
let generateIdCounter = 0
const pendingGenerations = new Map<string, {
  resolve: (duration: number) => void
  reject: (err: Error) => void
}>()

export function onTTSSpeakingStart(cb: () => void): void {
  onSpeakingStart = cb
}

export function onTTSSpeakingEnd(cb: () => void): void {
  onSpeakingEnd = cb
}

export async function initTTS(): Promise<boolean> {
  if (ready) return true
  if (loading) return false
  loading = true

  try {
    const hasWebGPU = typeof navigator !== 'undefined'
      && 'gpu' in navigator
      && (await navigator.gpu?.requestAdapter()) !== null

    const device = hasWebGPU ? 'webgpu' : 'wasm'
    const dtype = hasWebGPU ? 'fp32' : 'q8'

    console.log(`Kokoro TTS: initializing worker with ${device}`)

    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })

    const readyPromise = new Promise<boolean>((resolve, reject) => {
      if (!worker) {
        reject(new Error('Worker not created'))
        return
      }
      worker.addEventListener('message', function onMessage(event: MessageEvent<{ type: string, message?: string }>) {
        if (event.data.type === 'ready') {
          worker?.removeEventListener('message', onMessage)
          resolve(true)
        } else if (event.data.type === 'error') {
          worker?.removeEventListener('message', onMessage)
          reject(new Error(event.data.message ?? 'Unknown worker error'))
        }
      })
    })

    worker.addEventListener('message', handleWorkerMessage)
    worker.postMessage({ type: 'init', device, dtype })

    await readyPromise

    audioContext = new AudioContext({ sampleRate: 24000 })
    ready = true
    console.log('Kokoro TTS: worker ready')
    return true
  } catch (err) {
    console.error('Kokoro TTS init failed:', err)
    loading = false
    return false
  }
}

function handleWorkerMessage(event: MessageEvent<{ type: string, id?: string, buffer?: ArrayBuffer, message?: string }>): void {
  const msg = event.data
  if (msg.type === 'audio' && msg.id && msg.buffer) {
    const pending = pendingGenerations.get(msg.id)
    if (pending) {
      pendingGenerations.delete(msg.id)
      void playAudio(msg.buffer, pending.resolve, pending.reject)
    }
  } else if (msg.type === 'error' && msg.message) {
    // Reject all pending generations on error
    for (const [id, pending] of pendingGenerations) {
      pending.reject(new Error(msg.message))
      pendingGenerations.delete(id)
    }
  }
}

async function playAudio(
  buffer: ArrayBuffer,
  resolve: (duration: number) => void,
  reject: (err: Error) => void,
): Promise<void> {
  if (!audioContext) {
    resolve(0)
    return
  }

  stopSpeaking()

  try {
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }

    const audioBuffer = await audioContext.decodeAudioData(buffer)
    const source = audioContext.createBufferSource()
    source.buffer = audioBuffer
    source.connect(audioContext.destination)

    currentDuration = audioBuffer.duration

    source.onended = () => {
      currentSource = null
      currentDuration = 0
      onSpeakingEnd?.()
    }

    currentSource = source
    onSpeakingStart?.()
    source.start()
    resolve(audioBuffer.duration)
  } catch (err) {
    console.error('Kokoro TTS playback failed:', err)
    onSpeakingEnd?.()
    reject(err instanceof Error ? err : new Error(String(err)))
  }
}

export function speak(text: string): Promise<number> {
  if (!worker || !ready || !audioContext) {
    return Promise.resolve(0)
  }

  stopSpeaking()

  const id = String(++generateIdCounter)

  return new Promise<number>((resolve, reject) => {
    pendingGenerations.set(id, { resolve, reject })
    worker?.postMessage({ type: 'generate', id, text })
  })
}

export function getAudioDuration(): number {
  return currentDuration
}

export function stopSpeaking(): void {
  if (currentSource) {
    try {
      currentSource.stop()
    } catch {
      // already stopped
    }
    currentSource = null
    currentDuration = 0
  }
}

export function isReady(): boolean {
  return ready
}
