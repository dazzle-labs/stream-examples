# artemis-tracker

Real-time Artemis II mission tracking dashboard with orbital visualization and live telemetry. Simulates the full 10-day lunar flyby mission in a 10-minute loop.

![Artemis Tracker](screenshot.png)

## Features

- **Orbital visualization**: Animated star field, Earth, Moon, and Orion spacecraft with glowing trajectory arc rendered on HTML5 canvas
- **Live telemetry**: Earth/Moon distance, velocity, radio delay with sparkline history charts
- **Mission timeline**: 20 milestones with completion status and countdown timers
- **DSN communications**: Signal strength, active station rotation (Goldstone/Madrid/Canberra), bandwidth indicator, blackout detection behind the Moon
- **Crew vitals**: Heart rates, sleep/wake cycles, status indicators for all four crew members
- **Spacecraft systems**: Cabin temperature, pressure, power draw, fuel remaining
- **HUD design**: Glassmorphism panels, Orbitron display font, cyan glow effects, scan line animation

## Run it

```bash
npm install
npm run dev
```

## Stack

React 19, TypeScript (strict), Tailwind CSS 4, Vite 8, HTML5 Canvas
