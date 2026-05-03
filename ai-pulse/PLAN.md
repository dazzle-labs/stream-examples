# ai-pulse: Real-Time AI/ML Intelligence Stream

A live dashboard that visualizes the pulse of the AI/ML ecosystem in real-time: trending papers, model releases, benchmark races, GitHub activity, community discussion, and live inference demos.

## Data Sources (26 verified, all with concrete endpoints)

### Tier 1: Primary Feeds (free, no auth, real-time or near-real-time)

#### 1. Hugging Face Daily Papers
- **Endpoint:** `GET https://huggingface.co/api/daily_papers`
- **Auth:** None
- **Rate:** 500 req / 5 min
- **Data:** ~30 curated papers/day with title, abstract, upvotes, AI-generated summary, AI keywords, GitHub repo link, GitHub stars
- **Use:** Hero panel showing today's hottest papers. Sort by upvotes. Animate new arrivals.

#### 2. Hugging Face Trending Models
- **Endpoint:** `GET https://huggingface.co/api/models?sort=trendingScore&direction=-1&limit=20`
- **Auth:** None
- **Data:** Model name, likes, downloads, trending score, pipeline tag, inference provider mapping
- **Use:** Scrolling ticker of trending models with like counts.

#### 3. ArXiv RSS (combined categories)
- **Endpoint:** `https://rss.arxiv.org/rss/cs.AI+cs.LG+cs.CL+stat.ML`
- **Auth:** None
- **Schedule:** Sun-Thu at 8 PM ET
- **Data:** Title, abstract, authors, categories per paper. Hundreds per day across these categories.
- **Use:** "Paper rain" visualization. New papers fall as particles, cluster by category.

#### 4. ArXiv HTML (full-text, no PDF parsing needed)
- **Endpoint:** `https://arxiv.org/html/{arxiv_id}`
- **Auth:** None
- **Rate:** 1 req / 3 sec
- **Data:** Full paper text as clean HTML. Works for the vast majority of AI/ML papers (LaTeX source).
- **Use:** Extract key sections, figures, equations for deep-dive panels.

#### 5. Arena AI Leaderboard (LMSYS Chatbot Arena)
- **Endpoint:** `GET https://api.wulong.dev/arena-ai-leaderboards/v1/leaderboard?name=text`
- **Auth:** None
- **Data:** Rank, model name, vendor, license, ELO score, 95% CI, vote count across 10 categories (text, code, vision, text-to-image, text-to-video, search, document, image-edit, image-to-video, video-edit)
- **Updated:** Daily
- **Use:** Animated leaderboard with ELO bars. Show rank changes with up/down arrows.

#### 6. Hacker News (Algolia API)
- **Endpoint:** `GET https://hn.algolia.com/api/v1/search_by_date?query=AI+LLM+machine+learning&tags=story&hitsPerPage=50`
- **Auth:** None
- **Data:** Title, URL, points, comment count, author, timestamp
- **Use:** Community signal panel. Filter for AI/ML stories. Show point velocity.

#### 7. Wikipedia EventStream (real-time SSE)
- **Endpoint:** `https://stream.wikimedia.org/v2/stream/recentchange`
- **Auth:** None
- **Data:** Real-time edits to all Wikipedia articles. Filter client-side for AI-related articles.
- **Use:** Background ambient data. Flash when AI articles are edited. Show edit diffs.

#### 8. Bluesky Jetstream (real-time WebSocket)
- **Endpoint:** `wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post`
- **Auth:** None
- **Data:** All public Bluesky posts in real-time. Filter client-side for AI/ML keywords.
- **Use:** Social pulse. Show community reaction velocity to AI news.

#### 9. Mastodon Streaming (real-time WebSocket)
- **Endpoint:** `wss://mastodon.social/api/v1/streaming?stream=hashtag&tag=machinelearning`
- **Auth:** None
- **Data:** Posts tagged #machinelearning, #LLM, #AI in real-time
- **Additional instances:** `sigmoid.social` (ML researchers), `hachyderm.io`
- **Use:** Combined with Bluesky for a "social firehose" panel.

#### 10. Blockchain Mining Difficulty (GPU demand proxy)
- **Endpoint:** `https://api.blockchain.info/charts/hash-rate?timespan=1year&format=json`
- **Auth:** None
- **Data:** Hash rate, difficulty, miners revenue as time series
- **Use:** Background metric. GPU demand indicator correlated with AI compute scarcity.

### Tier 2: Enrichment APIs (free, optional auth for higher limits)

#### 11. Semantic Scholar
- **Endpoint:** `GET https://api.semanticscholar.org/graph/v1/paper/arXiv:{id}?fields=title,abstract,citationCount,influentialCitationCount,tldr,embedding`
- **Auth:** Optional (free API key for 1 req/sec guaranteed)
- **Data:** Citation count, influence metrics, AI-generated TLDR, SPECTER embeddings, related papers
- **Use:** Enrich ArXiv papers with citation context. Power the embedding visualization.

