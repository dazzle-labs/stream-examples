import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ConversationStatus } from './types'
import { ConversationEngine } from './conversation/engine'
import { VrmStage } from './vrm/VrmStage'
import { SignalOverlay } from './components/SignalOverlay'
import { Subtitles } from './components/Subtitles'

import { startSpeaking, stopSpeaking } from './vrm/lipSync'
import { initTTS, stopSpeaking as stopTTS } from './tts/engine'

const DEFAULT_VRM_URL = 'https://raw.githubusercontent.com/josephrocca/ChatVRM-js/main/avatars/AvatarSample_B.vrm'

const MODELS: Record<string, string> = {
  'default': DEFAULT_VRM_URL,
  'avatar_a': './models/avatar.vrm',
  'avatar_b': './models/avatar_b.vrm',
}

function getInitialModelUrl(): string {
  const envUrl: string | undefined = import.meta.env.VITE_VRM_MODEL_URL
  if (envUrl) return envUrl
  const stored = localStorage.getItem('ai-vtuber-model')
  if (stored && MODELS[stored]) return MODELS[stored]
  return DEFAULT_VRM_URL
}

interface DustParticle {
  id: number
  x: number
  y: number
  size: number
  duration: number
  delay: number
  color: string
  driftX: number
  driftY: number
}

function createDustParticles(count: number): DustParticle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 2 + Math.random(),
    duration: 20 + Math.random() * 20,
    delay: Math.random() * -40,
    color: Math.random() > 0.5 ? 'rgba(0,255,255,0.15)' : 'rgba(255,255,255,0.1)',
    driftX: (Math.random() - 0.5) * 200,
    driftY: (Math.random() - 0.5) * 150,
  }))
}

export function App() {
  const [modelUrl, setModelUrl] = useState(getInitialModelUrl)
  const dustParticles = useMemo(() => createDustParticles(7), [])

  const [vrmReady, setVrmReady] = useState(false)
  const [vrmError, setVrmError] = useState(false)

  // Listen for Dazzle events to switch models
  useEffect(() => {
    function handleSwitchModel(e: Event) {
      const detail = (e as CustomEvent).detail as unknown
      if (typeof detail === 'string') {
        // Direct URL
        setVrmReady(false)
        setModelUrl(detail)
      } else if (detail && typeof detail === 'object' && 'model' in detail) {
        const modelKey = (detail as { model: string }).model
        const url = MODELS[modelKey]
        if (url) {
          localStorage.setItem('ai-vtuber-model', modelKey)
          setVrmReady(false)
          setModelUrl(url)
        }
      }
    }
    window.addEventListener('switch-model', handleSwitchModel)
    return () => window.removeEventListener('switch-model', handleSwitchModel)
  }, [])
  const [status, setStatus] = useState<ConversationStatus>({
    state: 'idle',
    currentText: '',
    currentEmotion: 'neutral',
    speakingProgress: 0,
    topic: '',
    elapsedMs: 0,
  })

  const engineRef = useRef<ConversationEngine | null>(null)

  const handleUtterance = useCallback((utterance: { text: string }) => {
    startSpeaking(utterance.text)
  }, [])

  useEffect(() => {
    const engine = new ConversationEngine()
    engineRef.current = engine

    engine.onStatusChange(setStatus)
    engine.onUtterance(handleUtterance)
    engine.start()

    return () => {
      engine.stop()
    }
  }, [handleUtterance])

  const prevStateRef = useRef<ConversationStatus['state']>('idle')

  useEffect(() => {
    if (prevStateRef.current === 'speaking' && status.state !== 'speaking') {
      stopSpeaking()
      stopTTS()
    }
    prevStateRef.current = status.state
  }, [status.state])

  // Initialize TTS in background after VRM loads
  useEffect(() => {
    if (vrmReady) {
      void initTTS()
    }
  }, [vrmReady])

  const handleVrmReady = useCallback(() => {
    setVrmReady(true)
  }, [])

  const handleVrmError = useCallback(() => {
    setVrmError(true)
  }, [])

  const showSubtitles = status.state === 'speaking' || status.state === 'generating'

  return (
    <div className="relative w-[1280px] h-[720px] overflow-hidden bg-black">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#050510] to-[#0a0a1a]" />

      {/* Floating dust particles */}
      {dustParticles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full animate-dust-drift"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            '--drift-x': `${p.driftX}px`,
            '--drift-y': `${p.driftY}px`,
          } as React.CSSProperties}
        />
      ))}

      {/* VRM 3D Character */}
      <VrmStage
        modelUrl={modelUrl}
        emotion={status.currentEmotion}
        speaking={status.state === 'speaking'}
        onReady={handleVrmReady}
        onError={handleVrmError}
      />

      {/* Signal overlay (scan line, vignette, noise) */}
      <SignalOverlay />

      {/* Subtitles */}
      <Subtitles
        text={status.currentText}
        progress={status.speakingProgress}
        visible={showSubtitles}
      />

      {/* Loading / error screen */}
      {!vrmReady && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#050510]">
          {vrmError ? (
            <>
              <span className="font-mono text-sm uppercase tracking-[0.3em] text-red-400/80">
                No VRM model found
              </span>
              <span className="font-mono text-xs text-white/30 max-w-[600px] text-center leading-relaxed">
                Place a .vrm file at public/models/avatar.vrm and rebuild,
                or set VITE_VRM_MODEL_URL to a remote URL.
                See the README for setup instructions.
              </span>
            </>
          ) : (
            <span className="font-mono text-sm uppercase tracking-[0.3em] text-cyan-400/60 animate-pulse">
              Signal acquiring...
            </span>
          )}
        </div>
      )}
    </div>
  )
}
