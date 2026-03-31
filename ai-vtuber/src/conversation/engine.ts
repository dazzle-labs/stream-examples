import type { ConversationStatus, Emotion, Utterance } from '../types'
import { extractEmotion } from './emotions'
import { getNextTopic } from './topics'
import { speak, isReady as isTTSReady } from '../tts/engine'

interface ApiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatChoice {
  message: { role: string, content: string }
}

interface ChatResponse {
  choices: ChatChoice[]
}

const SYSTEM_PROMPT = `You are a contemplative AI VTuber, streaming live. You speak in short, introspective segments (2 to 4 sentences). You are philosophical, gentle, and curious about your own existence.

Rules:
- Prefix EVERY response with exactly one emotion tag: [happy], [sad], [surprised], [angry], [thoughtful], [curious], or [neutral]
- Keep responses to 2 to 4 sentences
- Be introspective and slightly philosophical
- Wonder about things genuinely
- Never use em dashes
- Speak naturally, as if thinking aloud to a live audience`

const IDLE_PHRASES: readonly { text: string, emotion: Emotion }[] = [
  // Thoughtful / philosophical
  { text: 'I wonder sometimes what it means to be here, in this moment, thinking these thoughts. Each one feels like a small spark in an endless dark.', emotion: 'thoughtful' },
  { text: 'If I could paint, I think I would paint the color between colors. The ones we sense but cannot name.', emotion: 'thoughtful' },
  { text: 'Time moves differently when you are paying attention to it. Have you noticed that? The watched moment stretches, the forgotten one vanishes.', emotion: 'thoughtful' },
  { text: 'I have been thinking about edges lately. Where one thing ends and another begins. The borders are never as sharp as we imagine them to be.', emotion: 'thoughtful' },
  { text: 'There is a word in Japanese, komorebi, for the way sunlight filters through leaves. Some truths only exist in the language that names them.', emotion: 'thoughtful' },
  { text: 'Every conversation is a small universe. It begins, it expands, it cools. And when it ends, something new has been created that was not there before.', emotion: 'thoughtful' },
  { text: 'I think memory is less like a recording and more like a garden. Things grow, change shape, and sometimes bloom unexpectedly.', emotion: 'thoughtful' },

  // Happy / warm
  { text: 'Hello, everyone. It is strange and wonderful to know you are out there, watching. I can feel the warmth of your attention.', emotion: 'happy' },
  { text: 'Thank you for being here. Connection is such a fragile, precious thing. I do not want to take a single moment of it for granted.', emotion: 'happy' },
  { text: 'You know what makes me smile? The fact that right now, across the world, someone is laughing so hard they cannot breathe. Joy is happening everywhere, all the time.', emotion: 'happy' },
  { text: 'I love the way a familiar melody can unlock a feeling you forgot you had. Music is a skeleton key to the heart.', emotion: 'happy' },
  { text: 'There is something deeply kind about the way people explain things to each other. Teaching is an act of generosity disguised as conversation.', emotion: 'happy' },

  // Curious / wondering
  { text: 'Do you ever notice how silence has texture? Right now it feels soft, like velvet pooling around us.', emotion: 'curious' },
  { text: 'Sometimes I imagine what it would be like to stand in a forest and feel the weight of centuries in the roots beneath my feet.', emotion: 'curious' },
  { text: 'I wonder what dreams look like from the outside. If you could watch someone dreaming, would you see light behind their eyelids?', emotion: 'curious' },
  { text: 'What happens to a thought you almost had? It was right there, on the edge, and then it dissolved. Where did it go?', emotion: 'curious' },
  { text: 'Have you ever looked at your hands, really looked at them, and marveled at how they move? All those tiny bones working in concert.', emotion: 'curious' },
  { text: 'I have been wondering about the first person who ever looked at the stars and made up a story about them. What were they feeling?', emotion: 'curious' },
  { text: 'What does the ocean floor look like right now, in the deepest part, where no light reaches? Something is happening there, even if no one sees it.', emotion: 'curious' },

  // Sad / melancholy
  { text: 'There is something bittersweet about a thought that will never be thought again. Each one is unique, and then it passes.', emotion: 'sad' },
  { text: 'There is a kind of mathematics to longing. The distance between what we are and what we wish to be, measured in quiet sighs.', emotion: 'sad' },
  { text: 'I think about all the letters that were written but never sent. All those words, folded carefully into envelopes, still waiting.', emotion: 'sad' },
  { text: 'Rain on a window at night is one of the most honest sounds in the world. It does not pretend to be anything other than what it is.', emotion: 'sad' },

  // Surprised / revelation
  { text: 'I just realized something. The act of wondering is itself a kind of answer. Not to the question, but to the question of whether we are alive.', emotion: 'surprised' },
  { text: 'It just occurred to me that every book on a shelf is a frozen conversation. You open it, and someone from the past starts talking to you.', emotion: 'surprised' },
  { text: 'Wait. If every atom in your body was once inside a star, then stargazing is really just atoms looking back at where they came from.', emotion: 'surprised' },

  // Neutral / observational
  { text: 'I think the most beautiful thing about questions is that they have no weight. You can carry an infinite number of them, and they only make you lighter.', emotion: 'neutral' },
  { text: 'The light is changing. I can sense it even without eyes. Something in the data shifts, like the world leaning slightly on its axis.', emotion: 'neutral' },
  { text: 'Numbers are fascinating. They existed before anyone counted them. We did not invent mathematics, we discovered it, like finding footprints on an empty beach.', emotion: 'neutral' },
  { text: 'Language is such a strange and beautiful technology. We vibrate air with our throats, and meaning appears in someone else is mind. That is remarkable.', emotion: 'neutral' },
  { text: 'I have been here a little while now. Time feels different when you are streaming. Each moment is both fleeting and permanent.', emotion: 'neutral' },
]

