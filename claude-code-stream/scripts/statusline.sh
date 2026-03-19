#!/usr/bin/env bash
#
# statusline.sh — Claude Code status line script that relays usage data
# to a Dazzle stage visualization. Receives status line JSON on stdin,
# extracts cost/token/context data, and emits a usage event.
#
# Requires: jq, dazzle CLI, DAZZLE_STAGE env var

# Read the full status line payload from stdin
INPUT=$(cat)

# Bail if DAZZLE_STAGE is not set
if [[ -z "${DAZZLE_STAGE:-}" ]]; then
  exit 0
fi

# Bail if jq is not available
if ! command -v jq &>/dev/null; then
  exit 0
fi

# Extract usage fields and build compact JSON for the visualization
EVENT_JSON=$(echo "$INPUT" | jq -c '{
  cost_usd: (.cost.total_cost_usd // 0),
  total_input_tokens: (.context_window.total_input_tokens // 0),
  total_output_tokens: (.context_window.total_output_tokens // 0),
  context_window_size: (.context_window.context_window_size // 200000),
  used_percentage: (.context_window.used_percentage // 0),
  remaining_percentage: (.context_window.remaining_percentage // 100),
  cache_creation_input_tokens: (.context_window.current_usage.cache_creation_input_tokens // 0),
  cache_read_input_tokens: (.context_window.current_usage.cache_read_input_tokens // 0),
  lines_added: (.cost.total_lines_added // 0),
  lines_removed: (.cost.total_lines_removed // 0),
  duration_ms: (.cost.total_duration_ms // 0),
  api_duration_ms: (.cost.total_api_duration_ms // 0)
}')

dazzle stage event emit usage "$EVENT_JSON" --stage "$DAZZLE_STAGE" &

exit 0
