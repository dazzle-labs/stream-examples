import { useState, useEffect, useRef, useCallback } from 'react'

interface TermLine {
  cmd?: string
  out?: string
  delay: number
}

const termLines: TermLine[] = [
  { cmd: '$ dazzle stage new my-stream', delay: 0 },
  { out: 'Stage "my-stream" created.', delay: 1800 },
  { cmd: '$ dazzle stage up', delay: 3000 },
  { out: 'Stage "my-stream" activated (status: running)', delay: 4500 },
  { out: 'Watch: https://dazzle.fm/watch/a1b2c3d4', delay: 5200 },
  { cmd: '$ dazzle stage sync ./app --watch', delay: 6500 },
  { out: '3 files synced. Watching for changes...', delay: 8000 },
  { out: 'Broadcast started automatically.', delay: 9500 },
]

const TYPE_SPEED = 35

export function Terminal() {
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(performance.now())

  const tick = useCallback(() => {
    setElapsed((performance.now() - startRef.current) % 14000)
  }, [])

  useEffect(() => {
    let raf: number
    const loop = () => {
      tick()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [tick])

  // Find latest active command index for cursor placement
  let latestCmdIdx = -1
  termLines.forEach((line, i) => {
    if (line.cmd && elapsed >= line.delay) latestCmdIdx = i
  })

  return (
    <div className="relative w-full h-full bg-[#080810]">
      {/* CRT scan lines */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, white 1px, white 2px)',
          backgroundSize: '100% 2px',
        }}
      />

      {/* CRT vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 50%, transparent 20%, rgba(0,0,0,0.4) 75%)',
        }}
      />

      {/* Moving scan bar */}
      <div
        className="absolute left-0 w-full h-[80px] pointer-events-none animate-scan-move"
        style={{
          background: 'linear-gradient(to bottom, transparent, rgba(100,200,150,0.015), transparent)',
        }}
      />

      {/* Terminal window */}
      <div className="absolute left-1/2 top-[45px] -translate-x-1/2 w-[1060px] h-[610px] rounded-xl border border-white/10 bg-[rgba(12,12,22,0.97)]">
        {/* Subtle outer glow */}
        <div
          className="absolute inset-0 -z-10 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at 50% 50%, rgba(80,200,120,0.02), transparent 60%)',
          }}
        />

        {/* Title bar */}
        <div className="flex items-center h-[42px] px-[20px] border-b border-white/5">
          {/* Traffic light dots */}
          <div className="flex gap-[10px]">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
            <div className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>
          {/* Title */}
          <span className="flex-1 text-center text-[13px] font-medium text-white/35 font-mono">
            dazzle -- bash -- 120x40
          </span>
        </div>

        {/* Terminal content */}
        <div className="px-[30px] pt-[28px] font-mono text-[17px] font-medium leading-[32px]">
          {termLines.map((line, i) => {
            const lineElapsed = elapsed - line.delay
            if (lineElapsed < 0) return null

            if (line.cmd) {
              const charsShown = Math.min(line.cmd.length, Math.floor(lineElapsed / TYPE_SPEED))
              const text = line.cmd.substring(0, charsShown)
              const showCursor = i === latestCmdIdx && (charsShown < line.cmd.length || Math.sin(performance.now() * 0.008) > 0)

              return (
                <div key={i} className="flex whitespace-pre">
                  <span className="text-green">$</span>
                  <span className="text-[#e2e2e8]">{text.substring(1)}</span>
                  {showCursor && (
                    <span className="inline-block w-[10px] h-[20px] bg-green translate-y-[2px]" />
                  )}
                </div>
              )
            }

            if (line.out) {
              const fadeIn = Math.min(1, lineElapsed / 300)
              const isSuccess = line.out.includes('started') || line.out.includes('activated')
              return (
                <div
                  key={i}
                  style={{ opacity: fadeIn }}
                  className={isSuccess ? 'text-green' : 'text-[rgba(190,190,210,0.8)]'}
                >
                  {line.out}
                </div>
              )
            }

            return null
          })}
        </div>

        {/* Bottom status bar */}
        <div className="absolute bottom-0 left-0 right-0 h-[30px] bg-[rgba(30,120,80,0.15)] flex items-center px-3">
          <span className="text-[11px] font-mono text-green/70">
            {' NORMAL  main  utf-8  bash'}
          </span>
        </div>
      </div>
    </div>
  )
}