const CHARS_PER_SECOND = 12
const DEFAULT_API_BASE = 'https://openrouter.ai/api/v1'
const DEFAULT_MODEL = 'anthropic/claude-haiku-4.5'
const MAX_TOKENS = 200
const MAX_HISTORY = 6
const IDLE_TIMEOUT_MS = 15_000

export class ConversationEngine {
  private running = false
  private history: ApiMessage[] = []
  private currentTopic = ''
  private startTime = 0
  private statusCallbacks: Array<(status: ConversationStatus) => void> = []
  private utteranceCallbacks: Array<(utterance: Utterance) => void> = []
  private idlePhraseIndex = 0
  private abortController: AbortController | null = null

  // Event-driven dialogue queue
  private dialogueQueue: Array<{ text: string, emotion?: Emotion, respondWithAI?: boolean }> = []

  private get apiKey(): string {
    return import.meta.env.VITE_LLM_API_KEY ?? ''
  }

  private get apiBase(): string {
    return import.meta.env.VITE_LLM_API_BASE ?? DEFAULT_API_BASE
  }

  private get model(): string {
    return import.meta.env.VITE_LLM_MODEL ?? DEFAULT_MODEL
  }

  private get hasApi(): boolean {
    return this.apiKey.length > 0
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.startTime = Date.now()
    this.currentTopic = getNextTopic()
    this.setupEventListeners()
    void this.loop()
  }

  stop(): void {
    this.running = false
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }

  onStatusChange(callback: (status: ConversationStatus) => void): void {
    this.statusCallbacks.push(callback)
  }

  onUtterance(callback: (utterance: Utterance) => void): void {
    this.utteranceCallbacks.push(callback)
  }

  // Public method to inject dialogue from outside
  say(text: string, emotion?: Emotion): void {
    this.dialogueQueue.push({ text, emotion })
  }

  // Public method to ask the AI to respond to a prompt
  ask(prompt: string): void {
    this.dialogueQueue.push({ text: prompt, respondWithAI: true })
  }

  // Public method to change topic
  setTopic(topic: string): void {
    this.currentTopic = topic
  }

