import { useState, useEffect, useMemo } from 'react'
import { store } from '../data/store'

interface TickerItem {
  id: string
  label: string
  text: string
  color: string
}

function buildTickerItems(): TickerItem[] {
  const items: TickerItem[] = []

  if (store.latestBreach) {
    const breach = store.latestBreach
    items.push({
      id: `breach-${breach.Name}`,
      label: 'BREACH',
      text: `${breach.Title}: ${breach.PwnCount.toLocaleString()} accounts compromised (${breach.BreachDate})`,
      color: '#ef233c',
    })
  }

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  for (const incident of store.ooniIncidents.slice(0, 3)) {
    const incidentTime = new Date(incident.start_time).getTime()
    if (incidentTime < sevenDaysAgo) continue
    items.push({
      id: `ooni-${incident.id}`,
      label: 'CENSORSHIP',
      text: `${incident.title} (${incident.CCs.join(', ')})`,
      color: '#f77f00',
    })
  }

  for (const key of Object.keys(store.serviceStatuses)) {
    const status = store.serviceStatuses[key]
    if (status && status.indicator !== 'none' && status.indicator !== 'operational') {
      items.push({
        id: `svc-${key}`,
        label: 'OUTAGE',
        text: `${status.name}: ${status.description}`,
        color: '#f77f00',
      })
    }
  }

  for (const port of store.sansTopPorts.slice(0, 3)) {
    items.push({
      id: `port-${port.targetport}`,
      label: 'SCANNING',
      text: `Port ${port.targetport} targeted by ${port.sources.toLocaleString()} sources, ${port.records.toLocaleString()} events (24h)`,
      color: '#00e5ff',
    })
  }

  for (const post of store.communityPosts.slice(0, 5)) {
    const sourceLabel = post.source === 'hn' ? 'HN'
      : post.source === 'reddit' ? 'Reddit'
      : post.source === 'mastodon' ? 'Mastodon'
      : post.source === 'bluesky' ? 'Bluesky'
      : post.source === 'rss' ? 'News'
      : post.source
    items.push({
      id: `community-${post.id}`,
      label: sourceLabel.toUpperCase(),
      text: post.title,
      color: '#808090',
    })
  }

  for (const event of store.tickerEvents.slice(0, 5)) {
    if (items.some(item => item.text === event.text)) continue
    const eventColor = event.severity === 'critical' ? '#ef233c'
      : event.severity === 'high' ? '#f77f00'
      : event.severity === 'warning' ? '#ffbe0b'
      : '#505060'
    items.push({
      id: `event-${event.id}`,
      label: event.source.toUpperCase(),
      text: event.text,
      color: eventColor,
    })
  }

  return items
}

export function BottomTicker() {
  const [items, setItems] = useState<TickerItem[]>([])

  useEffect(() => {
    const interval = setInterval(() => {
      setItems(buildTickerItems())
    }, 3000)
    setItems(buildTickerItems())
    return () => clearInterval(interval)
  }, [])

  const duplicated = useMemo(() => {
    const display = items.slice(0, 40)
    return [...display, ...display]
  }, [items])

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-40 overflow-hidden"
      style={{
        height: '36px',
        background: 'rgba(1, 2, 8, 0.92)',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {duplicated.length > 0 ? (
        <div className="flex items-center h-full ticker-scroll">
          {duplicated.map((item, index) => (
            <span key={`${item.id}-${index}`} className="inline-flex items-center gap-2 whitespace-nowrap mx-8">
              <span className="text-[14px] font-bold" style={{ color: item.color }}>
                {item.label}
              </span>
              <span className="text-[14px]" style={{ color: '#808090' }}>
                {item.text}
              </span>
            </span>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center h-full text-[14px]" style={{ color: '#303040' }}>
          Connecting to data feeds...
        </div>
      )}
    </div>
  )
}
