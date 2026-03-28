import { KokoroTTS } from 'kokoro-js'

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX'
const VOICE = 'af_heart'

interface InitMessage {
  type: 'init'
  device: string
  dtype: string
}

interface GenerateMessage {
  type: 'generate'
  id: string
  text: string
}

type WorkerMessage = InitMessage | GenerateMessage

let tts: KokoroTTS | null = null

self.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
  const msg = event.data
  if (msg.type === 'init') {
    void handleInit(msg)
  } else if (msg.type === 'generate') {
    void handleGenerate(msg)
  }
})

async function handleInit(msg: InitMessage): Promise<void> {
  try {
    tts = await KokoroTTS.from_pretrained(MODEL_ID, {
      dtype: msg.dtype === 'fp32' ? 'fp32' : msg.dtype === 'fp16' ? 'fp16' : 'q8',
      device: msg.device === 'webgpu' ? 'webgpu' : 'wasm',
    })
    self.postMessage({ type: 'ready' })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    self.postMessage({ type: 'error', message })
  }
}

async function handleGenerate(msg: GenerateMessage): Promise<void> {
  if (!tts) {
    self.postMessage({ type: 'error', message: 'TTS not initialized' })
    return
  }
  try {
    const result = await tts.generate(msg.text, { voice: VOICE })
    const blob = await result.toBlob()
    const buffer = await blob.arrayBuffer()
    self.postMessage({ type: 'audio', id: msg.id, buffer }, { transfer: [buffer] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    self.postMessage({ type: 'error', message })
  }
}