#### 12. Artificial Analysis API
- **Endpoint:** `GET https://artificialanalysis.ai/api/v2/data/llms/models`
- **Auth:** API key (free, 1000 req/day)
- **Data:** Benchmark scores, pricing per million tokens, tokens/second speed for all major LLMs
- **Use:** Price/performance scatter plot. Speed comparison bars.

#### 13. GitHub Events API
- **Endpoint:** `GET https://api.github.com/repos/{owner}/{repo}/events?per_page=100`
- **Auth:** PAT recommended (5,000 req/hr vs 60/hr)
- **Data:** Commits, PRs, issues, stars, forks for tracked repos
- **Key repos:** huggingface/transformers, pytorch/pytorch, vllm-project/vllm, ggml-org/llama.cpp, ollama/ollama, sgl-project/sglang
- **Use:** Activity pulse for the ML open-source ecosystem. llama.cpp releases multiple times per day.

#### 14. GitHub GraphQL (batch stats)
- **Endpoint:** `POST https://api.github.com/graphql`
- **Auth:** PAT required
- **Data:** Star count, fork count, open issues, latest release for many repos in one request
- **Use:** Periodic batch refresh of repo stats. One request covers all tracked repos.

#### 15. HuggingFace Dataset Viewer
- **Endpoint:** `GET https://datasets-server.huggingface.co/rows?dataset={name}&config={config}&split={split}&offset={n}&length=100`
- **Auth:** None
- **Data:** Actual rows from any of 200K+ datasets on HuggingFace
- **Use:** "What are LLMs trained on?" panel. Stream random samples from FineWeb, RedPajama, C4.

#### 16. Finnhub (AI stocks)
- **Endpoint:** `GET https://finnhub.io/api/v1/quote?symbol=NVDA&token={key}`
- **Auth:** API key (free, 30 req/sec)
- **Tickers:** NVDA, AMD, MSFT, GOOG, META, SMCI, ARM, AVGO
- **Data:** Real-time price, change, high/low, volume
- **Use:** AI stock ticker strip. Market sentiment indicator.

#### 17. GPU Price Tracker (GetDeploying)
- **Endpoint:** `GET https://getdeploying.com/api/gpu-offerings?gpu_model=nvidia-h100&sort=price_per_gpu_hour`
- **Auth:** Bearer token (subscription)
- **Data:** 57 providers, 96 GPU models, daily price snapshots
- **Use:** GPU cost comparison chart. H100/H200/B200 price trends.

#### 18. Reddit ML Subreddits
- **Endpoint:** `GET https://www.reddit.com/r/MachineLearning+LocalLLaMA+artificial+deeplearning/new.json?limit=100`
- **Auth:** OAuth recommended (100 req/min)
- **Data:** Posts with title, score, comment count, flair, author
- **Use:** Community discussion feed. Flair-based categorization (Research, Discussion, Project, News).

### Tier 3: Live Inference APIs (paid, for visual demos)

#### 19. Groq (fastest text generation)
- **Endpoint:** OpenAI-compatible, `https://api.groq.com/openai/v1/chat/completions`
- **Speed:** 400-1,000 tokens/sec
- **Models:** Llama 4 Scout, Llama 3.3 70B, Qwen3 32B, Whisper Large v3 Turbo (228x real-time)
- **Pricing:** $0.05-$1.00/MTok
- **Use:** Live text generation demos. Text appears faster than anyone can read. Whisper for live transcription.

#### 20. fal.ai (fastest image generation)
- **Endpoint:** `https://fal.ai/models/{model_id}`
- **Speed:** FLUX Schnell under 1 second
- **Pricing:** $0.008-$0.04/image
- **Use:** Generate images from paper titles, keywords, or chat prompts. Show diffusion denoising steps.

#### 21. Claude API (reasoning + vision)
- **Endpoint:** `https://api.anthropic.com/v1/messages`
- **Models:** Opus 4.6 (1M context), Sonnet 4.6, Haiku 4.5
- **Capabilities:** Streaming, tool use, vision, extended thinking, native PDF ingestion (up to 600 pages)
- **Use:** Paper analysis ("explain this paper in 30 seconds"), PDF reading, agentic demos, extended thinking visualization.

#### 22. OpenAI (image generation + GPT)
- **Models:** GPT Image 1.5 ($0.009/image), GPT-4o, Whisper
- **Use:** Native text-to-image in one model call. Generate visual summaries of papers.

### Tier 4: Creative / Ambient Sources

#### 23. AI Company Blog RSS Feeds
- Google AI: `https://blog.google/technology/ai/rss/`
- DeepMind: `https://deepmind.google/blog/rss.xml`
- OpenAI: `https://openai.com/news/rss.xml`
- Microsoft Research: `https://www.microsoft.com/en-us/research/feed/`
- Meta AI: `https://engineering.fb.com/category/ml-applications/feed/`
- Anthropic (community): `https://raw.githubusercontent.com/taobojlen/anthropic-rss-feed/main/anthropic_news_rss.xml`
- **Use:** "Breaking news" ticker when major labs publish.

#### 24. Newsletter RSS
- Import AI: `https://importai.substack.com/feed`
- Last Week in AI: `https://lastweekin.ai/feed`
- The Batch: `https://charonhub.deeplearning.ai/rss/`
- TLDR AI: `https://tldrai.substack.com/feed`
- **Use:** Weekly digest cards.

