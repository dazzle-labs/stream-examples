import { useState, useEffect, useRef, useCallback } from 'react'
import { CommodityPrice } from '../types'
import { yahooUrl } from '../api'

const PRE_CRISIS_BASELINES: Record<string, number> = {
  'BZ=F': 74.35,
  'CL=F': 70.87,
  '^OVX': 25.0,
}

const TICKERS = ['BZ=F', 'CL=F', '^OVX'] as const
const LABELS: Record<string, string> = { 'BZ=F': 'BRENT', 'CL=F': 'WTI', '^OVX': 'OVX' }

const STATIC_PRICES: CommodityPrice[] = [
  { ticker: 'BZ=F', label: 'BRENT', price: 115.42, changePercent: 55.2, sparkline: [74.35, 82.1, 89.5, 96.3, 108.7, 119.2, 115.4] },
  { ticker: 'CL=F', label: 'WTI', price: 105.04, changePercent: 48.1, sparkline: [70.87, 78.4, 81.2, 87.5, 98.4, 108.3, 105.0] },
  { ticker: '^OVX', label: 'OVX', price: 95.84, changePercent: 283.4, sparkline: [25.0, 42.3, 68.7, 82.4, 89.1, 92.6, 95.8] },
]

const POLL_INTERVAL = 5 * 60 * 1000

async function fetchYahoo(ticker: string): Promise<CommodityPrice | null> {
  try {
    const response = await fetch(
      yahooUrl(`/v8/finance/chart/${ticker}?range=7d&interval=1d`),
    )
    if (!response.ok) return null

    const json = await response.json()
    const result = json.chart?.result?.[0]
    if (!result) return null

    const currentPrice = result.meta?.regularMarketPrice
    if (typeof currentPrice !== 'number') return null

    const closes: Array<number | null> = result.indicators?.quote?.[0]?.close ?? []
    const sparkline = closes.filter((value): value is number => value !== null)

    const baseline = PRE_CRISIS_BASELINES[ticker] ?? currentPrice
    const changePercent = ((currentPrice - baseline) / baseline) * 100

    return {
      ticker,
      label: LABELS[ticker] ?? ticker,
      price: currentPrice,
      changePercent,
      sparkline: sparkline.length > 0 ? sparkline : [currentPrice],
    }
  } catch {
    return null
  }
}

export function useOilPrices(): {
  prices: CommodityPrice[]
  loading: boolean
} {
  const [prices, setPrices] = useState<CommodityPrice[]>(STATIC_PRICES)
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchAll = useCallback(async () => {
    const results = await Promise.all(TICKERS.map(fetchYahoo))
    const valid = results.filter((result): result is CommodityPrice => result !== null)

    if (valid.length > 0) {
      setPrices(previous => {
        const updated = [...previous]
        for (const fetched of valid) {
          const index = updated.findIndex(existing => existing.ticker === fetched.ticker)
          if (index >= 0) {
            updated[index] = fetched
          }
        }
        return updated
      })
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
    intervalRef.current = setInterval(fetchAll, POLL_INTERVAL)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [fetchAll])

  return { prices, loading }
}