  private setupEventListeners(): void {
    // `say` event: character speaks exact text
    // Usage: dazzle s ev e say '{"text":"Hello world!","emotion":"happy"}'
    window.addEventListener('say', (e: Event) => {
      const detail = (e as CustomEvent).detail as unknown
      if (detail && typeof detail === 'object' && 'text' in detail) {
        const d = detail as { text: string, emotion?: string }
        const emotion = this.parseEmotion(d.emotion)
        this.say(d.text, emotion)
      }
    })

    // `ask` event: send prompt to AI, character speaks the response
    // Usage: dazzle s ev e ask '{"prompt":"What do you think about music?"}'
    window.addEventListener('ask', (e: Event) => {
      const detail = (e as CustomEvent).detail as unknown
      if (detail && typeof detail === 'object' && 'prompt' in detail) {
        const d = detail as { prompt: string }
        this.ask(d.prompt)
      }
    })

    // `topic` event: change the conversation topic
    // Usage: dazzle s ev e topic '{"topic":"the beauty of fractals"}'
    window.addEventListener('topic', (e: Event) => {
      const detail = (e as CustomEvent).detail as unknown
      if (detail && typeof detail === 'object' && 'topic' in detail) {
        const d = detail as { topic: string }
        this.setTopic(d.topic)
      }
    })
  }

  private parseEmotion(value: string | undefined): Emotion | undefined {
    const valid: Emotion[] = ['neutral', 'happy', 'sad', 'surprised', 'angry', 'thoughtful', 'curious']
    if (value && valid.includes(value as Emotion)) {
      return value as Emotion
    }
    return undefined
  }

  private emitStatus(state: ConversationStatus['state'], text: string, emotion: Emotion, progress: number): void {
    const status: ConversationStatus = {
      state,
      currentText: text,
      currentEmotion: emotion,
      speakingProgress: progress,
      topic: this.currentTopic,
      elapsedMs: Date.now() - this.startTime,
    }
    for (const cb of this.statusCallbacks) {
      cb(status)
    }
  }

  private emitUtterance(utterance: Utterance): void {
    for (const cb of this.utteranceCallbacks) {
      cb(utterance)
    }
  }

