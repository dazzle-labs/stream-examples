#!/usr/bin/env bash
#
# Install the Claude Code Stream skill.
# Usage: curl -sSL https://raw.githubusercontent.com/dazzle-labs/stream-examples/main/install.sh | sh
#

set -euo pipefail

REPO_URL="https://github.com/dazzle-labs/stream-examples.git"
SKILL_DIR="$HOME/.claude/skills/claude-code-stream"

echo "Installing Claude Code Stream..."

# Clean any previous install
rm -rf "$SKILL_DIR"

# Clone just the claude-code-stream directory
git clone --depth 1 --filter=blob:none --sparse "$REPO_URL" "$SKILL_DIR"
cd "$SKILL_DIR"
git sparse-checkout set claude-code-stream

# Move files up from the subdirectory so SKILL.md paths resolve correctly
# SKILL.md lives at $SKILL_DIR/skill/SKILL.md and references $SKILL_DIR/.. for the project root
# After this, the project root IS $SKILL_DIR with skill/ as a subdirectory
mv claude-code-stream/* claude-code-stream/.* . 2>/dev/null || true
rmdir claude-code-stream 2>/dev/null || true

# Clean up git metadata from the sparse clone
rm -rf .git

# Make relay executable
chmod +x scripts/relay.sh

echo ""
echo "Installed to $SKILL_DIR"
echo ""
echo "Next steps:"
echo "  1. Start Claude Code:  claude"
echo "  2. Run the skill:      /claude-code-stream"
echo ""
echo "The skill will walk you through building, creating a Dazzle stage, and going live."
