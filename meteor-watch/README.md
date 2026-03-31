# Meteor Watch

A full-screen radiant sky chart visualizing 10,000+ recent meteor detections from the Global Meteor Network. Shows where in space meteors are coming from, with automatic cluster detection highlighting active shower regions.

## Setup

No API keys needed. The GMN Datasette API is completely free and open.

```bash
npm install
npm run dev
```

## Stack

- React 19 + TypeScript + Tailwind 4 + Vite
- Canvas2D density heatmap with cluster detection
- Web Audio API for procedural ambient sound
- Global Meteor Network Datasette API (~2,600 meteors/day)

## How It Works

Fetches 10,000 recent meteor observations from GMN (10 pages, refreshes every 30 minutes). Each meteor has a radiant (the point in the sky it appeared to come from), which is plotted on an equatorial sky chart as a density heatmap. Shower meteors (from known debris streams) cluster at specific radiant positions; random background debris is scattered across the sky.

Automatic cluster detection finds statistically anomalous concentrations, labels them with the matched shower name (or "Unknown source"), count, velocity, and active date range. Clusters with detections in the last 12 hours get an "ACTIVE" badge.

Data persists to localStorage for instant rendering on reload. Procedural ambient sound (drone, data ticks, cluster resolve tones) via Web Audio API.
