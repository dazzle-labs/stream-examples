# Solar Storm

Real-time space weather visualization showing aurora borealis, lightning strikes, and solar wind — driven by live NOAA data. Built for [Dazzle](https://dazzle.fm) broadcast streaming at 1280x720 @ 30fps.

## What it demonstrates

- Orthographic globe projection rendered on Canvas 2D with continent outlines, graticule grid, and day/night terminator
- Aurora borealis visualization using live NOAA OVATION aurora probability data (65,160 grid points), rendered as shimmering, color-shifting curtains of light near the poles
- Solar wind particle system driven by real DSCOVR satellite measurements — particle speed and density reflect actual conditions
- Procedurally generated lightning strikes weighted toward tropical convergence zones and mid-latitude storm tracks
- Live status bar showing Kp geomagnetic index, solar wind speed, IMF Bz component, and plasma density

## How to run

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in a browser.

To build for production:

```bash
npm run build
npm run preview
```

## What you should see

A slowly rotating Earth globe against a starfield. Green and purple aurora bands shimmer near the poles, their intensity driven by real space weather data. Amber solar wind particles stream in from the left, curving along magnetic field lines as they approach the magnetosphere. Brief white lightning flashes pop across tropical and mid-latitude regions. A thin atmospheric rim glows blue on the day side. A minimal status bar at the bottom displays live Kp index, solar wind speed, Bz, and plasma density — all from NOAA's real-time feeds.

## Data sources

- **Aurora**: [NOAA OVATION Aurora Model](https://services.swpc.noaa.gov/json/ovation_aurora_latest.json) — updated every 5 minutes
- **Solar Wind Plasma**: [NOAA DSCOVR Plasma](https://services.swpc.noaa.gov/products/solar-wind/plasma-5-minute.json) — updated every ~1 minute
- **Solar Wind Magnetic Field**: [NOAA DSCOVR MAG](https://services.swpc.noaa.gov/products/solar-wind/mag-5-minute.json) — updated every ~1 minute
- **Kp Index**: [NOAA Planetary K-Index](https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json) — updated every 3 hours
- **Lightning**: Procedurally simulated (weighted to ITCZ and storm tracks)
