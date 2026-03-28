export type Emotion = 'neutral' | 'happy' | 'sad' | 'surprised' | 'angry' | 'thoughtful' | 'curious'

export type ConversationState = 'idle' | 'generating' | 'speaking' | 'pause'

export interface Utterance {
  text: string
  emotion: Emotion
}

export interface ConversationStatus {
  state: ConversationState
  currentText: string
  currentEmotion: Emotion
  speakingProgress: number
  topic: string
  elapsedMs: number
}
