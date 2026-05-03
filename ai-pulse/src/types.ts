export interface Paper {
  id: string
  title: string
  abstract: string
  authors: string[]
  upvotes: number
  category: string
  keywords: string[]
  githubStars: number | null
  publishedAt: string
}

export interface LeaderboardEntry {
  rank: number
  model: string
  vendor: string
  elo: number
  change: number
  category: string
}

export interface TrendingModel {
  id: string
  name: string
  author: string
  likes: number
  pipeline: string
  trendingScore: number
}

export interface SocialPost {
  id: string
  source: 'hn' | 'bluesky' | 'mastodon' | 'reddit'
  title: string
  score: number
  timestamp: number
  url: string
}

export interface StockQuote {
  ticker: string
  label: string
  price: number
  changePercent: number
}

export type ParticleKind = 'paper' | 'commit' | 'star' | 'social' | 'release'

export interface ActivityEvent {
  kind: ParticleKind
  label: string
  timestamp: number
}

export interface PulseState {
  papers: Paper[]
  heroPaper: Paper | null
  leaderboard: LeaderboardEntry[]
  trendingModels: TrendingModel[]
  socialFeed: SocialPost[]
  stocks: StockQuote[]
  activityEvents: ActivityEvent[]
  connected: boolean
  paperCount: number
  modelCount: number
  eventRate: number
}
