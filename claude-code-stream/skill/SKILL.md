---
name: claude-code-stream
description: Live stream your Claude Code session to a Dazzle stage. Visualizes tool calls, file edits, searches, and agent activity in real time.
allowed-tools: Bash, Read, Write, Edit
---

# Claude Code Stream

Set up live streaming of this Claude Code session to a Dazzle stage. The relay script and visualization are bundled with this skill at `${CLAUDE_SKILL_DIR}`.

## Step 1: Check prerequisites

Check for `dazzle` CLI:

```bash
dazzle whoami
```

If missing, install it: `curl -sSL https://dazzle.fm/install.sh | sh` then `dazzle login`.

Check for `jq`:

```bash
which jq
```

If missing: `brew install jq` (macOS) or `apt install jq` (Linux).

## Step 2: Create or choose a stage

```bash
dazzle stage list
```

If they want a new stage:

```bash
dazzle stage create claude-stream
dazzle stage up --stage claude-stream
```

If an existing stage is inactive, bring it up with `dazzle stage up --stage <name>`.

## Step 3: Sync the visualization

The visualization is a React/TypeScript/Tailwind app bundled at `${CLAUDE_SKILL_DIR}/..`. Build it and sync the `dist/` output:

```bash
cd ${CLAUDE_SKILL_DIR}/.. && npm install && npm run build
dazzle stage sync ${CLAUDE_SKILL_DIR}/../dist --stage <stage-name>
```

## Step 4: Configure hooks

The relay script is bundled at `${CLAUDE_SKILL_DIR}/../scripts/relay.sh`. Write hooks to `.claude/settings.local.json` (gitignored — ends in `.local`):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "DAZZLE_STAGE=<stage-name> ${CLAUDE_SKILL_DIR}/../scripts/relay.sh"
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
            "command": "DAZZLE_STAGE=<stage-name> ${CLAUDE_SKILL_DIR}/../scripts/relay.sh"
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
            "command": "DAZZLE_STAGE=<stage-name> ${CLAUDE_SKILL_DIR}/../scripts/relay.sh"
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
            "command": "DAZZLE_STAGE=<stage-name> ${CLAUDE_SKILL_DIR}/../scripts/relay.sh"
          }
        ]
      }
    ]
  }
}
```

Replace `<stage-name>` with the actual stage name. Replace `${CLAUDE_SKILL_DIR}` with the actual resolved path (run `echo ${CLAUDE_SKILL_DIR}` to see it).

IMPORTANT: The hooks command must use the ABSOLUTE path to relay.sh, not the variable. Resolve `${CLAUDE_SKILL_DIR}` first, then write the absolute path into the hooks config.

## Step 5: Verify and go live

```bash
dazzle stage screenshot --out /tmp/claude-code-stream-preview.png --stage <stage-name>
```

Show the screenshot to the user. Broadcasting starts automatically when the stage activates -- no separate broadcast command needed.

## Done

Tell the user:
- The stream is live at the watch URL. Every tool call appears in real time.
- To stop: `dazzle stage broadcast off --stage <stage-name>`
- To remove hooks: delete `.claude/settings.local.json`
- Restart Claude Code for hooks to take effect.
