#!/usr/bin/env bash
#
# PreToolUse hook: prevents syncing wrong content to wrong dazzle stages.
# Reads the PreToolUse JSON from stdin, checks if the Bash command contains
# a dazzle stage sync, and validates the stage-to-content mapping.

set -euo pipefail

INPUT=$(cat)

# Extract the tool name
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')

# Only care about Bash tool invocations
if [[ "$TOOL_NAME" != "Bash" ]]; then
  exit 0
fi

# Extract the command string
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only care about dazzle stage sync commands
if ! echo "$COMMAND" | grep -qE 'dazzle (stage |s )sync'; then
  exit 0
fi

# Extract the stage name (handles both --stage X and --stage=X)
STAGE=$(echo "$COMMAND" | grep -oE '\-\-stage[= ]+[a-zA-Z0-9_-]+' | head -1 | sed 's/--stage[= ]*//')

if [[ -z "$STAGE" ]]; then
  exit 0
fi

# Validate stage-to-content mapping
case "$STAGE" in
  hello-world)
    if ! echo "$COMMAND" | grep -qE 'hello-world/dist'; then
      echo "WRONG CONTENT FOR STAGE: --stage hello-world must sync from a path containing hello-world/dist" >&2
      echo "Example: dazzle stage sync .../hello-world/dist --stage hello-world" >&2
      exit 2
    fi
    ;;
  remotion-stream)
    if ! echo "$COMMAND" | grep -qE 'remotion-stream/dist'; then
      echo "WRONG CONTENT FOR STAGE: --stage remotion-stream must sync from a path containing remotion-stream/dist" >&2
      echo "Example: dazzle stage sync .../remotion-stream/dist --stage remotion-stream" >&2
      exit 2
    fi
    ;;
  claude-code-stream)
    if ! echo "$COMMAND" | grep -qE 'claude-code-stream/dist'; then
      echo "WRONG CONTENT FOR STAGE: --stage claude-code-stream must sync from a path containing claude-code-stream/dist" >&2
      echo "Example: dazzle stage sync .../claude-code-stream/dist --stage claude-code-stream" >&2
      exit 2
    fi
    ;;
esac

exit 0