#### 25. Stack Overflow ML Tags
- **Endpoint:** `GET https://api.stackexchange.com/2.3/questions?tagged=machine-learning&site=stackoverflow&sort=hot`
- **Auth:** Optional (300 req/day without, 10K with)
- **Use:** "What developers are asking" panel.

#### 26. Kaggle Competition Leaderboards
- **Endpoint:** `GET https://www.kaggle.com/api/v1/competitions/{id}/leaderboard/view`
- **Auth:** API key required
- **Use:** Active competition race visualization.

## PDF Reading Strategy

Three paths, all verified working:

1. **ArXiv HTML** (preferred): `https://arxiv.org/html/{id}` returns clean HTML for most AI/ML papers. Parse with cheerio. No PDF parsing library needed.
2. **Claude native PDF**: Send PDFs directly to Claude API as `document` content blocks. Up to 600 pages, 32 MB. Claude extracts text + renders pages as images.
3. **Fallback (npm)**: `unpdf` package for server-side extraction. `const { text } = await extractText(buffer)`

## Architecture Concept

```
Feeder (Node.js server)
  ├─ Poll: HF Daily Papers (every 5 min)
  ├─ Poll: HF Trending Models (every 5 min)
  ├─ Poll: ArXiv RSS (every 30 min)
  ├─ Poll: Arena AI Leaderboard (every 15 min)
  ├─ Poll: HN Algolia (every 60 sec)
  ├─ Poll: GitHub Events for tracked repos (every 60 sec, with ETags)
  ├─ Poll: GitHub GraphQL batch stats (every 5 min)
  ├─ Poll: Finnhub AI stocks (every 30 sec)
  ├─ Poll: Artificial Analysis (every 30 min)
  ├─ Poll: Reddit ML subs (every 2 min)
  ├─ Poll: Company blog RSS (every 15 min)
  ├─ WebSocket: Wikipedia EventStream (continuous, filtered)
  ├─ WebSocket: Bluesky Jetstream (continuous, keyword-filtered)
  ├─ WebSocket: Mastodon #machinelearning (continuous)
  └─ On-demand: Semantic Scholar enrichment, Claude analysis, fal.ai generation
      │
      ▼
  Dazzle Stage Event API
      │
      ▼
Stage (React 19 + Vite + Tailwind + Canvas 2D)
  ├─ Hero: Today's top paper (title, abstract snippet, upvotes, GitHub stars)
  ├─ Leaderboard: Arena AI ELO rankings with animated rank changes
  ├─ Activity pulse: GitHub commits/PRs/releases as particles
  ├─ Social firehose: Bluesky + Mastodon + HN as flowing text
  ├─ Model ticker: Trending HF models scrolling
  ├─ Stock strip: NVDA, AMD, etc. with sparklines
  ├─ Paper rain: ArXiv submissions as falling particles, colored by category
  └─ Live demo zone: Groq streaming text, fal.ai generating images
```

## Visual Inspiration

From the Dazzle aesthetic guide:
- Dark canvas (#000), electric accents (cyan, magenta, green, amber)
- "Haunted infrastructure" tone: visible broadcast mechanism, data arriving in real-time
- Everything breathes; nothing static
- Hero text spans 60-80% width
- Monospace for system labels, ALL CAPS for signal
- 1280x720 at 30fps

## Rate Budget (per hour, authenticated)

| Source | Requests/hr | Notes |
|--------|------------|-------|
| HF APIs | 720 | Well under 6,000/hr limit |
| ArXiv RSS | 2 | Minimal |
| Arena AI | 4 | Daily data, infrequent polls |
| HN Algolia | 60 | No documented limit |
| GitHub REST | ~1,800 | ETags mean most return 304 (free) |
| GitHub GraphQL | 12 | One batch covers all repos |
| Finnhub | 120 | Well under 108,000/hr limit |
| Reddit | 30 | Well under 6,000/hr limit |
| Semantic Scholar | 240 | On-demand enrichment only |
| Wikipedia SSE | 1 (persistent) | Single connection |
| Bluesky WS | 1 (persistent) | Single connection |
| Mastodon WS | 1 (persistent) | Single connection |

Total REST: ~3,000 req/hr. Well within all limits.

## Key Dependencies

```
# Stage (browser)
react, react-dom, tailwindcss, fast-xml-parser (RSS parsing)

# Feeder (Node.js)
fast-xml-parser (RSS/Atom), eventsource (SSE), ws (WebSocket)

# Optional (for live demos)
@anthropic-ai/sdk, openai (for Groq), @fal-ai/client
```

## Open Questions

1. How many "scenes" should the stage rotate through vs. showing everything at once?
2. Should live inference demos (Groq text, fal.ai images) run continuously or be triggered by events?
3. Should the feeder run Claude to generate spoken summaries of trending papers (via ElevenLabs TTS at 75ms latency)?
4. Should there be an embedding space visualization (Three.js 3D star-field of paper embeddings via Semantic Scholar SPECTER vectors)?
5. How prominent should the stock ticker be? Informational sidebar vs. always-visible strip?
