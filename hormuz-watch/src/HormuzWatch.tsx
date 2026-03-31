import { useVesselStream } from './hooks/useVesselStream'
import { useTransitData } from './hooks/useTransitData'
import { usePredictionMarkets } from './hooks/usePredictionMarkets'
import { useOilPrices } from './hooks/useOilPrices'
import { useNewsFeed } from './hooks/useNewsFeed'
import { MapView } from './components/MapView'
import { Dashboard } from './components/Dashboard'
import { NewsTicker } from './components/NewsTicker'

export function HormuzWatch() {
  const { vessels, connectionStatus } = useVesselStream()
  const { days, latest, normalAverage } = useTransitData()
  const { markets } = usePredictionMarkets()
  const { prices } = useOilPrices()
  const { headlines } = useNewsFeed()

  return (
    <div className="flex flex-col w-[1280px] h-[720px]">
      <header
        className="flex items-center justify-between h-[48px] w-full bg-[#08080f] border-b border-[#1a1e30] shrink-0"
        style={{ padding: '0 24px' }}
      >
        <div className="flex items-center" style={{ gap: 12 }}>
          <span
            className="inline-block rounded-full bg-red-500 animate-pulse"
            style={{ width: 8, height: 8 }}
          />
          <span
            className="text-[14px] font-bold text-[#e8e8ec] uppercase"
            style={{ letterSpacing: '0.1em' }}
          >
            Hormuz Watch
          </span>
          <span
            className="text-[9px] font-bold text-red-500 rounded"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              padding: '3px 8px',
              lineHeight: 1,
            }}
          >
            LIVE
          </span>
        </div>
        <div className="flex items-center" style={{ gap: 28 }}>
          {prices.map(commodity => (
            <div key={commodity.ticker} className="flex items-center" style={{ gap: 8 }}>
              <span
                className="text-[9px] font-semibold uppercase text-[#4a5070]"
                style={{ letterSpacing: '0.08em' }}
              >
                {commodity.label}
              </span>
              <span className="font-mono text-[14px] font-semibold text-[#e8e8ec]">
                {commodity.ticker === '^OVX'
                  ? commodity.price.toFixed(2)
                  : `$${commodity.price.toFixed(2)}`}
              </span>
              <span
                className={`font-mono text-[11px] font-semibold ${
                  commodity.changePercent >= 0
                    ? 'text-[#22c55e]'
                    : 'text-[#ef4444]'
                }`}
              >
                {commodity.changePercent >= 0 ? '+' : ''}
                {commodity.changePercent.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </header>

      <div className="flex flex-row flex-1" style={{ minHeight: 0 }}>
        <MapView
          vessels={vessels}
          connectionStatus={connectionStatus}
        />
        <Dashboard
          latest={latest}
          days={days}
          normalAverage={normalAverage}
          markets={markets}
          prices={prices}
        />
      </div>

      <NewsTicker headlines={headlines} />
    </div>
  )
}
