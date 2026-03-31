import type { TransitDay, PredictionMarket, CommodityPrice } from '../types'
import { NORMAL_DAILY_TRANSITS } from '../types'
import { Sparkline } from './Sparkline'

interface DashboardProps {
  latest: TransitDay | null
  days: TransitDay[]
  normalAverage: number
  markets: PredictionMarket[]
  prices: CommodityPrice[]
}

function TransitSection({ latest, days, normalAverage }: {
  latest: TransitDay | null
  days: TransitDay[]
  normalAverage: number
}) {
  const currentTotal = latest?.total ?? 0
  const fillPercent = Math.min((currentTotal / normalAverage) * 100, 100)
  const percentOfNormal = Math.round((currentTotal / normalAverage) * 100)
  const sparklineData = days.slice(-30).map(day => day.total)

  const vesselBreakdown = [
    { name: 'Tanker', count: latest?.tanker ?? 0, color: '#f59e0b' },
    { name: 'Container', count: latest?.container ?? 0, color: '#3b82f6' },
    { name: 'Bulk', count: latest?.dryBulk ?? 0, color: '#22c55e' },
    { name: 'Other', count: (latest?.generalCargo ?? 0) + (latest?.roro ?? 0), color: '#94a3b8' },
  ]

  return (
    <div style={{ paddingBottom: 20 }}>
      <div
        className="text-[10px] font-semibold text-[#4a5070] uppercase"
        style={{ letterSpacing: '0.15em', marginBottom: 8 }}
      >
        Daily Transits
      </div>
      <div className="flex items-baseline" style={{ gap: 8 }}>
        <span className="font-mono text-[44px] font-extrabold text-[#e8e8ec]" style={{ lineHeight: 1 }}>
          {currentTotal}
        </span>
        <span className="font-mono text-[18px] font-normal text-[#3a4060]">
          / {NORMAL_DAILY_TRANSITS}
        </span>
      </div>
      <div
        className="w-full rounded-full bg-[#1a1e30]"
        style={{ height: 4, marginTop: 12 }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${fillPercent}%`,
            minWidth: fillPercent > 0 ? 4 : 0,
            background: 'linear-gradient(90deg, #ef4444, #f59e0b)',
          }}
        />
      </div>
      <div className="text-[10px] font-medium text-[#4a5070]" style={{ marginTop: 6 }}>
        {percentOfNormal}% of normal daily average
      </div>
      <div style={{ marginTop: 12 }}>
        <Sparkline
          data={sparklineData}
          width={360}
          height={32}
          color="#ef4444"
        />
      </div>
      <div className="flex flex-wrap" style={{ gap: '4px 16px', marginTop: 8 }}>
        {vesselBreakdown.map(vessel => (
          <div key={vessel.name} className="flex items-center" style={{ gap: 4 }}>
            <span
              className="inline-block rounded-full shrink-0"
              style={{ width: 5, height: 5, backgroundColor: vessel.color }}
            />
            <span className="text-[10px] text-[#6b7194]">{vessel.name}</span>
            <span className="font-mono text-[10px] font-semibold text-[#c0c0cc]">
              {vessel.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MarketsSection({ markets }: { markets: PredictionMarket[] }) {
  return (
    <div style={{ padding: '20px 0' }}>
      <div
        className="text-[10px] font-semibold text-[#4a5070] uppercase"
        style={{ letterSpacing: '0.15em' }}
      >
        Prediction Markets
      </div>
      <div className="text-[9px] font-medium text-[#6366f1]" style={{ marginTop: 2, marginBottom: 14 }}>
        Polymarket
      </div>
      <div className="flex flex-col" style={{ gap: 2 }}>
        {markets.map(market => {
          const percentDisplay = (Math.round(market.probability * 1000) / 10).toFixed(1)
          const directionArrow = market.change1h > 0.001
            ? { symbol: '\u25B2', color: '#22c55e' }
            : market.change1h < -0.001
              ? { symbol: '\u25BC', color: '#ef4444' }
              : { symbol: '\u2500', color: '#3a4060' }

          return (
            <div
              key={market.slug}
              className="relative rounded"
              style={{ padding: '8px 10px' }}
            >
              <div
                className="absolute inset-0 rounded"
                style={{
                  background: `linear-gradient(90deg, rgba(99, 102, 241, 0.06) 0%, transparent ${Math.max(market.probability * 100, 20)}%)`,
                }}
              />
              <div className="relative flex justify-between items-center" style={{ gap: 12 }}>
                <span className="text-[11px] font-medium text-[#8890b0] truncate" style={{ flex: 1 }}>
                  {market.name}
                </span>
                <div className="flex items-baseline shrink-0" style={{ gap: 3 }}>
                  <span className="font-mono text-[15px] font-bold text-[#e8e8ec]">
                    {percentDisplay}
                  </span>
                  <span className="font-mono text-[10px] font-normal text-[#4a5070]">%</span>
                  <span className="text-[9px]" style={{ color: directionArrow.color, marginLeft: 2 }}>
                    {directionArrow.symbol}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function OilSection({ prices }: { prices: CommodityPrice[] }) {
  return (
    <div style={{ paddingTop: 20 }}>
      <div
        className="text-[10px] font-semibold text-[#4a5070] uppercase"
        style={{ letterSpacing: '0.15em', marginBottom: 14 }}
      >
        Oil & Energy
      </div>
      <div className="flex flex-col" style={{ gap: 10 }}>
        {prices.map(commodity => {
          const priceDisplay = commodity.ticker === '^OVX'
            ? commodity.price.toFixed(2)
            : `$${commodity.price.toFixed(2)}`

          const changeColor = commodity.changePercent >= 0 ? '#22c55e' : '#ef4444'
          const changePrefix = commodity.changePercent >= 0 ? '+' : ''

          return (
            <div key={commodity.ticker} className="flex items-center" style={{ gap: 8 }}>
              <div className="shrink-0" style={{ width: 40 }}>
                <span className="text-[10px] font-semibold text-[#6b7194] uppercase">
                  {commodity.label}
                </span>
              </div>
              <span className="font-mono text-[14px] font-semibold text-[#e8e8ec]" style={{ width: 80 }}>
                {priceDisplay}
              </span>
              <span
                className="font-mono text-[11px] font-semibold shrink-0 text-right"
                style={{ color: changeColor, width: 56 }}
              >
                {changePrefix}{commodity.changePercent.toFixed(1)}%
              </span>
              <div className="shrink-0">
                <Sparkline
                  data={commodity.sparkline}
                  width={60}
                  height={18}
                  color="#6366f1"
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function Dashboard({
  latest,
  days,
  normalAverage,
  markets,
  prices,
}: DashboardProps) {
  return (
    <div
      className="w-[448px] h-[616px] bg-[#08080f] border-l border-[#1a1e30] flex flex-col overflow-hidden"
      style={{ padding: '24px 32px' }}
    >
      <TransitSection latest={latest} days={days} normalAverage={normalAverage} />
      <div className="shrink-0" style={{ height: 1, background: '#1a1e30' }} />
      <MarketsSection markets={markets} />
      <div className="shrink-0" style={{ height: 1, background: '#1a1e30' }} />
      <OilSection prices={prices} />
    </div>
  )
}
