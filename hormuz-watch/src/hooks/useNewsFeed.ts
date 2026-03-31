import { useState, useEffect, useRef, useCallback } from 'react'
import { Headline } from '../types'
import { googleNewsUrl, centcomUrl } from '../api'

const CURATED_HEADLINES: Array<{ source: string, category: Headline['category'], title: string }> = [
  { source: 'CENTCOM', category: 'military', title: 'CENTCOM destroys 44 Iranian mine-laying vessels in Strait of Hormuz campaign' },
  { source: 'Reuters', category: 'news', title: 'Iran rejects US 15-point peace proposal, demands sovereignty recognition' },
  { source: 'Al Jazeera', category: 'news', title: 'IRGC charges $2M per ship in yuan for tolled Hormuz passage' },
  { source: 'CNBC', category: 'news', title: 'Brent crude holds above $115 as Hormuz blockade enters second month' },
  { source: 'CENTCOM', category: 'military', title: 'USS Eisenhower carrier strike group repositions to Gulf of Oman' },
  { source: 'AP', category: 'news', title: 'Pakistan mediates indirect ceasefire talks between US and Iran' },
  { source: 'Lloyd\'s List', category: 'news', title: 'War-risk insurance premiums surge to 10% of hull value for strait transits' },
  { source: 'CENTCOM', category: 'military', title: 'A-10 Warthogs neutralize Iranian fast-attack boats near Bandar Abbas' },
  { source: 'Reuters', category: 'news', title: 'IEA releases 400M barrels from strategic petroleum reserves' },
  { source: 'USNI News', category: 'military', title: 'IRGC opens selective passage around Larak Island for approved nations' },
  { source: 'CNBC', category: 'news', title: 'Supertanker day rates hit record $800,000 amid Hormuz disruption' },
  { source: 'Al Jazeera', category: 'news', title: 'Trump sets April 6 deadline for Iran to accept deal or face energy strikes' },
]

const POLL_INTERVAL = 5 * 60 * 1000

function buildFallbackHeadlines(): Headline[] {
  const now = Date.now()
  const spacing = (3 * 60 * 60 * 1000) / CURATED_HEADLINES.length
  return CURATED_HEADLINES.map((seed, index) => ({
    id: `curated-${index}`,
    title: seed.title,
    source: seed.source,
    category: seed.category,
    timestamp: now - index * spacing,
  }))
}

function parseRssXml(xml: string, defaultCategory: Headline['category'], defaultSource?: string): Headline[] {
  try {
    const parser = new DOMParser()
    const document = parser.parseFromString(xml, 'text/xml')
    const items = document.querySelectorAll('item')
    const results: Headline[] = []

    items.forEach((item, index) => {
      const title = item.querySelector('title')?.textContent?.trim()
      if (!title) return

      const sourceElement = item.querySelector('source')
      const source = defaultSource ?? sourceElement?.textContent?.trim() ?? 'News'
      const pubDate = item.querySelector('pubDate')?.textContent
      const timestamp = pubDate ? new Date(pubDate).getTime() : Date.now() - index * 60000

      results.push({
        id: `rss-${defaultCategory}-${index}-${timestamp}`,
        title,
        source,
        category: defaultCategory,
        timestamp: Number.isNaN(timestamp) ? Date.now() - index * 60000 : timestamp,
      })
    })

    return results
  } catch {
    return []
  }
}

async function fetchGoogleNews(): Promise<Headline[]> {
  try {
    const response = await fetch(
      googleNewsUrl('/rss/search?q=%22strait+of+hormuz%22+OR+%22hormuz%22+when%3A1d&hl=en-US&gl=US&ceid=US:en'),
    )
    if (!response.ok) return []
    const xml = await response.text()
    return parseRssXml(xml, 'news')
  } catch {
    return []
  }
}

async function fetchCentcom(): Promise<Headline[]> {
  try {
    const response = await fetch(
      centcomUrl('/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=808&max=10'),
    )
    if (!response.ok) return []
    const xml = await response.text()
    return parseRssXml(xml, 'military', 'CENTCOM')
  } catch {
    return []
  }
}

export function useNewsFeed(): {
  headlines: Headline[]
  loading: boolean
} {
  const [headlines, setHeadlines] = useState<Headline[]>(() => buildFallbackHeadlines())
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const counterRef = useRef(0)

  const fetchAll = useCallback(async () => {
    const [googleHeadlines, centcomHeadlines] = await Promise.all([
      fetchGoogleNews(),
      fetchCentcom(),
    ])

    const combined = [...googleHeadlines, ...centcomHeadlines]

    if (combined.length > 0) {
      const seen = new Set<string>()
      const deduped = combined.filter(headline => {
        const key = headline.title.toLowerCase().substring(0, 60)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      deduped.sort((first, second) => second.timestamp - first.timestamp)
      setHeadlines(deduped.slice(0, 15))
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
    intervalRef.current = setInterval(fetchAll, POLL_INTERVAL)

    function handleHeadline(event: Event) {
      const detail = (event as CustomEvent).detail
      if (!detail || !detail.title) return

      counterRef.current += 1
      const newHeadline: Headline = {
        id: `live-${Date.now()}-${counterRef.current}`,
        title: detail.title,
        source: detail.source ?? 'Breaking',
        category: detail.category ?? 'news',
        timestamp: Date.now(),
      }

      setHeadlines(previous => [newHeadline, ...previous].slice(0, 20))
    }

    window.addEventListener('hormuz-headline', handleHeadline)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      window.removeEventListener('hormuz-headline', handleHeadline)
    }
  }, [fetchAll])

  return { headlines, loading }
}
