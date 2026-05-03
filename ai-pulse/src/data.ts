import type {
  PulseState,
  ActivityEvent,
  Paper,
  LeaderboardEntry,
  TrendingModel,
  SocialPost,
  StockQuote,
} from './types'

type StateCallback = (state: PulseState) => void
type ActivityCallback = (event: ActivityEvent) => void

interface HFDailyPaper {
  paper: {
    id: string
    title: string
    summary: string
    authors: Array<{ name: string }>
    upvotes: number
    ai_keywords?: string[]
  }
  numComments: number
}

interface ArenaModel {
  rank: number
  model: string
  vendor: string
  score: number
  ci: number
}

interface ArenaResponse {
  category: string
  models: ArenaModel[]
}

interface HFModel {
  id: string
  likes: number
  pipeline_tag: string
  trendingScore: number
}

interface HNHit {
  objectID: string
  title: string
  points: number
  created_at_i: number
  url: string
}

async function fetchHFPapers(): Promise<Paper[]> {
  const response = await fetch('https://huggingface.co/api/daily_papers?limit=20')
  if (!response.ok) { console.error('HF papers:', response.status); return [] }
  const data = await response.json() as HFDailyPaper[]
  return data.map(item => ({
    id: item.paper.id,
    title: item.paper.title,
    abstract: item.paper.summary,
    authors: item.paper.authors.map(author => author.name),
    upvotes: item.paper.upvotes,
    category: 'cs.AI',
    keywords: item.paper.ai_keywords?.slice(0, 4) ?? [],
    githubStars: null,
    publishedAt: new Date().toISOString().slice(0, 10),
  }))
}

async function fetchArenaLeaderboard(): Promise<LeaderboardEntry[]> {
  const response = await fetch(
    'https://api.wulong.dev/arena-ai-leaderboards/v1/leaderboard?name=text',
  )
  if (!response.ok) { console.error('Arena:', response.status); return [] }
  const data = await response.json() as ArenaResponse
  return data.models.slice(0, 8).map(model => ({
    rank: model.rank,
    model: model.model,
    vendor: model.vendor ?? '',
    elo: Math.round(model.score),
    change: 0,
    category: 'text',
  }))
}

async function fetchTrendingModels(): Promise<TrendingModel[]> {
  const response = await fetch(
    'https://huggingface.co/api/models?sort=trendingScore&direction=-1&limit=12',
  )
  if (!response.ok) { console.error('HF models:', response.status); return [] }
  const data = await response.json() as HFModel[]
  return data.map(model => {
    const parts = model.id.split('/')
    return {
      id: model.id,
      name: parts[1] ?? model.id,
      author: parts[0] ?? '',
      likes: model.likes,
      pipeline: model.pipeline_tag ?? 'unknown',
      trendingScore: model.trendingScore,
    }
  })
}

async function fetchHackerNews(): Promise<SocialPost[]> {
  const response = await fetch(
    'https://hn.algolia.com/api/v1/search?query=AI+LLM+machine+learning+GPT+transformer&tags=story&hitsPerPage=20&numericFilters=points%3E10',
  )
  if (!response.ok) { console.error('HN:', response.status); return [] }
  const data = await response.json() as { hits: HNHit[] }
  return data.hits.map(hit => ({
    id: `hn-${hit.objectID}`,
    source: 'hn' as const,
    title: hit.title,
    score: hit.points,
    timestamp: hit.created_at_i * 1000,
    url: hit.url ?? '',
  }))
}

export function createDataManager(
  onState: StateCallback,
  onActivity: ActivityCallback,
): { destroy: () => void } {
  let papers: Paper[] = []
  let leaderboard: LeaderboardEntry[] = []
  let trendingModels: TrendingModel[] = []
  let socialFeed: SocialPost[] = []
  let stocks: StockQuote[] = []
  let heroIndex = 0
  let connected = false
  const timers: ReturnType<typeof setInterval>[] = []

  function emitState(): void {
    const hero = papers[heroIndex % Math.max(papers.length, 1)]
    onState({
      papers,
      heroPaper: hero ?? null,
      leaderboard,
      trendingModels,
      socialFeed: socialFeed.slice(0, 8),
      stocks,
      activityEvents: [],
      connected,
      paperCount: papers.length,
      modelCount: trendingModels.length,
      eventRate: socialFeed.length,
    })
  }

  async function refreshPapers(): Promise<void> {
    const result = await fetchHFPapers()
    if (result.length > 0) {
      const previousCount = papers.length
      papers = result
      connected = true
      if (previousCount > 0) {
        for (let i = 0; i < Math.min(3, result.length); i++) {
          onActivity({ kind: 'paper', label: result[i]?.title ?? '', timestamp: Date.now() })
        }
      }
      emitState()
    }
  }

  async function refreshLeaderboard(): Promise<void> {
    const result = await fetchArenaLeaderboard()
    if (result.length > 0) {
      leaderboard = result
      emitState()
    }
  }

  async function refreshModels(): Promise<void> {
    const result = await fetchTrendingModels()
    if (result.length > 0) {
      const previousCount = trendingModels.length
      trendingModels = result
      if (previousCount > 0) {
        onActivity({ kind: 'star', label: 'trending model', timestamp: Date.now() })
      }
      emitState()
    }
  }

  async function refreshSocial(): Promise<void> {
    const result = await fetchHackerNews()
    if (result.length > 0) {
      const previousIds = new Set(socialFeed.map(post => post.id))
      socialFeed = result
      const newPosts = result.filter(post => !previousIds.has(post.id))
      for (const _post of newPosts.slice(0, 3)) {
        onActivity({ kind: 'social', label: 'new story', timestamp: Date.now() })
      }
      emitState()
    }
  }

  function handleDazzleEvent(event: Event): void {
    const detail = (event as CustomEvent).detail
    if (!detail) return
    try {
      const data = typeof detail === 'string' ? JSON.parse(detail) : detail
      if (data.type === 'stocks' && Array.isArray(data.quotes)) {
        stocks = data.quotes as StockQuote[]
        emitState()
      }
      if (data.type === 'activity') {
        onActivity(data.event as ActivityEvent)
      }
    } catch {
      // skip
    }
  }

  window.addEventListener('ai-pulse-data', handleDazzleEvent)

  refreshPapers().catch(error => console.error('papers:', error))
  refreshLeaderboard().catch(error => console.error('arena:', error))
  refreshModels().catch(error => console.error('models:', error))
  refreshSocial().catch(error => console.error('social:', error))

  timers.push(setInterval(() => {
    heroIndex = (heroIndex + 1) % Math.max(papers.length, 1)
    emitState()
  }, 12000))

  timers.push(setInterval(refreshPapers, 300000))
  timers.push(setInterval(refreshLeaderboard, 900000))
  timers.push(setInterval(refreshModels, 300000))
  timers.push(setInterval(refreshSocial, 60000))

  timers.push(setInterval(() => {
    if (papers.length > 0) {
      onActivity({ kind: 'commit', label: 'github activity', timestamp: Date.now() })
    }
  }, 2000))

  return {
    destroy() {
      for (const timer of timers) clearInterval(timer)
      window.removeEventListener('ai-pulse-data', handleDazzleEvent)
    },
  }
}
