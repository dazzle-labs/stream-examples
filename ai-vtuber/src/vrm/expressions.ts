import type { VRM } from '@pixiv/three-vrm'
import type { Emotion } from '../types'

const TRANSITION_DURATION = 0.5
const MAX_WEIGHT = 0.8

interface ExpressionLayer {
  expression: string
  weight: number
}

const EMOTION_MAP: Record<Emotion, ReadonlyArray<ExpressionLayer>> = {
  neutral: [],
  happy: [
    { expression: 'happy', weight: 0.7 },
    { expression: 'aa', weight: 0.2 },
  ],
  sad: [
    { expression: 'sad', weight: 0.7 },
    { expression: 'oh', weight: 0.15 },
  ],
  angry: [
    { expression: 'angry', weight: 0.7 },
    { expression: 'ee', weight: 0.3 },
  ],
  surprised: [
    { expression: 'surprised', weight: 0.8 },
    { expression: 'oh', weight: 0.4 },
  ],
  thoughtful: [
    { expression: 'neutral', weight: 0.4 },
  ],
  curious: [
    { expression: 'surprised', weight: 0.3 },
    { expression: 'oh', weight: 0.2 },
  ],
}

// All expression names used across all emotions
const ALL_EXPRESSIONS = ['happy', 'sad', 'surprised', 'angry', 'neutral', 'aa', 'oh', 'ee'] as const

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

let targetEmotion: Emotion = 'neutral'
let transitionElapsed = TRANSITION_DURATION

const currentWeights: Record<string, number> = {}
const previousWeights: Record<string, number> = {}

for (const expr of ALL_EXPRESSIONS) {
  currentWeights[expr] = 0
  previousWeights[expr] = 0
}

export function setEmotion(emotion: Emotion): void {
  if (emotion !== targetEmotion) {
    // Snapshot current weights as starting point for the new transition
    for (const expr of ALL_EXPRESSIONS) {
      previousWeights[expr] = currentWeights[expr] ?? 0
    }
    targetEmotion = emotion
    transitionElapsed = 0
  }
}

export function update(vrm: VRM, deltaSeconds: number): void {
  transitionElapsed += deltaSeconds
  const rawT = Math.min(transitionElapsed / TRANSITION_DURATION, 1)
  const ease = easeInOutCubic(rawT)

  const layers = EMOTION_MAP[targetEmotion]

  for (const expr of ALL_EXPRESSIONS) {
    // Find target weight for this expression
    let targetWeight = 0
    for (const layer of layers) {
      if (layer.expression === expr) {
        targetWeight = layer.weight
        break
      }
    }

    // Cap at max weight
    targetWeight = Math.min(targetWeight, MAX_WEIGHT)

    const prev = previousWeights[expr] ?? 0
    const lerped = prev + (targetWeight - prev) * ease
    currentWeights[expr] = lerped
    vrm.expressionManager?.setValue(expr, lerped)
  }
}
