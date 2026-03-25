# Artemis II — Moon Mission Countdown & Trajectory Tracker

A broadcast-quality, real-time countdown and orbital mechanics visualization for the Artemis II mission — humanity's first crewed flight to the Moon in over 54 years, launching April 1, 2026 at 22:24 UTC.

## What It Demonstrates

- **Hybrid Canvas + DOM rendering**: Canvas 2D for the animated orbital diagram (stars, Earth, Moon, trajectory path, spacecraft dot) combined with React/DOM for crisp text panels, countdown timer, and telemetry data.
- **Real-time mission state**: Countdown timer switches to Mission Elapsed Time at launch. Telemetry gauges (distance, velocity) update continuously based on a simplified free-return trajectory model.
- **Retro-futuristic mission control aesthetic**: CRT scanline overlay, amber/cyan color palette, IBM Plex Mono telemetry readouts, and a pulsing countdown glow that feels like a NASA FIDO console.

## How to Run

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in a browser.

To build for production:

```bash
npm run build
npm run preview
```

## What You Should See

A 1280x720 mission control display with:

- **Top center**: A large countdown timer (T- DD:HH:MM:SS) glowing in amber, counting down to the April 1, 2026 launch. After launch, it switches to cyan Mission Elapsed Time.
- **Center**: An animated orbital diagram showing Earth (with blue atmosphere rim), the Moon (with craters and grey glow), the planned free-return trajectory arc in cyan, and a pulsing amber dot representing the Orion spacecraft.
- **Right panels**: Telemetry gauges (distance from Earth, velocity) and crew roster (Wiseman, Glover, Koch, Hansen).
- **Bottom**: Mission phase timeline showing the progression from Launch through Trans-Lunar Injection, Lunar Transit, Lunar Flyby, Return Transit, and Reentry.
- **Atmosphere**: Twinkling stars, faint grid lines, and a subtle CRT scanline overlay.

The visualization runs at 30fps and is designed to be streamed live via Dazzle to YouTube/Twitch.
