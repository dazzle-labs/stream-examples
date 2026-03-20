# Claude Code Stream

Live visualization of an AI coding agent at work. Every tool call -- file reads, edits, bash commands, searches, subagent spawns -- appears on a Dazzle stage in real time.

![Preview](preview.png)

## Prerequisites

- [Dazzle CLI](https://dazzle.fm) -- `curl -sSL https://dazzle.fm/install.sh | sh`
- [jq](https://jqlang.github.io/jq/) -- `brew install jq` (macOS) or `apt install jq` (Linux)
- [Claude Code](https://claude.ai/claude-code)

## Quick Start (Skill)

The easiest path. Install the Claude Code skill, then invoke it from any project:

```bash
/claude-code-stream
```

The skill walks you through everything: creating a stage, syncing the visualization, configuring hooks, and verifying with a screenshot.

## Manual Setup

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

# 5. Start coding -- broadcasting is already live
claude
```

## Local Development

No Dazzle account needed. The visualization runs locally with a WebSocket bridge that replaces the Dazzle event pipeline.

```bash
cd claude-code-stream
npm install
npm run local
```

Open `http://localhost:5173`. You'll see the idle state.

Configure hooks in the project you want to stream. Create `.claude/settings.local.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "/absolute/path/to/claude-code-stream/scripts/relay.sh"
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
            "command": "/absolute/path/to/claude-code-stream/scripts/relay.sh"
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
            "command": "/absolute/path/to/claude-code-stream/scripts/relay.sh"
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
            "command": "/absolute/path/to/claude-code-stream/scripts/relay.sh"
          }
        ]
      }
    ]
  }
}
```

Replace `/absolute/path/to/claude-code-stream` with the actual path on your machine. Without `DAZZLE_STAGE`, events go only to the local bridge.

Start Claude Code (`claude`) and every tool call appears in your browser.

### Test without Claude Code

```bash
curl -s -X POST http://localhost:7777/event \
  -H 'Content-Type: application/json' \
  -d '{"event":"tool_start","data":"{\"tool\":\"Read\",\"file\":\"/src/App.tsx\"}"}'
```

## What You'll See

A dark two-column layout. On the left, a scrolling event feed where tool calls slide in as color-coded cards. On the right, sidebar panels showing file activity, active agents, session stats, token usage, and an event rate sparkline. A status bar runs across the bottom.

When idle, the feed shows "AWAITING SIGNAL."

## Stopping

```bash
# Tear down the stage
dazzle stage down --stage my-session

# Remove hooks
rm .claude/settings.local.json
```

Restart Claude Code after removing hooks for the change to take effect.
