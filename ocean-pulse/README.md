# Ocean Pulse

Real-time visualization of NOAA NDBC ocean buoy observations. Hundreds of buoy stations rendered as bioluminescent nodes on a dark ocean map, each pulsing with live sensor data -- wave height, water temperature, wind speed and direction.

## What it demonstrates

- Canvas 2D rendering of a geo-projected map with hundreds of animated data points
- Real-time polling of NOAA's National Data Buoy Center observation feed
- Smooth interpolation between data updates for fluid transitions
- Temperature-mapped color gradients, wave-height-driven pulse animations, and wind vector overlays

## How to run

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## What you should see

A 1280x720 dark ocean canvas with simplified US coastline outlines. Buoy stations appear as glowing dots:

- **Color** = water temperature (blue = cold, red = warm)
- **Size/pulse** = wave height (calm = small steady glow, rough = large pulsing)
- **Arrows** = wind direction and speed

Ambient wave patterns drift across the background. Stats overlay shows station count, average wave height, and max wind speed.

## Data source

- **Primary**: `https://www.ndbc.noaa.gov/data/latest_obs/latest_obs.txt` -- space-delimited text file with all active NDBC buoy observations
- Polls every 5 minutes
- Falls back to a CORS proxy (`corsproxy.io`) if direct fetch is blocked, and to demo data if both fail

## CORS note

NOAA's data files may not include CORS headers depending on the deployment context. The example tries direct fetch first, then a public CORS proxy. For production use, proxy through your own backend or use `dazzle` which handles this server-side.
