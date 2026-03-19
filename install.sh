#!/usr/bin/env bash
#
# Install the Claude Code Stream skill.
# Usage: curl -sSL https://raw.githubusercontent.com/dazzle-labs/stream-examples/main/install.sh | sh
#

set -euo pipefail

REPO="https://raw.githubusercontent.com/dazzle-labs/stream-examples/main"
SKILL_DIR="$HOME/.claude/skills/claude-code-stream"

echo "Installing Claude Code Stream..."

# Create skill directory structure
mkdir -p "$SKILL_DIR/scripts"
mkdir -p "$SKILL_DIR/skill"

# Download files
curl -sSL "$REPO/claude-code-stream/skill/SKILL.md" -o "$SKILL_DIR/skill/SKILL.md"
curl -sSL "$REPO/claude-code-stream/scripts/relay.sh" -o "$SKILL_DIR/scripts/relay.sh"
curl -sSL "$REPO/claude-code-stream/index.html" -o "$SKILL_DIR/index.html"

# Make relay executable
chmod +x "$SKILL_DIR/scripts/relay.sh"

echo ""
echo "Installed to $SKILL_DIR"
echo ""
echo "Next steps:"
echo "  1. Start Claude Code:  claude"
echo "  2. Run the skill:      /claude-code-stream"
echo ""
echo "The skill will walk you through creating a Dazzle stage and going live."
