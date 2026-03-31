import { useState, useEffect, useRef, useMemo } from 'react'
import { store } from '../data/store'
import type { FeedItem } from '../data/types'

const ITEM_DURATION = 7000
const DECODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-!@#$%^&*'
const DECODE_SETTLE_MS = 60
const DECODE_STAGGER_MS = 30

function severityColor(score: number): string {
  if (score >= 9) return '#ef233c'
  if (score >= 7) return '#f77f00'
  if (score >= 4) return '#ffbe0b'
  return '#06d6a0'
}

function useDecodingText(text: string, startDelayMs: number): string {
  const [display, setDisplay] = useState('')
  const frameRef = useRef(0)

  useEffect(() => {
    if (!text) {
      setDisplay('')
      return
    }

    const startTime = performance.now() + startDelayMs
    const chars = [...text]

    const tick = () => {
      const now = performance.now()
      const elapsed = now - startTime

      if (elapsed < 0) {
        setDisplay('')
        frameRef.current = requestAnimationFrame(tick)
        return
      }

      let result = ''
      let allSettled = true

      for (let index = 0; index < chars.length; index++) {
        const charSettleTime = index * DECODE_STAGGER_MS + DECODE_SETTLE_MS * 4
        const char = chars[index]
        if (!char) continue

        if (elapsed >= charSettleTime) {
          result += char
        } else if (elapsed >= index * DECODE_STAGGER_MS) {
          const randomIndex = Math.floor(Math.random() * DECODE_CHARS.length)
          result += DECODE_CHARS[randomIndex] ?? 'X'
          allSettled = false
        } else {
          result += ' '
          allSettled = false
        }
      }

      setDisplay(result)
      if (!allSettled) {
        frameRef.current = requestAnimationFrame(tick)
      }
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [text, startDelayMs])

  return display
}

function useTypingText(text: string, startDelayMs: number): string {
  const [display, setDisplay] = useState('')

  useEffect(() => {
    if (!text) {
      setDisplay('')
      return
    }

    const words = text.split(' ')
    let wordIndex = 0
    let timeoutHandle: ReturnType<typeof setTimeout>

    const delayHandle = setTimeout(() => {
      const addWord = () => {
        if (wordIndex >= words.length) return
        wordIndex++
        setDisplay(words.slice(0, wordIndex).join(' '))
        timeoutHandle = setTimeout(addWord, 80)
      }
      addWord()
    }, startDelayMs)

    return () => {
      clearTimeout(delayHandle)
      clearTimeout(timeoutHandle)
    }
  }, [text, startDelayMs])

  return display
}

function useDelayedVisible(delayMs: number, key: string): boolean {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(false)
    const handle = setTimeout(() => setVisible(true), delayMs)
    return () => clearTimeout(handle)
  }, [delayMs, key])

  return visible
}

function EpssBar({ score, visible }: { score: number; visible: boolean }) {
  if (score <= 0) return null

  return (
    <div className="w-full max-w-xl mt-6">
      <div className="flex justify-between mb-1">
        <span className="text-base text-gray-500 font-mono uppercase tracking-wider">
          EPSS EXPLOITATION PROBABILITY
        </span>
        <span className="text-base text-cyan-400 font-mono">
          {(score * 100).toFixed(1)}%
        </span>
      </div>
      <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: visible ? `${Math.min(score * 100, 100)}%` : '0%',
            background: '#00e5ff',
            transition: 'width 1.5s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      </div>
    </div>
  )
}

