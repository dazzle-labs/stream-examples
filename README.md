# Dazzle Stream Examples

Runnable examples for [Dazzle](https://dazzle.fm) -- cloud stages that render and broadcast your content as a live stream.

![Preview](hello-world/preview.png)

## Examples

- **[`hello-world`](./hello-world)** -- Cinematic motion graphics. The simplest proof that the pipeline works.
- **[`remotion-stream`](./remotion-stream)** -- Motion graphics with [Remotion](https://remotion.dev). Deterministic, frame-perfect animation.
- **[`claude-code-stream`](./claude-code-stream)** -- Live visualization of a Claude Code session. Every tool call on stream in real time.
- **[`hyperstructure`](./hyperstructure)** -- Raymarched fractal lattice with procedural audio. Pure GPU shader + generative drone. Requires a GPU stage.
- **[`this-day-in-history`](./this-day-in-history)** -- Cinematic broadcast of today's historical events from Wikipedia. Era-aware visuals that age from parchment to electric.
- **[`earth-pulse`](./earth-pulse)** -- Living globe powered by real-time seismic and orbital data. Earthquakes and ISS orbit on a rotating Earth.
- **[`artemis-ii`](./artemis-ii)** -- Real-time countdown and orbital mechanics for the Artemis II mission. Retro mission-control aesthetic.
- **[`solar-storm`](./solar-storm)** -- Real-time space weather visualization. Aurora, lightning, and solar wind driven by live NOAA data.
- **[`particle-life`](./particle-life)** -- Emergent artificial life. 4,000 particles with asymmetric attraction rules produce complex behavior.
- **[`pypi-pulse`](./pypi-pulse)** -- Live PyPI package releases visualized as orbital comets launching from a central nexus. Driven by the PyPI RSS feed.
- **[`ocean-pulse`](./ocean-pulse)** -- Real-time ocean monitoring. 600+ NOAA buoy stations with wave height, water temperature, and wind data on a bioluminescent map.
- **[`bluesky-pulse`](./bluesky-pulse)** -- Live Bluesky firehose visualization. Trending hashtag bubbles, language-coded particle stream, and real-time stats powered by the Jetstream API.
- **[`deep-listen`](./deep-listen)** -- Live underwater hydrophone spectrogram. Real-time audio from Orcasound's Puget Sound hydrophones rendered as a full-canvas waterfall display with logarithmic frequency scaling.
- **[`wikipedia-stream`](./wikipedia-stream)** -- Real-time visualization of Wikipedia edits as they happen. Every edit flows in live from the Wikimedia EventStreams API.
- **[`ai-vtuber`](./ai-vtuber)** -- AI VTuber live stream. A 3D anime character powered by Claude for conversation and Kokoro TTS for voice synthesis. Requires a GPU stage.
- **[`hormuz-watch`](./hormuz-watch)** -- Real-time Strait of Hormuz monitoring. Live vessel positions, prediction market prices, transit counts, oil data, and breaking news.
- **[`meteor-watch`](./meteor-watch)** -- Full-screen radiant sky chart visualizing 10,000+ meteor detections from the Global Meteor Network. Automatic cluster detection with cinematic broadcast styling.

## Quick Start

```bash
# Install Dazzle
curl -sSL https://dazzle.fm/install.sh | sh
dazzle login

# Create a stage and bring it up
dazzle stage create my-stage
dazzle stage up --stage my-stage

# Sync an example
dazzle stage sync ./hello-world --stage my-stage
```

Broadcasting starts automatically when the stage is up. Each example's README has specific run and deploy instructions.

## Links

- [Dazzle](https://dazzle.fm)
- [Content guide](https://dazzle.fm/guide.md)
- [CLI source](https://github.com/dazzle-labs/cli)
- [LLM reference](https://dazzle.fm/llms.txt)
