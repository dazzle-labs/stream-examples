# Traffic Pulse

A machine that locks onto major US cities one by one, decodes their traffic signals, and renders congestion as glowing veins on a dark map.

Cycles through 12 metro areas (NYC, LA, Chicago, Houston, Dallas, Atlanta, Miami, SF Bay, Seattle, Boston, DC, Denver) every ~32 seconds each, showing real-time traffic jams and accidents from the TomTom Traffic API overlaid on a dark basemap.

## Setup

1. Get a free TomTom API key at [developer.tomtom.com](https://developer.tomtom.com/)
2. Create a `.env` file:

```
VITE_TOMTOM_API_KEY=your_key_here
```

3. Install and run:

```bash
npm install
npm run dev
```

## Stack

- React 19 + TypeScript + Tailwind 4 + Vite
- MapLibre GL JS with CartoDB dark matter tiles
- TomTom Traffic Incident Details API v5

## How It Works

The stream cycles through a state machine for each city: **tuning** (signal lock overlay, map flies to city) -> **arriving** (overlays animate in, data loads) -> **holding** (25s display) -> **departing** (overlays fade). Data for the next city is prefetched during the holding phase. Results are cached for 10 minutes to stay within the free API tier (~2,500 requests/day).

Traffic jams render as colored polylines by severity (green/yellow/orange/red). Accidents appear as pulsing red dots. A stats panel shows active jam count, worst delay, and a severity breakdown bar.
