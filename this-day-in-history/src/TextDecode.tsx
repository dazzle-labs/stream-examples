import { useState, useEffect, useRef } from 'react'

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

function randomGlyph(): string {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)] ?? 'A'
}

type TextDecodeProps = {
  text: string,
  delay?: number,
  duration?: number,
  className?: string,
}

export function TextDecode({ text, delay = 0, duration = 1200, className }: TextDecodeProps) {
  const [displayed, setDisplayed] = useState('')
  const frameReference = useRef(0)
  const startTimeReference = useRef<number | null>(null)

  useEffect(() => {
    setDisplayed('')
    startTimeReference.current = null

    const charsPerSecond = 40
    const totalDecodeTime = (text.length / charsPerSecond) * 1000
    const effectDuration = Math.max(duration, totalDecodeTime)

    let cancelled = false

    const delayTimeout = window.setTimeout(() => {
      if (cancelled) return

      function animate(timestamp: number) {
        if (cancelled) return

        if (startTimeReference.current === null) {
          startTimeReference.current = timestamp
        }

        const elapsed = timestamp - startTimeReference.current
        const resolvedCount = Math.floor((elapsed / effectDuration) * text.length)

        let result = ''
        for (let index = 0; index < text.length; index++) {
          if (text[index] === ' ') {
            result += ' '
          } else if (index < resolvedCount) {
            result += text[index]
          } else {
            result += randomGlyph()
          }
        }

        setDisplayed(result)

        if (resolvedCount < text.length) {
          frameReference.current = requestAnimationFrame(animate)
        } else {
          setDisplayed(text)
        }
      }

      frameReference.current = requestAnimationFrame(animate)
    }, delay)

    return () => {
      cancelled = true
      window.clearTimeout(delayTimeout)
      cancelAnimationFrame(frameReference.current)
    }
  }, [text, delay, duration])

  return <span className={className}>{displayed || '\u00A0'}</span>
}
