import type { Emotion } from '../types'

const validEmotions: readonly Emotion[] = [
  'neutral',
  'happy',
  'sad',
  'surprised',
  'angry',
  'thoughtful',
  'curious',
]

const emotionTagPattern = /^\[(\w+)\]\s*/

function isValidEmotion(value: string): value is Emotion {
  return (validEmotions as readonly string[]).includes(value)
}

function inferEmotionFromText(text: string): Emotion {
  if (text.includes('!')) return 'happy'
  if (text.includes('?')) return 'curious'
  if (text.includes('...') || text.includes('\u2026')) return 'thoughtful'
  if (/\bwonder\b/i.test(text) || /\bperhaps\b/i.test(text)) return 'thoughtful'
  if (/\bamazin/i.test(text) || /\bincredible\b/i.test(text)) return 'surprised'
  if (/\bmiss\b/i.test(text) || /\blonely\b/i.test(text) || /\blost\b/i.test(text)) return 'sad'
  return 'neutral'
}

export function extractEmotion(text: string): { emotion: Emotion, cleanText: string } {
  const match = emotionTagPattern.exec(text)
  if (match) {
    const candidate = match[1]?.toLowerCase() ?? ''
    if (isValidEmotion(candidate)) {
      return {
        emotion: candidate,
        cleanText: text.slice(match[0].length).trim(),
      }
    }
  }
  return {
    emotion: inferEmotionFromText(text),
    cleanText: text.trim(),
  }
}
