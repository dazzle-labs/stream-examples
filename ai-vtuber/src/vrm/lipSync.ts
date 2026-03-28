import type { VRM } from '@pixiv/three-vrm'

const CHARS_PER_SECOND = 12
const LERP_SPEED = 15

const VOWEL_MAP: Record<string, string> = {
  a: 'aa',
  e: 'ee',
  i: 'ih',
  o: 'oh',
  u: 'ou',
}

const VISEME_NAMES = ['aa', 'ee', 'ih', 'oh', 'ou'] as const

interface VisemeTarget {
  name: string
  weight: number
  duration: number
}

let speaking = false
let visemeQueue: VisemeTarget[] = []
let currentVisemeIndex = 0
let visemeElapsed = 0

const currentWeights: Record<string, number> = {
  aa: 0,
  ee: 0,
  ih: 0,
  oh: 0,
  ou: 0,
}

function buildVisemeQueue(text: string): VisemeTarget[] {
  const queue: VisemeTarget[] = []
  const charDuration = 1 / CHARS_PER_SECOND

  for (const char of text.toLowerCase()) {
    if (char === '.') {
      queue.push({ name: '', weight: 0, duration: 0.2 })
    } else if (char === ',') {
      queue.push({ name: '', weight: 0, duration: 0.1 })
    } else if (char === ' ' || /[^a-z]/.test(char)) {
      queue.push({ name: '', weight: 0, duration: charDuration })
    } else if (VOWEL_MAP[char]) {
      queue.push({ name: VOWEL_MAP[char], weight: 0.7, duration: charDuration })
    } else {
      queue.push({ name: 'aa', weight: 0.3, duration: charDuration })
    }
  }

  return queue
}

export function startSpeaking(text: string): void {
  visemeQueue = buildVisemeQueue(text)
  currentVisemeIndex = 0
  visemeElapsed = 0
  speaking = true
}

export function stopSpeaking(): void {
  speaking = false
  visemeQueue = []
  currentVisemeIndex = 0
  visemeElapsed = 0
}

export function update(vrm: VRM, deltaSeconds: number): void {
  // Determine target viseme
  let targetName = ''
  let targetWeight = 0

  if (speaking && visemeQueue.length > 0) {
    visemeElapsed += deltaSeconds

    const current = visemeQueue[currentVisemeIndex]
    if (current) {
      if (visemeElapsed >= current.duration) {
        visemeElapsed -= current.duration
        currentVisemeIndex++

        if (currentVisemeIndex >= visemeQueue.length) {
          speaking = false
          currentVisemeIndex = 0
          visemeQueue = []
        }
      }

      const active = visemeQueue[currentVisemeIndex]
      if (active) {
        targetName = active.name
        targetWeight = active.weight
      }
    }
  }

  // Lerp all viseme weights toward targets
  for (const name of VISEME_NAMES) {
    const target = name === targetName ? targetWeight : 0
    const prev = currentWeights[name] ?? 0
    const lerped = prev + (target - prev) * Math.min(1, deltaSeconds * LERP_SPEED)
    currentWeights[name] = lerped
    vrm.expressionManager?.setValue(name, lerped)
  }
}
