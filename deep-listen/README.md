# Deep Listen

Live underwater hydrophone spectrogram. Real-time audio from [Orcasound](https://www.orcasound.net/) hydrophones in Puget Sound, rendered as a full-canvas waterfall display.

## What it demonstrates

- Consuming live HLS audio streams via hls.js (CDN-loaded)
- Web Audio API FFT analysis with logarithmic frequency scaling
- Canvas 2D waterfall spectrogram rendering with a pre-computed colormap LUT
- Node cycling with audio/visual crossfade between hydrophone stations
- 60fps rendering with putImageData column drawing

## How to run

```bash
npm install && npm run dev
```

## What you should see

A single spectrogram fills the entire 1280x720 canvas. Frequency is on the Y-axis (logarithmic -- low frequencies occupy more space), time scrolls right-to-left. The browser plays the actual underwater audio.

- **Whale calls** appear as bright swooping curves in the 1-6kHz range
- **Ship noise** shows as broadband bands in the low frequencies (50-200Hz)
- **Rain** creates high-frequency shimmer above 10kHz
- **Echolocation clicks** are sharp bright dots in the 10-20kHz range

The display cycles between hydrophone nodes every 2.5 minutes with a smooth crossfade. Frequency markers on the left edge (100Hz, 1kHz, 5kHz, 10kHz) and a subtle glow band highlight the whale-call frequency range.

## Data source

Audio streams provided by [Orcasound](https://www.orcasound.net/), a community-driven project for listening to Pacific Northwest orcas. Hydrophone feeds are public, unauthenticated HLS streams hosted on AWS S3.

- Port Townsend (`rpi_port_townsend`)
- Sunset Bay (`rpi_sunset_bay`)
- North San Juan Channel (`rpi_north_sjc`)
