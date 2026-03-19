# Remotion Stream

Cinematic motion graphics built with [Remotion](https://remotion.dev) and rendered in-browser using `@remotion/player`. Five scenes of broadcast-quality visuals -- signal lock, counting numbers, waveform analysis, typewriter titles, orbital particles -- all running on a software renderer through [Dazzle](https://dazzle.fm).

No dashboards. No cards. No fake data. One hero per scene. Everything breathes.

## What It Demonstrates

Using Remotion's `<Player>` component to render a React-based composition directly in the browser, then syncing the built output to a Dazzle stage for live broadcasting. Every animation is driven by `useCurrentFrame()` and Remotion's `spring()` physics -- no CSS transitions, no `requestAnimationFrame`. Time is deterministic. The composition loops every 20 seconds at 30fps, matching Dazzle's capture rate.

## Prerequisites

- [Node.js](https://nodejs.org) 18+
- [Dazzle CLI](https://dazzle.fm) (`curl -sSL https://raw.githubusercontent.com/dazzle-labs/stream-examples/main/install.sh | sh`)

## Run It

```bash
# Install dependencies
npm install

# Start the dev server (opens at http://localhost:5173)
npm start
```

## Sync to Dazzle

```bash
# Build the static site
npm run build

# Create a stage
dazzle stage create remotion-stream

# Sync the built output
dazzle stage sync ./dist --stage remotion-stream --watch

# Verify it looks right
dazzle stage screenshot --stage remotion-stream --out preview.png

# Go live
dazzle stage broadcast start --stage remotion-stream
```

## Scenes

Five cinematic moments with hard-cut transitions between each:

1. **Signal Lock** -- A signal indicator circle pulses and locks. "SIGNAL ACQUIRED" decodes character by character from scrambled glyphs, each character resolving from random noise to its final letter. "LOCKING TRANSMISSION" decodes beneath it. 40 frequency bars rise at the bottom, each on its own staggered entrance with sine-wave modulation. The broadcast is waking up.

2. **The Number** -- A single massive number at 200px font size counts up from zero to 27,384, filling 70% of the frame. Spring entrance with overshoot and settle (mass 1.2, low stiffness for that heavy feel). The number breathes after it lands. Corner markers frame the broadcast. An accent line expands beneath. The label "FRAMES RENDERED" fades in with a vertical slide. Awe at scale -- a number filling the screen should feel like staring up at a building.

3. **Waveform** -- Three compound waveforms stretch edge to edge across all 1280 pixels. The primary wave uses four layered sine functions with an envelope that tapers at the edges. A secondary wave in purple and a tertiary in amber add depth. Tick marks, a dashed center reference line, and a gradient fill under the primary. A Hz readout in the top left pulses with the wave. "FREQUENCY ANALYSIS" decodes character by character at the bottom.

4. **Transmission** -- "THE SIGNAL IS THE SHOW" types out character by character across two lines at 110px sans-serif. Movie title card energy. A blinking cyan cursor tracks the typing position. A magenta accent line expands below with spring easing, then pulses once fully extended. A timestamp counter ticks in the bottom right corner. The reveal IS the content.

5. **Orbital** -- 16 particles orbit in a breathing ring, each on its own staggered spring entrance and individual breathing rhythm. The ring rotates slowly. Particle colors shift through purple hues (260-356). A ghost ring track and inner reference ring in dashed stroke provide structure. A center dot pulses. "END TRANSMISSION" decodes from scrambled glyphs, then the scene fades to black for a seamless loop.

## Technical Notes

- All rendering uses React DOM elements and SVG -- no canvas, no WebGL, no heavy shaders
- All animation driven by `useCurrentFrame()` -- deterministic, frame-perfect
- Atmospheric background (grid, vignette, scan artifacts, drifting gradients) runs continuously across all scenes
- Spring physics via Remotion's `spring()` for entrances with overshoot and settle
- Deterministic scramble characters for text decode effects (seeded from frame number via `sin` hash)
- Software renderer safe: every visual effect is flat CSS or inline SVG styles

## How It Works

Remotion compositions are React components where time is a function of the current frame. Instead of `requestAnimationFrame` loops, you call `useCurrentFrame()` and derive all visual state from that frame number. The `@remotion/player` package wraps this in a `<Player>` component that runs the composition in-browser -- exactly what Dazzle needs: a web page it can capture.

The Vite build produces a static `dist/` directory containing `index.html` and bundled JS. Dazzle syncs this directory to its cloud browser, renders it at 1280x720, and broadcasts the output.

## Source Files

| File | What It Does |
|------|-------------|
| `src/scenes/SignalLock.tsx` | Signal indicator, text decode, frequency bars |
| `src/scenes/TheNumber.tsx` | Massive counting number with spring physics and corner markers |
| `src/scenes/Waveform.tsx` | Three-layer compound waveform with Hz readout |
| `src/scenes/Transmission.tsx` | Typewriter text reveal with cursor and accent line |
| `src/scenes/Orbital.tsx` | Particle ring with breathing animation and end transmission decode |
