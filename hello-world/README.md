# Hello World

A visually rich "Hello World" stream — constellation particles, orbiting rings, and glowing typography. Proves your Dazzle pipeline is working.

## Run it

```bash
# Install the Dazzle CLI
curl -sSL https://dazzle.fm/install.sh | sh

# Create and start a stage
dazzle s new hello-world
dazzle s up

# Sync this directory
dazzle s sync . --watch

# Verify it looks right
dazzle s ss -o preview.png

# Go live
dazzle s bc on
```

## What you should see

Dark background with ~200 indigo/violet particles drifting and forming constellation connections. Three elliptical dot rings orbit the center. "Hello, World" floats in the center with a pulsing glow.

All animation uses Canvas 2D + CSS transforms — well within the software renderer's budget at 60 fps.
