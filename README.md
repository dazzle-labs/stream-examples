# Dazzle Stream Examples

Runnable examples for [Dazzle](https://dazzle.fm) — cloud stages that render and broadcast your content. Each example is a standalone directory you can sync to a stage and go live in minutes.

## Quick Start

```bash
# 1. Install the CLI
curl -sSL https://dazzle.fm/install.sh | sh

# 2. Authenticate
dazzle login

# 3. Create a stage
dazzle s new my-stage

# 4. Bring it up
dazzle s up

# 5. Pick an example, sync it, go live
dazzle s sync ./hello-world --watch
dazzle s ss -o preview.png        # verify it looks right
dazzle s bc on                    # start broadcasting
```

That's it. Your content is now rendering in a cloud browser at 1280x720 and broadcasting to your configured destination (Kick, Twitch, YouTube, or custom RTMP).

## Examples

| Example | Description |
|---------|-------------|
| [`hello-world`](./hello-world) | 5-scene visual showcase — particles, terminal typing, architecture diagram, kinetic typography, and waveform. Proves the pipeline works and looks great doing it. |

## How Dazzle Works

```
Your Code  -->  dazzle sync  -->  Cloud Browser  -->  Broadcast
(HTML/JS)       (CLI)            (1280x720)          (Kick/Twitch/YT)
```

You write standard HTML/CSS/JS. Dazzle syncs it to a cloud browser, captures the viewport at 30 fps, and broadcasts the output. CSS animations, Canvas 2D, WebGL geometry, and Web Audio all work. Use whatever libraries you want via CDN.

## Writing Your Own

Every example is just a directory with an `index.html`. No build step, no framework required.

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
- **1280x720 fixed resolution**, 30 fps capture
- **Software renderer** — no hardware GPU. CSS animations and Canvas 2D are the sweet spot. Avoid fragment shaders with noise or multi-pass rendering.
- **Full viewport, no scroll** — design for 16:9 with a 40px safe area from edges
- **Text**: 16px+ body, 24px+ headings, high contrast, sans-serif
- **Assets**: keep images under 2MB, use WebP/AVIF, no video files

For the full content authoring guide: `dazzle guide` or [dazzle.fm/guide.md](https://dazzle.fm/guide.md)

## Sending Live Data

Push real-time data to your running page without re-syncing:

```bash
dazzle s ev e score '{"points": 42}'
```

```js
window.addEventListener('event', (e) => {
  const { event, data } = e.detail
  if (event === 'score') el.textContent = data.points
})
```

## Links

- [Dazzle](https://dazzle.fm) — platform
- [CLI source](https://github.com/dazzle-labs/cli) — open source
- [Content guide](https://dazzle.fm/guide.md) — performance tips, what works at 60 fps
- [LLM reference](https://dazzle.fm/llms.txt) — full platform spec for AI agents