function FeedItemDisplay({ item }: { item: FeedItem }) {
  const itemKey = item.id

  const headingText = item.type === 'news' ? item.title : item.id
  const decodedHeading = useDecodingText(headingText, 0)
  const typedDescription = useTypingText(item.description, 1000)
  const badgeVisible = useDelayedVisible(500, itemKey)
  const vendorVisible = useDelayedVisible(2000, itemKey)
  const epssVisible = useDelayedVisible(2500, itemKey)

  const hasCvss = item.cvssScore > 0

  return (
    <div className="absolute inset-0 flex flex-col justify-center px-20">
      {item.isKEV && (
        <div className="absolute top-8 right-8">
          <div
            className="px-4 py-2 text-base font-mono font-bold uppercase tracking-wider text-white rounded"
            style={{
              background: '#ef233c',
              animation: 'kev-pulse 1.5s ease-in-out infinite',
            }}
          >
            EXPLOITED IN THE WILD
          </div>
        </div>
      )}

      <div className="flex items-center gap-6 mb-6">
        <div
          className="text-6xl font-mono font-bold text-white tracking-tight"
          style={{ fontSize: '56px', lineHeight: 1.1 }}
        >
          {decodedHeading}
        </div>

        {badgeVisible && (
          <div
            className="flex-shrink-0"
            style={{ animation: 'badge-slide 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}
          >
            {hasCvss ? (
              <div
                className="px-4 py-2 text-xl font-mono font-bold rounded"
                style={{ background: severityColor(item.cvssScore), color: '#010208' }}
              >
                CVSS {item.cvssScore.toFixed(1)}
              </div>
            ) : (
              <div
                className="px-4 py-2 text-lg font-mono font-bold rounded uppercase tracking-wider"
                style={{ background: '#1a1a2e', color: '#a0a0b0', border: '1px solid #2a2a3e' }}
              >
                {item.source}
              </div>
            )}
          </div>
        )}
      </div>

      {item.description && (
        <div
          className="text-xl font-mono leading-relaxed max-w-3xl"
          style={{ color: '#b0b0c0', fontSize: '24px' }}
        >
          {typedDescription}
          <span className="inline-block w-2 h-5 ml-1 bg-gray-500" style={{ animation: 'cursor-blink 0.8s step-end infinite' }} />
        </div>
      )}

      {vendorVisible && item.vendorProject && (
        <div
          className="mt-6 text-lg font-mono uppercase tracking-wider"
          style={{ color: '#606070', fontSize: '20px', animation: 'fade-in 0.6s ease-out forwards' }}
        >
          {item.vendorProject}
          {item.product ? ` / ${item.product}` : ''}
        </div>
      )}

      <EpssBar score={item.epssScore} visible={epssVisible} />
    </div>
  )
}

export function FeedScene() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [currentItem, setCurrentItem] = useState<FeedItem | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const feedSnapshot = useMemo(() => [...store.feedQueue], [])

  useEffect(() => {
    const item = feedSnapshot[currentIndex % Math.max(feedSnapshot.length, 1)]
    setCurrentItem(item ?? null)
  }, [currentIndex, feedSnapshot])

  useEffect(() => {
    if (feedSnapshot.length === 0) return

    intervalRef.current = setInterval(() => {
      setCurrentIndex(previous => (previous + 1) % feedSnapshot.length)
    }, ITEM_DURATION)

    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current)
    }
  }, [feedSnapshot])

  return (
    <div
      className="absolute inset-0"
      style={{ background: 'radial-gradient(ellipse at 30% 50%, #0a0a1a 0%, #010208 70%)' }}
    >
      <style>{`
        @keyframes badge-slide {
          0% { transform: translateX(-30px); opacity: 0; }
          70% { transform: translateX(4px); opacity: 1; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes kev-pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 12px rgba(239, 35, 60, 0.4); }
          50% { opacity: 0.7; box-shadow: 0 0 24px rgba(239, 35, 60, 0.8); }
        }
        @keyframes cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes fade-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
      `}</style>

      <div className="absolute bottom-8 left-20 flex items-center gap-3 opacity-30">
        <span className="text-base font-mono text-gray-500 uppercase tracking-wider">
          {feedSnapshot.length > 0
            ? `${(currentIndex % feedSnapshot.length) + 1} / ${feedSnapshot.length}`
            : 'NO DATA'}
        </span>
      </div>

      {currentItem ? (
        <FeedItemDisplay key={currentItem.id} item={currentItem} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-gray-600 text-xl font-mono uppercase tracking-wider">
            AWAITING FEED DATA
          </div>
        </div>
      )}
    </div>
  )
}
