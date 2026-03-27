# This Day in History

Cinematic broadcast of today's historical events, pulled from Wikipedia's "On This Day" API. Events are grouped by era -- Ancient through Now -- each with its own visual identity that evolves from aged parchment tones to modern electric accents.

## Run It

```bash
npm install
npm run dev
```

## Deploy It

```bash
npm run build
dazzle stage create this-day-in-history
dazzle stage up --stage this-day-in-history
dazzle stage sync ./dist --stage this-day-in-history --watch
```

## What You'll See

Eras cycle on screen, each introduced by a title card with its own color palette, typography, and background imagery. Events within each era feature Ken Burns camera motion on Wikipedia imagery, text decode animations, and scrolling for longer descriptions. A timeline along the bottom tracks position across all eras. Sepia and saturation shift from faded archival warmth in the ancient eras to crisp, saturated modern tones.

Auto-refreshes at midnight for the new day's events.
