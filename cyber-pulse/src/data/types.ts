export type BroadcastMode = 'patrol' | 'alert' | 'breaking'

export type InfoconLevel = 'green' | 'yellow' | 'orange' | 'red'

export type SceneName =
  | 'weather'
  | 'pulse'
  | 'grid'
  | 'feed'
  | 'map'
  | 'network'
  | 'lifecycle'
  | 'conversation'
  | 'breach'
  | 'freedom'

export interface SceneConfig {
  name: SceneName
  patrolDuration: number
  alertDuration: number
  skipInAlert: boolean
}

export const SCENE_ORDER: SceneConfig[] = [
  { name: 'weather', patrolDuration: 12000, alertDuration: 8000, skipInAlert: false },
  { name: 'pulse', patrolDuration: 12000, alertDuration: 0, skipInAlert: true },
  { name: 'grid', patrolDuration: 15000, alertDuration: 12000, skipInAlert: false },
  { name: 'feed', patrolDuration: 25000, alertDuration: 20000, skipInAlert: false },
  { name: 'map', patrolDuration: 15000, alertDuration: 12000, skipInAlert: false },
  { name: 'network', patrolDuration: 15000, alertDuration: 12000, skipInAlert: false },
  { name: 'lifecycle', patrolDuration: 15000, alertDuration: 12000, skipInAlert: false },
  { name: 'conversation', patrolDuration: 15000, alertDuration: 10000, skipInAlert: false },
  { name: 'breach', patrolDuration: 12000, alertDuration: 0, skipInAlert: true },
  { name: 'freedom', patrolDuration: 12000, alertDuration: 0, skipInAlert: true },
]

export interface TopPort {
  targetport: number
  records: number
  sources: number
  targets: number
}

export interface TopIP {
  source: string
  count: number
  attacks: number
  firstseen: string
  lastseen: string
}

export interface AttackSource {
  source: string
  count: number
  firstseen: string
  lastseen: string
}

export interface CVEEntry {
  id: string
  description: string
  cvssScore: number
  severity: string
  published: string
  lastModified: string
  vendorProject: string
  product: string
  isKEV: boolean
  epssScore: number
  epssPercentile: number
}

export interface KEVEntry {
  cveID: string
  vendorProject: string
  product: string
  vulnerabilityName: string
  dateAdded: string
  shortDescription: string
  knownRansomwareCampaignUse: string
}

export interface GithubAdvisory {
  ghsaId: string
  cveId: string
  summary: string
  severity: string
  publishedAt: string
}

export interface FeodoC2 {
  ip_address: string
  port: number
  status: string
  hostname: string
  as_number: number
  as_name: string
  country: string
  first_seen: string
  last_online: string
  malware: string
}

export interface Breach {
  Name: string
  Title: string
  Domain: string
  BreachDate: string
  PwnCount: number
  DataClasses: string[]
  IsVerified: boolean
}

export interface RansomwarePayment {
  address: string
  blockchain: string
  transactions: Array<{
    amount: number
    amountUSD: number
    time: string
  }>
}

export interface ServiceStatus {
  name: string
  status: string
  description: string
  updatedAt: string
  indicator: string
}

export interface OONIIncident {
  id: string
  title: string
  short_description: string
  start_time: string
  end_time: string
  CCs: string[]
  ASNs: number[]
  published: boolean
  event_type: string
}

export interface FeedItem {
  id: string
  type: 'cve' | 'kev' | 'advisory' | 'news'
  title: string
  description: string
  severity: string
  cvssScore: number
  source: string
  timestamp: string
  isKEV: boolean
  epssScore: number
  vendorProject: string
  product: string
}

export interface CommunityPost {
  id: string
  source: 'hn' | 'reddit' | 'mastodon' | 'bluesky' | 'rss'
  title: string
  url: string
  score: number
  timestamp: string
  cveIds: string[]
}

export interface TickerEvent {
  id: string
  source: string
  text: string
  severity: string
  timestamp: number
}

export interface BreakingEvent {
  cveId: string
  description: string
  signals: string[]
  timestamp: number
}
