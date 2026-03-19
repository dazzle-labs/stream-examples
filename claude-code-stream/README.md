# Claude Code Stream

Live visualization of an AI coding agent at work. Every tool call -- file reads, edits, bash commands, grep searches, subagent spawns -- appears on a Dazzle stage in real time, the moment it happens. Your audience watches the AI think.

This is the one you want to show people.

## How It Works

```
Claude Code  -->  Hook (relay.sh)  -->  Dazzle Event  -->  Stage Visualization
(tool call)       (extracts data)       (dazzle stage      (renders on stream)
                                         event emit)
```

Claude Code fires hooks on every tool use. The relay script (`relay.sh`) reads the hook payload from stdin, extracts the tool name, file path, command, search pattern, or agent info, then pushes a structured event to your Dazzle stage via `dazzle stage event emit`. The visualization (`index.html`) listens for those events and renders them as an animated scrolling feed -- newest at the bottom, oldest fading upward and compressing. Tool starts appear immediately; tool completions update with success/failure status and result previews.

The whole thing runs on Canvas 2D with grain textures, drifting particles, pulsing grid, corner marks, and a heartbeat indicator that speeds up when events arrive rapidly.

## Prerequisites

- [Dazzle CLI](https://dazzle.fm) -- `curl -sSL https://raw.githubusercontent.com/dazzle-labs/stream-examples/main/install.sh | sh`
- [jq](https://jqlang.github.io/jq/) -- `brew install jq` (macOS) or `apt install jq` (Linux)
- [Claude Code](https://claude.ai/claude-code) -- Anthropic's CLI for Claude

## Quick Start

### Option A: Install the Skill (recommended)

Install the Claude Code skill, then invoke it from any project:

```bash
/claude-code-stream
```

The skill walks you through every step: checking prerequisites, creating or choosing a stage, syncing the visualization, configuring hooks with the correct absolute paths, taking a screenshot to verify, and starting the broadcast. You don't need to touch any config files by hand.

### Option B: Manual Setup

```bash
# 1. Create a stage and bring it up
dazzle stage create my-session
dazzle stage up --stage my-session

# 2. Build and sync the visualization
cd claude-code-stream && npm install && npm run build && cd ..
dazzle stage sync ./claude-code-stream/dist --stage my-session

# 3. Copy the relay script into your project
mkdir -p .claude/scripts
cp ./claude-code-stream/scripts/relay.sh .claude/scripts/relay.sh
chmod +x .claude/scripts/relay.sh

# 4. Configure hooks in .claude/settings.local.json
cat > .claude/settings.local.json << 'EOF'
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "DAZZLE_STAGE=my-session .claude/scripts/relay.sh"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "DAZZLE_STAGE=my-session .claude/scripts/relay.sh"
          }
        ]
      }
    ],
    "SubagentStart": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "DAZZLE_STAGE=my-session .claude/scripts/relay.sh"
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "DAZZLE_STAGE=my-session .claude/scripts/relay.sh"
          }
        ]
      }
    ]
  }
}
EOF

# 5. Start broadcasting
dazzle stage broadcast start --stage my-session

# 6. Start coding -- every tool call now appears on stream
claude
```

## What You'll See

A dark canvas with a drifting grid, ambient particles, and corner marks. When Claude Code starts working, events slide in from the right with spring physics and stack upward in a scrolling feed. Each event gets a color-coded accent bar and a label that decodes from scrambled glyphs:

- **Read** (cyan) -- file path, then a content preview when the read completes
- **Edit** (cyan) -- file path with the old text in red and new text in green
- **Write** (amber) -- file path and content snippet
- **Bash** (amber) -- command text, then output lines colored green for success or red for failure
- **Grep** (cyan) -- search pattern and matching file paths
- **Glob** (cyan) -- file pattern and results
- **Agent** (magenta) -- subagent task description, with "SPAWNED" tag and "COMPLETE" on finish
- **WebFetch** (amber) -- domain name with full URL as secondary text
- **WebSearch** (blue) -- search query with result snippets

The newest event is the largest, with full detail lines and a scan-line sweep animation. Older events compress and fade as they scroll upward. The activity bar at the bottom shows total event count, the most recent tool label, and active agent count. A heartbeat dot pulses faster when events arrive rapidly and slows to a drift during idle periods.

When no events have arrived, the screen shows "AWAITING SIGNAL" with a pulsing dot and a scanning line -- the system is alive, waiting.

## Stopping

```bash
# Stop broadcasting
dazzle stage broadcast off --stage my-session

# Remove hooks (delete the local settings file)
rm .claude/settings.local.json
```

Restart Claude Code after removing hooks for the change to take effect.

## Files

| File | What It Does |
|------|-------------|
| `scripts/relay.sh` | Hook script -- reads tool event JSON from stdin, extracts relevant fields per tool type, emits structured Dazzle events via `dazzle stage event emit` |
| `skill/SKILL.md` | Installable Claude Code skill that walks through the full setup interactively |
| `index.html` | Canvas 2D visualization -- scrolling event feed with spring animations, grain texture, particles, grid, activity bar, and per-tool color coding |