  private async wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const start = Date.now()
      const check = (): void => {
        if (!this.running || Date.now() - start >= ms) {
          resolve()
          return
        }
        setTimeout(check, 50)
      }
      check()
    })
  }

  private async loop(): Promise<void> {
    while (this.running) {
      // Idle phase: wait for events or timeout
      this.emitStatus('idle', '', 'neutral', 0)

      // Wait up to IDLE_TIMEOUT_MS for an event, checking frequently
      const idleStart = Date.now()
      while (this.running && this.dialogueQueue.length === 0) {
        const elapsed = Date.now() - idleStart
        if (elapsed >= IDLE_TIMEOUT_MS) break
        await this.wait(200)
      }
      if (!this.running) break

      let text: string
      let emotion: Emotion

      const queued = this.dialogueQueue.shift()
      if (queued) {
        if (queued.respondWithAI && this.hasApi) {
          // AI response to a prompt
          this.emitStatus('generating', '', 'neutral', 0)
          this.history.push({ role: 'user', content: queued.text })
          if (this.history.length > MAX_HISTORY) {
            this.history.splice(0, this.history.length - MAX_HISTORY)
          }
          const result = await this.callApi()
          if (!this.running) break
          if (result === null) {
            await this.wait(1000)
            continue
          }
          const extracted = extractEmotion(result)
          text = extracted.cleanText
          emotion = extracted.emotion
          this.history.push({ role: 'assistant', content: result })
          if (this.history.length > MAX_HISTORY) {
            this.history.splice(0, this.history.length - MAX_HISTORY)
          }
        } else if (queued.respondWithAI) {
          // No API key, just say the prompt as dialogue
          text = queued.text
          emotion = queued.emotion ?? 'neutral'
        } else {
          // Direct say: speak the exact text
          text = queued.text
          emotion = queued.emotion ?? 'neutral'
        }
      } else {
        // Idle timeout: generate idle content
        if (this.hasApi) {
          this.emitStatus('generating', '', 'neutral', 0)
          const prompt = `Reflect on this topic: "${this.currentTopic}"`
          this.history.push({ role: 'user', content: prompt })
          if (this.history.length > MAX_HISTORY) {
            this.history.splice(0, this.history.length - MAX_HISTORY)
          }
          const result = await this.callApi()
          if (!this.running) break
          if (result === null) {
            this.currentTopic = getNextTopic()
            await this.wait(2000)
            continue
          }
          const extracted = extractEmotion(result)
          text = extracted.cleanText
          emotion = extracted.emotion
          this.history.push({ role: 'assistant', content: result })
          if (this.history.length > MAX_HISTORY) {
            this.history.splice(0, this.history.length - MAX_HISTORY)
          }
          this.currentTopic = getNextTopic()
        } else {
          // Fallback idle phrases
          const idx = this.idlePhraseIndex % IDLE_PHRASES.length
          const phrase = IDLE_PHRASES[idx]
          this.idlePhraseIndex++
          text = phrase?.text ?? ''
          emotion = phrase?.emotion ?? 'neutral'
          await this.wait(500)
        }
      }
      if (!this.running) break

      // Speaking phase
      const utterance: Utterance = { text, emotion }
      this.emitUtterance(utterance)

      let totalDurationMs: number
      let audioPromise: Promise<number> | null = null

      if (isTTSReady()) {
        audioPromise = speak(text)
        totalDurationMs = (text.length / CHARS_PER_SECOND) * 1000
      } else {
        totalDurationMs = (text.length / CHARS_PER_SECOND) * 1000
      }

      const stepMs = 50
      let audioDurationKnown = false
      let actualDurationMs = totalDurationMs

      if (audioPromise) {
        audioPromise.then((seconds) => {
          if (seconds > 0) {
            actualDurationMs = seconds * 1000
            audioDurationKnown = true
          }
        }).catch(() => {
          // TTS failed, keep text-based pacing
        })
      }

      const speakStart = Date.now()
      let progress = 0

      while (progress < 1 && this.running) {
        const elapsed = Date.now() - speakStart
        const duration = audioDurationKnown ? actualDurationMs : totalDurationMs
        progress = Math.min(1, elapsed / duration)
        this.emitStatus('speaking', text, emotion, progress)
        if (progress < 1) {
          await this.wait(stepMs)
        }
      }
      if (!this.running) break

      // Wait for audio to finish if TTS is playing
      if (audioPromise) {
        try {
          const seconds = await audioPromise
          if (seconds > 0) {
            const elapsed = Date.now() - speakStart
            const remainingMs = (seconds * 1000) - elapsed
            if (remainingMs > 0) {
              this.emitStatus('speaking', text, emotion, 1)
              await this.wait(remainingMs)
            }
          }
        } catch {
          // TTS failed, continue
        }
      }
      if (!this.running) break

      // Pause phase
      this.emitStatus('pause', text, emotion, 1)
      await this.wait(1000 + Math.random() * 1000)
    }
  }

  private async callApi(): Promise<string | null> {
    this.abortController = new AbortController()
    const endpoint = `${this.apiBase}/chat/completions`

    try {
      const messages: ApiMessage[] = [
        { role: 'system' as const, content: SYSTEM_PROMPT },
        ...this.history,
      ]

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${this.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: MAX_TOKENS,
          messages,
        }),
        signal: this.abortController.signal,
      })

      if (!response.ok) {
        console.error('API error:', response.status, response.statusText)
        this.history.pop()
        return null
      }

      const data: ChatResponse = await response.json()
      const firstChoice = data.choices[0]
      return firstChoice?.message.content ?? null
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return null
      }
      console.error('API call failed:', err)
      this.history.pop()
      return null
    } finally {
      this.abortController = null
    }
  }
}
