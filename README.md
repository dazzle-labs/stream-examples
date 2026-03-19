# Dazzle Stream Examples

Live streaming powered by AI agents and code. Write HTML, sync it to the cloud, broadcast it to the world.

[Dazzle](https://dazzle.fm) gives you a cloud browser at 1280x720. You write standard HTML/CSS/JS, Dazzle renders it, and broadcasts the output as a live stream. CSS animations, Canvas 2D, SVG, Web Audio -- all of it works. These examples show you what's possible, from cinematic motion graphics to real-time AI coding visualizations.

## The Killer Feature: Stream Your Claude Code Session

Watch an AI coding agent work in real time. Every file read, every edit, every grep, every bash command -- rendered live on stream as it happens.

```bash
curl -sSL https://raw.githubusercontent.com/dazzle-labs/stream-examples/main/install.sh | sh
```

The [`claude-code-stream`](./claude-code-stream) example hooks into Claude Code's tool system and pushes every action to a Dazzle stage. Your audience sees exactly what the AI sees, as it sees it. Installable as a Claude Code skill -- one command and you're live.

## Quick Start

```bash
# Install the Dazzle CLI
curl -sSL https://raw.githubusercontent.com/dazzle-labs/stream-examples/main/install.sh | sh

# Authenticate
dazzle login

# Create a stage
dazzle stage create my-stage

# Pick an example, sync it, go live
dazzle stage sync ./hello-world --watch
dazzle stage screenshot --out preview.png
dazzle stage broadcast start
```

That's it. Your content is rendering in a cloud browser at 1280x720 and broadcasting to your configured destination (Kick, Twitch, YouTube, or custom RTMP).

## Examples

| Example | What It Does |
|---------|-------------|
| [`hello-world`](./hello-world) | Broadcast-quality visual showcase -- 5 cinematic scenes cycling through particles, terminal animation, pipeline diagrams, kinetic typography, and waveform. Proves the full pipeline and looks incredible doing it. |
| [`remotion-stream`](./remotion-stream) | Cinematic motion graphics built with Remotion -- signal lock, counting numbers, full-bleed waveforms, typewriter titles, and orbital particles. Spring physics, text decode effects, hard-cut transitions. This is what broadcast-quality React looks like. |
| [`claude-code-stream`](./claude-code-stream) | Live visualization of a Claude Code session. Every tool call, file edit, search, and subagent spawn appears on stream in real time. Installable as a Claude Code skill -- hook it up and every coding session becomes a live broadcast. |

## How Dazzle Works

```
Your Code  -->  dazzle stage sync  -->  Cloud Browser  -->  Broadcast
(HTML/JS)       (CLI)                   (1280x720)          (Kick/Twitch/YT)
```

You write standard HTML/CSS/JS. Dazzle syncs it to a cloud browser, captures the viewport at 30fps, and broadcasts the output. CSS animations, Canvas 2D, SVG, and Web Audio all work. Use whatever libraries you want via CDN.

## Writing Your Own

Every example is a directory with an `index.html`. No build step, no framework required.

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; box-sizing: border-box; }
    body { width: 100vw; height: 100vh; overflow: hidden; background: #000; }
  </style>
</head>
<body>
  <!-- your content here -->
</body>
</html>
```

Key constraints:
- **1280x720 fixed resolution**, 30fps capture
- **Software renderer** -- no hardware GPU. CSS animations, Canvas 2D, and SVG are the sweet spot. Avoid fragment shaders or multi-pass WebGL.
- **Full viewport, no scroll** -- design for 16:9 with a 40px safe area from edges
- **Text**: 16px+ body, 24px+ headings, high contrast, sans-serif
- **Assets**: keep images under 2MB, use WebP/AVIF, no video files

For the full content authoring guide: `dazzle guide` or [dazzle.fm/guide.md](https://dazzle.fm/guide.md)

## Sending Live Data

Push real-time data to your running page without re-syncing:

```bash
dazzle stage event emit score '{"points": 42}'
```

```js
window.addEventListener('event', (e) => {
  const { event, data } = e.detail
  if (event === 'score') el.textContent = data.points
})
```

## Links

- [Dazzle](https://dazzle.fm) -- platform
- [CLI source](https://github.com/dazzle-labs/cli) -- open source
- [Content guide](https://dazzle.fm/guide.md) -- performance tips, what works at 60fps
- [LLM reference](https://dazzle.fm/llms.txt) -- full platform spec for AI agents
