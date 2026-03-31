import { useState, useEffect, useRef, useCallback } from 'react'
import { PredictionMarket } from '../types'

const MARKETS = [
  {
    name: 'Ceasefire by Apr 30',
    slug: 'us-x-iran-ceasefire-by',
    tokenId: '44149007410374101286260953227333745102128417138356632089802983317837574022801',
  },
  {
    name: 'Traffic Normal by Apr',
    slug: 'strait-of-hormuz-traffic-returns-to-normal-by-april-30',
    tokenId: '77893140510362582253172593084218413010407941075415081594586195705930819989216',
  },
  {
    name: '<10 Transits End Mar',
    slug: 'avg-of-ships-transiting-strait-of-hormuz-end-of-march',
    tokenId: '69294882392107955026189736478036678709986573671811326064829012334414357098295',
  },
  {
    name: 'Military Action Thru Mar',
    slug: 'military-action-against-iran-continues-through-march-31-2026',
    tokenId: '114452833153478251477218824496014511060529663635261152708245153427039308185854',
  },
] as const

const POLL_INTERVAL = 30 * 1000

interface MidpointResponse {
  mid: string
}

async function fetchMidpoint(tokenId: string): Promise<number | null> {
  try {
    const response = await fetch(
      `https://clob.polymarket.com/midpoint?token_id=${tokenId}`,
    )
    if (!response.ok) return null

    const data: MidpointResponse = await response.json()
    const value = parseFloat(data.mid)
    if (Number.isNaN(value)) return null
    return value
  } catch {
    return null
  }
}

export function usePredictionMarkets(): {
  markets: PredictionMarket[]
  loading: boolean
} {
  const [markets, setMarkets] = useState<PredictionMarket[]>([])
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const previousPricesRef = useRef<Map<string, number>>(new Map())
  const lastKnownRef = useRef<Map<string, PredictionMarket>>(new Map())

  const fetchMarkets = useCallback(async () => {
    const results = await Promise.all(
      MARKETS.map(async (market): Promise<PredictionMarket | null> => {
        const probability = await fetchMidpoint(market.tokenId)

        if (probability === null) {
          const lastKnown = lastKnownRef.current.get(market.slug)
          return lastKnown ?? null
        }

        const previousPrice = previousPricesRef.current.get(market.slug)
        const change1h = previousPrice !== undefined ? probability - previousPrice : 0
        previousPricesRef.current.set(market.slug, probability)

        const result: PredictionMarket = {
          name: market.name,
          probability,
          change1h,
          volume: 0,
          slug: market.slug,
        }

        lastKnownRef.current.set(market.slug, result)
        return result
      }),
    )

    const validMarkets = results.filter(
      (market): market is PredictionMarket => market !== null,
    )

    if (validMarkets.length > 0) {
      setMarkets(validMarkets)
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    fetchMarkets()
    intervalRef.current = setInterval(fetchMarkets, POLL_INTERVAL)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [fetchMarkets])

  return {
    markets,
    loading,
  }
}
