import type { LeaderboardEntry } from '../types'

const VENDOR_COLORS: Record<string, string> = {
  Anthropic: '#d4a574',
  OpenAI: '#10a37f',
  Google: '#4285f4',
  DeepSeek: '#6366f1',
  Meta: '#0081fb',
  Mistral: '#ff7000',
}

const ELO_MIN = 1200
const ELO_MAX = 1400

interface LeaderboardProps {
  entries: LeaderboardEntry[]
}

export function Leaderboard({ entries }: LeaderboardProps) {
  const sorted = [...entries].sort((a, b) => b.elo - a.elo)

  return (
    <div className="flex flex-col" style={{ padding: '16px 20px 12px', height: 280 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
        <div className="flex items-center" style={{ gap: 8 }}>
          <span
            className="font-mono text-[9px] font-bold uppercase text-primary"
            style={{ letterSpacing: '0.1em' }}
          >
            Arena Leaderboard
          </span>
          <span
            className="font-mono text-[8px] uppercase text-text-dim rounded"
            style={{
              padding: '1px 5px',
              background: 'rgba(0, 212, 255, 0.05)',
              border: '1px solid rgba(0, 212, 255, 0.08)',
            }}
          >
            TEXT
          </span>
        </div>
        <span className="font-mono text-[9px] text-text-dim">ELO</span>
      </div>

      <div className="flex flex-col flex-1" style={{ gap: 6 }}>
        {sorted.map((entry, index) => {
          const fillPercent = Math.max(0, Math.min(100,
            ((entry.elo - ELO_MIN) / (ELO_MAX - ELO_MIN)) * 100,
          ))
          const vendorColor = VENDOR_COLORS[entry.vendor] ?? '#5a7089'

          return (
            <div
              key={entry.model}
              className="flex items-center"
              style={{
                gap: 8,
                opacity: 0,
                animation: `fade-in 0.4s ease-out ${index * 0.06}s forwards`,
              }}
            >
              <span
                className="font-mono text-[10px] font-semibold text-text-dim shrink-0"
                style={{ width: 18, textAlign: 'right' }}
              >
                {entry.rank}
              </span>

              <div className="flex-1 relative" style={{ height: 22 }}>
                <div
                  className="absolute inset-0 rounded-sm overflow-hidden"
                  style={{ background: 'rgba(255, 255, 255, 0.02)' }}
                >
                  <div
                    className="h-full rounded-sm animate-bar-fill"
                    style={{
                      width: `${fillPercent}%`,
                      background: `linear-gradient(90deg, ${vendorColor}30, ${vendorColor}15)`,
                      borderRight: `2px solid ${vendorColor}80`,
                    }}
                  />
                </div>

                <div
                  className="absolute inset-0 flex items-center justify-between"
                  style={{ padding: '0 8px' }}
                >
                  <span className="font-mono text-[10px] font-medium text-text" style={{ zIndex: 1 }}>
                    {entry.model}
                  </span>
                  <span
                    className="font-mono text-[9px] text-text-secondary"
                    style={{ zIndex: 1, opacity: 0.7 }}
                  >
                    {entry.vendor}
                  </span>
                </div>
              </div>

              <div className="flex items-center shrink-0" style={{ width: 60, gap: 4, justifyContent: 'flex-end' }}>
                <span className="font-mono text-[11px] font-semibold text-text">
                  {entry.elo}
                </span>
                {entry.change !== 0 && (
                  <span
                    className="font-mono text-[9px] font-semibold"
                    style={{ color: entry.change > 0 ? '#00e676' : '#ff2d55' }}
                  >
                    {entry.change > 0 ? '+' : ''}{entry.change}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
