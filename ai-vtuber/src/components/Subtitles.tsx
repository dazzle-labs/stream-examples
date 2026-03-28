import { useMemo } from 'react'

interface SubtitlesProps {
  text: string
  progress: number
  visible: boolean
}

export function Subtitles({ text, progress, visible }: SubtitlesProps) {
  const revealedLength = useMemo(
    () => Math.floor(text.length * Math.min(Math.max(progress, 0), 1)),
    [text, progress],
  )

  const revealedText = text.slice(0, revealedLength)

  return (
    <div
      className="absolute bottom-[15%] left-1/2 -translate-x-1/2 z-30 w-[85%] max-w-[960px] text-center transition-opacity duration-500 pointer-events-none"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div
        className="relative inline-block px-6 py-3"
        style={{
          maskImage: 'linear-gradient(to right, transparent 0%, black 3%, black 97%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 3%, black 97%, transparent 100%)',
        }}
      >
        <p
          className="text-white text-lg font-sans leading-relaxed whitespace-pre-wrap"
          style={{
            textShadow: '0 1px 4px rgba(0,0,0,0.9), 0 0 12px rgba(0,0,0,0.6)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {revealedText}
          {visible && revealedLength < text.length && (
            <span className="animate-blink ml-px inline-block w-[2px] h-[1em] bg-white/80 align-text-bottom" />
          )}
        </p>
      </div>
    </div>
  )
}
