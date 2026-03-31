import type {
  InfoconLevel,
  BroadcastMode,
  TopPort,
  TopIP,
  CVEEntry,
  KEVEntry,
  FeodoC2,
  Breach,
  RansomwarePayment,
  ServiceStatus,
  OONIIncident,
  FeedItem,
  CommunityPost,
  TickerEvent,
  BreakingEvent,
} from './types'

export interface DataStore {
  sansInfocon: InfoconLevel
  sansTopPorts: TopPort[]
  sansTopIPs: TopIP[]
  recentCVEs: CVEEntry[]
  kevEntries: KEVEntry[]
  githubAdvisories: CVEEntry[]
  feodoC2s: FeodoC2[]
  breaches: Breach[]
  latestBreach: Breach | null
  ransomwarePayments: RansomwarePayment[]
  serviceStatuses: Record<string, ServiceStatus>
  ooniIncidents: OONIIncident[]
  feedQueue: FeedItem[]
  communityPosts: CommunityPost[]
  rssItems: CommunityPost[]
  blueskyPosts: CommunityPost[]
  tickerEvents: TickerEvent[]
  threatWeather: number
  broadcastMode: BroadcastMode
  breakingEvent: BreakingEvent | null
  cvesPublishedToday: number
  kevAdditionsThisWeek: number
  activeC2Count: number
  degradedServiceCount: number
  lastUpdated: Record<string, number>
}

export const store: DataStore = {
  sansInfocon: 'green',
  sansTopPorts: [],
  sansTopIPs: [],
  recentCVEs: [],
  kevEntries: [],
  githubAdvisories: [],
  feodoC2s: [],
  breaches: [],
  latestBreach: null,
  ransomwarePayments: [],
  serviceStatuses: {},
  ooniIncidents: [],
  feedQueue: [],
  communityPosts: [],
  rssItems: [],
  blueskyPosts: [],
  tickerEvents: [],
  threatWeather: 0,
  broadcastMode: 'patrol',
  breakingEvent: null,
  cvesPublishedToday: 0,
  kevAdditionsThisWeek: 0,
  activeC2Count: 0,
  degradedServiceCount: 0,
  lastUpdated: {},
}

export function addTickerEvent(source: string, text: string, severity: string = 'info') {
  store.tickerEvents.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    source,
    text,
    severity,
    timestamp: Date.now(),
  })
  if (store.tickerEvents.length > 100) {
    store.tickerEvents.length = 100
  }
}

export function computeThreatWeather(): number {
  const infoconScore: Record<InfoconLevel, number> = {
    green: 0,
    yellow: 15,
    orange: 35,
    red: 60,
  }

  const baseline = JSON.parse(localStorage.getItem('cyber-pulse:baselines') ?? '{}') as Record<string, number>
  const cveBaseline = baseline['dailyCVEs'] ?? 30
  const kevBaseline = baseline['weeklyKEV'] ?? 3

  const infoconWeight = (infoconScore[store.sansInfocon] ?? 0) / 100
  const cveVelocity = Math.min(1, (store.cvesPublishedToday / Math.max(1, cveBaseline)) - 0.5)
  const kevRate = Math.min(1, store.kevAdditionsThisWeek / Math.max(1, kevBaseline))
  const serviceHealth = Math.min(1, store.degradedServiceCount / 5)
  const portDiversity = Math.min(1, store.sansTopPorts.length / 20)
  const malwareRate = Math.min(1, store.feodoC2s.filter(c2 => c2.status === 'online').length / 50)
  const socialVolume = Math.min(1, store.communityPosts.length / 30)
  const ooniEvents = Math.min(1, store.ooniIncidents.length / 5)

  const score = (
    infoconWeight * 20 +
    Math.max(0, cveVelocity) * 15 +
    kevRate * 15 +
    serviceHealth * 15 +
    portDiversity * 10 +
    malwareRate * 10 +
    socialVolume * 10 +
    ooniEvents * 5
  )

  return Math.round(Math.min(100, Math.max(0, score)))
}

export function updateBroadcastMode() {
  const score = computeThreatWeather()
  store.threatWeather = score

  if (store.breakingEvent) {
    store.broadcastMode = 'breaking'
  } else if (score >= 40) {
    store.broadcastMode = 'alert'
  } else {
    store.broadcastMode = 'patrol'
  }
}
