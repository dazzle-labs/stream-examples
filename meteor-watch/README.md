# Meteor Watch

A 3D globe tracking meteors entering Earth's atmosphere in real time. Data from the Global Meteor Network (citizen science camera stations worldwide) and NASA CNEOS fireball database.

Meteors animate as glowing streaks from entry to burnout, color-coded by velocity (blue for slow, cyan for medium, white for fast, orange for hypersonic). Major CNEOS fireballs trigger dramatic screen flashes with energy readouts.

## Setup

No API keys needed. Both data sources are completely free and open.

```bash
npm install
npm run dev
```

## Stack

- React 19 + TypeScript + Tailwind 4 + Vite
- Custom WebGL2 globe renderer (zero runtime deps beyond React)
- Canvas2D overlay for meteor streak animation
- Global Meteor Network Datasette API (~2,600 meteors/day)
- NASA CNEOS Fireball API (major events with energy data)

## How It Works

The globe rotates slowly (3-minute period) with a star field, warm amber graticule, and day/night terminator. Meteors are fetched in batches from GMN every 30 minutes and queued for playback at ~1 every 2.5 seconds. Each streak animates over 1.5 seconds (3 seconds for fireballs) from entry point to burnout point using the actual trajectory coordinates.

The overlay shows detection count, queue depth, active meteor shower info (when applicable), and per-event details (velocity, magnitude, shower association).
