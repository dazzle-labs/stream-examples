# PyPI Pulse

A cinematic visualization of real-time PyPI package releases, rendered as a living constellation of luminous orbs drifting through deep space. Each release materializes with a bright flash, drifts slowly across the canvas, then fades to a ghostly trace.

## What it demonstrates

- Real-time RSS feed polling (PyPI updates feed)
- Canvas 2D particle system with glow, trails, and bloom effects
- Ambient data visualization designed for always-on TV/display usage
- Metadata enrichment via PyPI JSON API

## How to run

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## What you should see

A 1280x720 dark canvas with luminous orbs appearing every few seconds -- each representing a new package release on PyPI. Orbs are color-coded by package name (consistent hue hashing), sized by version significance (major releases are large, patches are small), and connected by subtle lines when released close together. A minimal stats overlay in the bottom-right shows release rate and totals.

If the PyPI RSS feed is blocked by CORS, the visualization falls back to simulated data using real package names.

## Data sources

- **RSS feed**: `https://pypi.org/rss/updates.xml` (polled every 30 seconds)
- **Enrichment**: `https://pypi.org/pypi/{name}/{version}/json` (license, size, Python version)
