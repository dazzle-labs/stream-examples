# Bluesky Pulse

Real-time visualization of the Bluesky firehose. Connects directly to Bluesky's Jetstream WebSocket to show the pulse of the network — what people are posting, which languages they speak, and what's trending right now.

## What it demonstrates

- Direct browser WebSocket connection to Bluesky Jetstream (no auth required)
- High-throughput event processing (200-700 events/second) with sampling for visualization
- Canvas 2D particle rendering with force-directed graph layout
- Hybrid Canvas + React DOM rendering for performance

## How to run

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## What you should see

A 1280x720 visualization with three zones:

- **The Stream** (left) — a waterfall of luminous particles, each representing a post. Color indicates language.
- **Trending Gravity** (center) — a force-directed particle field where trending hashtags become glowing gravity wells.
- **The Dashboard** (right) — live stats including events/second sparkline, language distribution, activity breakdown, and a rotating sample post.

Data starts flowing immediately on connection. Hashtag trends emerge after 30-60 seconds.
