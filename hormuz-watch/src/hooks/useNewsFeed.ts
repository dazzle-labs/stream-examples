import { useState, useEffect, useRef, useCallback } from 'react'
import { Headline } from '../types'

const POLL_INTERVAL = 5 * 60 * 1000

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
      'https://news.google.com/rss/search?q=%22strait+of+hormuz%22+OR+%22hormuz%22+when%3A1d&hl=en-US&gl=US&ceid=US:en',
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
      'https://www.centcom.mil/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=808&max=10',
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
  const [headlines, setHeadlines] = useState<Headline[]>([])
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

    function handleNewsUpdate(event: Event) {
      const detail = (event as CustomEvent).detail
      const parsed = typeof detail === 'string' ? JSON.parse(detail) : detail
      if (parsed?.headlines && Array.isArray(parsed.headlines)) {
        setHeadlines(parsed.headlines.slice(0, 15))
        setLoading(false)
      }
    }

    window.addEventListener('hormuz-headline', handleHeadline)
    window.addEventListener('news-update', handleNewsUpdate)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      window.removeEventListener('hormuz-headline', handleHeadline)
      window.removeEventListener('news-update', handleNewsUpdate)
    }
  }, [fetchAll])

  return { headlines, loading }
}
