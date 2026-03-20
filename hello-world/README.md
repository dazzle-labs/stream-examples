# Hello World

A broadcast-quality visual showcase built with React, TypeScript, and Tailwind. Five cinematic scenes, smooth fades through black, 60fps on a software renderer. This is the proof that the Dazzle pipeline works -- and that "hello world" doesn't have to look like one.

![Preview](preview.png)

## Run It

```bash
# Install dependencies
npm install

# Dev server
npm run dev

# Production build
npm run build
```

## Deploy It

```bash
# Install the Dazzle CLI
curl -sSL https://dazzle.fm/install.sh | sh

# Create a stage
dazzle stage create hello-world

# Build and sync
npm run build
dazzle stage sync ./dist --stage hello-world --watch

# Verify it looks right
dazzle stage screenshot --stage hello-world --out preview.png
```

## What You'll See

Five scenes cycling every 12 seconds with smooth fades through black:

1. **Hello, World** -- 600 particles in an edge-to-edge constellation with connection lines, grid underlay, edge flourish dots, and corner branding. Canvas 2D renders the particle system as a background layer; hero text and branding are DOM elements styled with Tailwind.

2. **Terminal** -- A full-screen terminal window typing out the complete `dazzle` workflow command by command. CRT scan lines via CSS background-image, a CSS-animated scan bar, blinking cursor, traffic light dots, status bar. Pure DOM rendering.

3. **How It Works** -- Animated pipeline diagram: Your Code, dazzle sync, Cloud Renderer, Broadcast. Canvas 2D draws the grid, animated dashed connections, and flowing particles. Pipeline boxes and labels are DOM elements with CSS pulse animations.

4. **What You Can Build** -- Kinetic typography with capability words scrolling across at different sizes, speeds, and colors. Canvas 2D for the background particle field and grid. Each word is a positioned DOM element with CSS text-shadow for glow.

5. **Go Live** -- Massive 160px hero text with green glow, a subtitle, the broadcast command in monospace, and an animated compound waveform filling the entire bottom third. Canvas 2D for the waveform, rising particles, and grid. Text content is DOM.

## Technical Notes

- React components with Canvas 2D background layers for particles, grids, and waveforms
- Text, layout, and UI rendered as DOM elements styled with Tailwind CSS v4
- TypeScript strict mode, zero `any` types
- Vite build with relative base path for `dazzle stage sync`
- 1280x720 fixed viewport
- No `shadowBlur`, no WebGL -- everything runs on a software renderer
- Scene manager uses `requestAnimationFrame` with smoothstep easing for fade transitions
