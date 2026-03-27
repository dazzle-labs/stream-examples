import type { WikiResponse, WikiEvent, HistoryEvent, EventCategory } from './types'
import { getEra } from './eras'

function resizeThumbnailUrl(url: string, targetWidth: number): string {
  const thumbPattern = /\/(\d+)px-[^/]+$/
  const match = url.match(thumbPattern)
  if (match) return url.replace(thumbPattern, `/${targetWidth}px-${url.split('/').pop()}`)
  return url
}

function extractImage(wikiEvent: WikiEvent): string | undefined {
  const firstPage = wikiEvent.pages[0]
  if (!firstPage) return
  if (firstPage.thumbnail) return resizeThumbnailUrl(firstPage.thumbnail.source, 1280)
  if (firstPage.originalimage) return firstPage.originalimage.source
  return
}

function extractDetails(wikiEvent: WikiEvent): { extract?: string, wikiUrl?: string } {
  const firstPage = wikiEvent.pages[0]
  if (!firstPage) return {}
  return {
    extract: firstPage.extract,
    wikiUrl: firstPage.content_urls?.desktop.page,
  }
}

function processCategory(
  items: WikiEvent[],
  category: EventCategory,
  requireImage: boolean,
): HistoryEvent[] {
  return items
    .filter((item) => !requireImage || extractImage(item) !== undefined)
    .map((item) => {
      const details = extractDetails(item)
      return {
        year: item.year,
        text: item.text,
        category,
        image: extractImage(item),
        extract: details.extract,
        wikiUrl: details.wikiUrl,
        era: getEra(item.year),
      }
    })
}

function deduplicateEvents(events: HistoryEvent[]): HistoryEvent[] {
  const seen = new Map<string, HistoryEvent>()

  for (const historyEvent of events) {
    const key = `${historyEvent.year}:${historyEvent.text.slice(0, 50)}`
    const existing = seen.get(key)
    if (!existing || historyEvent.category === 'selected') {
      seen.set(key, historyEvent)
    }
  }

  return Array.from(seen.values())
}

export async function fetchHistoryEvents(date: Date): Promise<HistoryEvent[]> {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const url = `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/${month}/${day}`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Wikipedia API returned ${response.status}`)
  }

  const data: WikiResponse = await response.json()

  const allEvents = [
    ...processCategory(data.selected ?? [], 'selected', false),
    ...processCategory(data.events ?? [], 'event', false),
    ...processCategory(data.births ?? [], 'birth', true),
    ...processCategory(data.deaths ?? [], 'death', true),
  ]

  const deduplicated = deduplicateEvents(allEvents)
  deduplicated.sort((a, b) => a.year - b.year)

  return deduplicated
}
