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

const POLL_INTERVAL = 5 * 60 * 1000

async function fetchYahoo(ticker: string): Promise<CommodityPrice | null> {
  try {
    const response = await fetch(yahooUrl(`/v8/finance/chart/${ticker}?range=7d&interval=1d`))
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
  const [prices, setPrices] = useState<CommodityPrice[]>([])
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchAll = useCallback(async () => {
    const results = await Promise.all(TICKERS.map(fetchYahoo))
    const valid = results.filter((result): result is CommodityPrice => result !== null)

    if (valid.length > 0) {
      setPrices(valid)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
    intervalRef.current = setInterval(fetchAll, POLL_INTERVAL)

    function handleOilEvent(event: Event) {
      const detail = (event as CustomEvent).detail
      const parsed = typeof detail === 'string' ? JSON.parse(detail) : detail
      if (parsed?.prices && Array.isArray(parsed.prices)) {
        setPrices(parsed.prices)
        setLoading(false)
      }
    }

    window.addEventListener('oil-update', handleOilEvent)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      window.removeEventListener('oil-update', handleOilEvent)
    }
  }, [fetchAll])

  return { prices, loading }
}
