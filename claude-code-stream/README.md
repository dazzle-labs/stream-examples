# Claude Code Stream

Live visualization of an AI coding agent at work. Every tool call -- file reads, edits, bash commands, grep searches, subagent spawns -- appears on a Dazzle stage in real time, the moment it happens. Your audience watches the AI think.

This is the one you want to show people.

## How It Works

```
Claude Code  -->  Hook (relay.sh)  -->  Dazzle Event  -->  Stage Visualization
(tool call)       (extracts data)       (dazzle stage      (renders on stream)
                                         event emit)
```

Claude Code fires hooks on every tool use. The relay script (`relay.sh`) reads the hook payload from stdin, extracts the tool name, file path, command, search pattern, or agent info, then pushes a structured event to your Dazzle stage via `dazzle stage event emit`. The visualization is a React/TypeScript/Tailwind app that listens for those events and renders them in a two-column layout: a scrolling event feed on the left and sidebar panels on the right. Tool starts appear immediately; tool completions update with success/failure status and result previews.

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

A dark two-column layout. On the left, a scrolling event feed. On the right, sidebar panels showing live session data. A status bar runs across the bottom.

When Claude Code starts working, events slide in as color-coded cards stacking in the feed. Each card has a left accent border and a label:

- **READING** (cyan) -- file path
- **EDITING** (cyan) -- file path with the old text in red and new text in green
- **CREATING** (cyan) -- file path and content snippet
- **EXECUTING** (cyan) -- command text with description
- **SEARCHING** (cyan) -- search pattern and matching file paths
- **SCANNING** (cyan) -- file pattern and results
- **AGENT** (cyan) -- subagent task description
- **FETCHING** (cyan) -- URL
- **USER** (white) -- user message text
- **CLAUDE** (purple) -- assistant message text
- **ERROR** (red) -- error details

The newest event is full-size. Older events fade as they scroll up. The sidebar shows five panels:

- **FILE ACTIVITY** -- files touched during the session, sorted by recency, with operation counts
- **AGENTS** -- active subagents with type and elapsed time
- **SESSION** -- counters for reads, edits, writes, commands, searches, errors, and lines added
- **USAGE** -- context window usage bar, token counts (input/output), session cost
- **ACTIVITY** -- sparkline histogram of event rate over the last 120 seconds

The status bar shows total events, file count, command count, last tool label, session cost, active agent count, and model name. A heartbeat dot pulses to show the system is alive.

When no events have arrived, the feed shows "AWAITING SIGNAL" -- the system is alive, waiting.

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
| `src/App.tsx` | Root layout -- Feed, Sidebar, StatusBar in a 1280x720 flex container |
| `src/components/Feed.tsx` | Scrolling event feed with auto-scroll to newest card |
| `src/components/FeedCard.tsx` | Individual event card with accent color, label, hero text, detail lines |
| `src/components/Sidebar.tsx` | Five panels: FILE ACTIVITY, AGENTS, SESSION, USAGE, ACTIVITY sparkline |
| `src/components/StatusBar.tsx` | Bottom bar with event count, file count, command count, cost, model |
| `src/hooks/useEventStream.ts` | Processes Dazzle events into React state (feed, files, agents, stats, usage) |
| `src/types.ts` | TypeScript types for events, files, agents, stats, usage |
| `scripts/relay.sh` | Hook script -- reads tool event JSON from stdin, extracts relevant fields per tool type, emits structured Dazzle events via `dazzle stage event emit` |
| `skill/SKILL.md` | Installable Claude Code skill that walks through the full setup interactively |
