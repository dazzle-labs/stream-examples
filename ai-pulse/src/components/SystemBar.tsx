import type { StockQuote } from '../types'

interface SystemBarProps {
  stocks: StockQuote[]
  connected: boolean
  paperCount: number
  eventRate: number
}

export function SystemBar({ stocks, connected, paperCount, eventRate }: SystemBarProps) {
  return (
    <header
      className="flex items-center justify-between shrink-0"
      style={{
        height: 36,
        padding: '0 20px',
        background: '#03070b',
        borderBottom: '1px solid rgba(0, 212, 255, 0.06)',
      }}
    >
      <div className="flex items-center" style={{ gap: 12 }}>
        <span
          className="inline-block rounded-full animate-pulse-dot"
          style={{
            width: 7,
            height: 7,
            background: connected ? '#00e676' : '#ff2d55',
            color: connected ? '#00e676' : '#ff2d55',
          }}
        />
        <span
          className="font-display text-[13px] font-bold text-text uppercase"
          style={{ letterSpacing: '0.12em' }}
        >
          AI Pulse
        </span>
        <span
          className="font-mono text-[8px] font-bold uppercase rounded"
          style={{
            color: '#00e676',
            background: 'rgba(0, 230, 118, 0.08)',
            padding: '2px 6px',
            letterSpacing: '0.1em',
          }}
        >
          LIVE
        </span>

        <span className="font-mono text-[9px] text-text-dim" style={{ marginLeft: 8 }}>
          {paperCount.toLocaleString()} papers
        </span>
        <span className="font-mono text-[9px] text-text-dim">
          {eventRate}/s events
        </span>
      </div>

      <div className="flex items-center" style={{ gap: 20 }}>
        {stocks.map(stock => (
          <div key={stock.ticker} className="flex items-center" style={{ gap: 6 }}>
            <span
              className="font-mono text-[9px] font-semibold uppercase text-text-dim"
              style={{ letterSpacing: '0.06em' }}
            >
              {stock.label}
            </span>
            <span className="font-mono text-[12px] font-semibold text-text">
              ${stock.price.toFixed(2)}
            </span>
            <span
              className="font-mono text-[10px] font-semibold"
              style={{
                color: stock.changePercent >= 0 ? '#00e676' : '#ff2d55',
              }}
            >
              {stock.changePercent >= 0 ? '+' : ''}
              {stock.changePercent.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </header>
  )
}
