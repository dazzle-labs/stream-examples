import { useEffect, useRef, useState } from 'react'
import type { Paper } from '../types'

const DECODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&'

function useDecodeText(text: string, speed = 30): string {
  const [decoded, setDecoded] = useState('')
  const revealedRef = useRef(0)
  const targetRef = useRef(text)

  useEffect(() => {
    targetRef.current = text
    revealedRef.current = 0
    setDecoded('')

    const interval = setInterval(() => {
      revealedRef.current += 1
      const count = revealedRef.current
      const target = targetRef.current

      if (count >= target.length) {
        setDecoded(target)
        clearInterval(interval)
        return
      }

      let result = ''
      for (let i = 0; i < target.length; i++) {
        if (i < count) {
          result += target[i]
        } else if (i < count + 3) {
          const char = target[i]
          if (char === ' ') {
            result += ' '
          } else {
            result += DECODE_CHARS[Math.floor(Math.random() * DECODE_CHARS.length)]
          }
        } else {
          break
        }
      }
      setDecoded(result)
    }, speed)

    return () => clearInterval(interval)
  }, [text, speed])

  return decoded
}

const CATEGORY_COLORS: Record<string, string> = {
  'cs.AI': '#00d4ff',
  'cs.LG': '#00e676',
  'cs.CL': '#ffab00',
  'cs.CV': '#ff2d55',
  'stat.ML': '#a78bfa',
}

interface PaperHeroProps {
  paper: Paper | null
}

export function PaperHero({ paper }: PaperHeroProps) {
  const decodedTitle = useDecodeText(paper?.title ?? '', 25)
  const [showAbstract, setShowAbstract] = useState(false)

  useEffect(() => {
    setShowAbstract(false)
    const timer = setTimeout(() => setShowAbstract(true), 800)
    return () => clearTimeout(timer)
  }, [paper?.id])

  if (!paper) return null

  const categoryColor = CATEGORY_COLORS[paper.category] ?? '#5a7089'
  const truncatedAbstract = paper.abstract.length > 200
    ? paper.abstract.slice(0, 200) + '...'
    : paper.abstract

  return (
    <div className="flex flex-col justify-center h-full" style={{ padding: '48px 40px 24px' }}>
      <div
        className="rounded px-2 py-0.5 inline-flex items-center self-start"
        style={{
          gap: 8,
          background: `${categoryColor}10`,
          border: `1px solid ${categoryColor}30`,
          marginBottom: 16,
        }}
      >
        <span
          className="inline-block rounded-full"
          style={{ width: 6, height: 6, background: categoryColor }}
        />
        <span
          className="font-mono text-[10px] font-semibold uppercase"
          style={{ color: categoryColor, letterSpacing: '0.08em' }}
        >
          {paper.category}
        </span>
        <span className="font-mono text-[10px] text-text-dim">
          arXiv:{paper.id}
        </span>
      </div>

      <h1
        className="font-display font-bold text-text leading-tight"
        style={{
          fontSize: 32,
          lineHeight: 1.15,
          maxWidth: 640,
          minHeight: 80,
          textShadow: '0 0 40px rgba(0, 212, 255, 0.15)',
        }}
      >
        {decodedTitle}
      </h1>

      <div
        className="flex items-center font-mono text-[11px]"
        style={{ gap: 16, marginTop: 16, opacity: showAbstract ? 1 : 0, transition: 'opacity 0.6s ease' }}
      >
        <div className="flex items-center" style={{ gap: 4 }}>
          <span style={{ color: '#00e676' }}>&#9650;</span>
          <span className="font-semibold text-text">{paper.upvotes}</span>
          <span className="text-text-secondary">upvotes</span>
        </div>

        {paper.githubStars !== null && (
          <div className="flex items-center" style={{ gap: 4 }}>
            <span style={{ color: '#ffab00' }}>&#9733;</span>
            <span className="font-semibold text-text">{paper.githubStars.toLocaleString()}</span>
            <span className="text-text-secondary">stars</span>
          </div>
        )}

        <span className="text-text-dim">
          {paper.authors.slice(0, 3).join(', ')}
          {paper.authors.length > 3 ? ` +${paper.authors.length - 3}` : ''}
        </span>
      </div>

      <p
        className="font-mono text-[12px] leading-relaxed text-text-secondary"
        style={{
          marginTop: 14,
          maxWidth: 580,
          opacity: showAbstract ? 0.8 : 0,
          transform: showAbstract ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 0.8s ease 0.2s, transform 0.8s ease 0.2s',
        }}
      >
        {truncatedAbstract}
      </p>

      {paper.keywords.length > 0 && (
        <div
          className="flex items-center flex-wrap"
          style={{
            gap: 6,
            marginTop: 12,
            opacity: showAbstract ? 0.6 : 0,
            transition: 'opacity 0.8s ease 0.4s',
          }}
        >
          {paper.keywords.map(keyword => (
            <span
              key={keyword}
              className="font-mono text-[9px] uppercase text-primary-dim rounded"
              style={{
                padding: '2px 8px',
                background: 'rgba(0, 212, 255, 0.06)',
                border: '1px solid rgba(0, 212, 255, 0.1)',
                letterSpacing: '0.06em',
              }}
            >
              {keyword}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
