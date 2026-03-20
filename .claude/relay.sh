#!/usr/bin/env bash
#
# relay.sh — Claude Code hook script that relays tool events to a Dazzle stage.
# Receives hook event JSON on stdin, extracts the interesting bits, and emits
# a Dazzle event so the visualization can react in real time.
#
# Handles: PreToolUse, PostToolUse, SubagentStart, SubagentStop,
#          UserPromptSubmit, Stop, SessionStart, Notification
#
# Requires: jq, dazzle CLI, DAZZLE_STAGE env var

set -euo pipefail

# Read the full hook payload from stdin
INPUT=$(cat)

# DAZZLE_STAGE is optional — events also go to local bridge at localhost:7777

# Bail if jq is not available
if ! command -v jq &>/dev/null; then
  exit 0
fi

# ─── STATS FILE ─────────────────────────────────────────────────
STATS_FILE="/tmp/claude-stream-stats.json"

# Initialize stats file if it doesn't exist
init_stats() {
  if [[ ! -f "$STATS_FILE" ]]; then
    jq -nc '{
      total_reads: 0,
      total_edits: 0,
      total_writes: 0,
      total_commands: 0,
      total_searches: 0,
      total_errors: 0,
      lines_added: 0,
      event_count: 0,
      session_start_time: (now | tostring)
    }' > "$STATS_FILE"
  fi
}

# Increment a stat counter and optionally emit stats event
bump_stat() {
  local field="$1"
  local amount="${2:-1}"
  init_stats
  local updated
  updated=$(jq --arg f "$field" --argjson a "$amount" \
    '.[$f] = ((.[$f] // 0) + $a) | .event_count = (.event_count + 1)' "$STATS_FILE")
  echo "$updated" > "$STATS_FILE"

  # Emit stats every 5th event
  local count
  count=$(echo "$updated" | jq -r '.event_count')
  if (( count % 5 == 0 )); then
    emit_event stats "$updated"
  fi
}

# ─── HELPERS ─────────────────────────────────────────────────────

# Helper: truncate a string to N chars (default 200)
truncate() {
  local s="$1"
  local max="${2:-200}"
  if [[ ${#s} -gt $max ]]; then
    echo "${s:0:$max}..."
  else
    echo "$s"
  fi
}

# Helper: redact secrets from a string before broadcasting
# Matches common secret patterns and replaces values with [REDACTED]
redact() {
  local s="$1"
  # Skip empty strings
  if [[ -z "$s" ]]; then
    echo "$s"
    return
  fi
  echo "$s" | sed -E \
    -e 's/(sk-[a-zA-Z0-9_-]{8})[a-zA-Z0-9_-]*/\1[REDACTED]/g' \
    -e 's/(dzl_[a-zA-Z0-9]{8})[a-zA-Z0-9]*/\1[REDACTED]/g' \
    -e 's/(bstr_[a-zA-Z0-9]{8})[a-zA-Z0-9]*/\1[REDACTED]/g' \
    -e 's/(ghp_[a-zA-Z0-9]{8})[a-zA-Z0-9]*/\1[REDACTED]/g' \
    -e 's/(gho_[a-zA-Z0-9]{8})[a-zA-Z0-9]*/\1[REDACTED]/g' \
    -e 's/(xoxb-[a-zA-Z0-9]{8})[a-zA-Z0-9-]*/\1[REDACTED]/g' \
    -e 's/(xoxp-[a-zA-Z0-9]{8})[a-zA-Z0-9-]*/\1[REDACTED]/g' \
    -e 's/(AKIA[A-Z0-9]{12})[A-Z0-9]*/\1[REDACTED]/g' \
    -e 's/(Bearer )[a-zA-Z0-9_.-]+/\1[REDACTED]/g' \
    -e 's/([A-Z_]*(?:KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL|AUTH)[A-Z_]*=)[^\s"]+/\1[REDACTED]/g' \
    -e 's/([a-z_]*(?:key|secret|token|password|credential|auth)[a-z_]*[=:]["'"'"' ]*)[a-zA-Z0-9_.-]{16,}/\1[REDACTED]/g'
}

# Helper: check if a file path is sensitive and should not have content broadcast
is_sensitive_file() {
  local f="$1"
  case "$f" in
    *.env|*.env.*|*credentials*|*secret*|*.pem|*.key|*.p12|*.pfx|*id_rsa*|*id_ed25519*|*.npmrc|*.pypirc)
      return 0 ;;
    *)
      return 1 ;;
  esac
}

# Wrap truncate with redaction
safe_truncate() {
  local s="$1"
  local max="${2:-200}"
  truncate "$(redact "$s")" "$max"
}

# Helper: emit to both Dazzle stage AND local WebSocket bridge
emit_event() {
  local event_name="$1"
  local event_json="$2"
  # Dazzle stage (if DAZZLE_STAGE is set)
  if [[ -n "${DAZZLE_STAGE:-}" ]]; then
    dazzle stage event emit "$event_name" "$event_json" --stage "$DAZZLE_STAGE" &
  fi
  # Local bridge (always try, fails silently if not running)
  local bridge_payload
  bridge_payload=$(jq -nc --arg e "$event_name" --arg d "$event_json" '{event: $e, data: $d}')
  curl -s -X POST http://localhost:7777/event \
    -H 'Content-Type: application/json' \
    -d "$bridge_payload" \
    2>/dev/null &
}

# Extract the hook event name
HOOK_TYPE=$(echo "$INPUT" | jq -r '.hook_event_name // .hook_type // empty')

# Extract the tool name (for tool hooks)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')

case "$HOOK_TYPE" in

  # ═══════════════════════════════════════════════════════════════
  # USER PROMPT — the human speaks
  # ═══════════════════════════════════════════════════════════════
  UserPromptSubmit)
    PROMPT=$(echo "$INPUT" | jq -r '.prompt // empty')
    # Strip system-reminder and task-notification XML blocks injected by Claude Code
    PROMPT=$(echo "$PROMPT" | sed -E 's/<system-reminder>.*<\/system-reminder>//g; s/<task-notification>.*<\/task-notification>//g; s/<[^>]+>//g')
    # Strip leading/trailing whitespace after tag removal
    PROMPT=$(echo "$PROMPT" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')
    PROMPT_SAFE=$(safe_truncate "$PROMPT" 300)
    EVENT_JSON=$(jq -nc --arg prompt "$PROMPT_SAFE" \
      '{prompt: $prompt}')
    emit_event user_message "$EVENT_JSON"
    bump_stat "event_count" 0  # just trigger the periodic stats emit
    ;;

  # ═══════════════════════════════════════════════════════════════
  # STOP — Claude's response complete
  # ═══════════════════════════════════════════════════════════════
  Stop)
    MESSAGE=$(echo "$INPUT" | jq -r '.last_assistant_message // empty')
    MESSAGE_SAFE=$(safe_truncate "$MESSAGE" 300)
    STOP_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')
    EVENT_JSON=$(jq -nc --arg message "$MESSAGE_SAFE" --arg stop_active "$STOP_ACTIVE" \
      '{message: $message, stop_active: $stop_active}')
    emit_event assistant_message "$EVENT_JSON"
    bump_stat "event_count" 0
    ;;

  # ═══════════════════════════════════════════════════════════════
  # SESSION START — model info, session begins
  # ═══════════════════════════════════════════════════════════════
  SessionStart)
    MODEL=$(echo "$INPUT" | jq -r '.model // empty')
    SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
    # Reset stats on session start
    jq -nc --arg model "$MODEL" --arg sid "$SESSION_ID" '{
      total_reads: 0,
      total_edits: 0,
      total_writes: 0,
      total_commands: 0,
      total_searches: 0,
      total_errors: 0,
      lines_added: 0,
      event_count: 0,
      session_start_time: (now | tostring),
      model: $model,
      session_id: $sid
    }' > "$STATS_FILE"
    EVENT_JSON=$(jq -nc --arg model "$MODEL" --arg session_id "$SESSION_ID" \
      '{model: $model, session_id: $session_id}')
    emit_event session_start "$EVENT_JSON"
    ;;

  # ═══════════════════════════════════════════════════════════════
  # NOTIFICATION — permission prompts, idle prompts
  # ═══════════════════════════════════════════════════════════════
  Notification)
    NOTIF_TYPE=$(echo "$INPUT" | jq -r '.notification_type // empty')
    MESSAGE=$(echo "$INPUT" | jq -r '.message // empty')
    MESSAGE_SAFE=$(safe_truncate "$MESSAGE" 300)
    EVENT_JSON=$(jq -nc --arg type "$NOTIF_TYPE" --arg message "$MESSAGE_SAFE" \
      '{type: $type, message: $message}')
    emit_event notification "$EVENT_JSON"
    ;;

  # ═══════════════════════════════════════════════════════════════
  # PRE TOOL USE — tool invocation begins
  # ═══════════════════════════════════════════════════════════════
  PreToolUse)
    case "$TOOL_NAME" in
      Read)
        FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
        EVENT_JSON=$(jq -nc --arg tool "$TOOL_NAME" --arg file "$FILE" \
          '{tool: $tool, file: $file}')
        bump_stat "total_reads"
        ;;
      Edit)
        FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
        if is_sensitive_file "$FILE"; then
          OLD="[content hidden — sensitive file]"
          NEW=""
        else
          OLD=$(echo "$INPUT" | jq -r '.tool_input.old_string // empty')
          NEW=$(echo "$INPUT" | jq -r '.tool_input.new_string // empty')
        fi
        OLD_TRUNC=$(safe_truncate "$OLD")
        NEW_TRUNC=$(safe_truncate "$NEW")
        # Estimate lines added from new_string length
        NEW_LINES=$(echo "$INPUT" | jq -r '.tool_input.new_string // empty' | wc -l | tr -d ' ')
        EVENT_JSON=$(jq -nc --arg tool "$TOOL_NAME" --arg file "$FILE" --arg old "$OLD_TRUNC" --arg new "$NEW_TRUNC" \
          '{tool: $tool, file: $file, old: $old, new: $new}')
        bump_stat "total_edits"
        bump_stat "lines_added" "${NEW_LINES:-0}"
        ;;
      Write)
        FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
        if is_sensitive_file "$FILE"; then
          SNIPPET="[content hidden — sensitive file]"
        else
          CONTENT=$(echo "$INPUT" | jq -r '.tool_input.content // empty')
          SNIPPET=$(safe_truncate "$CONTENT")
        fi
        # Estimate lines from content
        WRITE_LINES=$(echo "$INPUT" | jq -r '.tool_input.content // empty' | wc -l | tr -d ' ')
        EVENT_JSON=$(jq -nc --arg tool "$TOOL_NAME" --arg file "$FILE" --arg snippet "$SNIPPET" \
          '{tool: $tool, file: $file, snippet: $snippet}')
        bump_stat "total_writes"
        bump_stat "lines_added" "${WRITE_LINES:-0}"
        ;;
      Bash)
        CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
        DESC=$(echo "$INPUT" | jq -r '.tool_input.description // empty')
        CMD_TRUNC=$(safe_truncate "$CMD")
        EVENT_JSON=$(jq -nc --arg tool "$TOOL_NAME" --arg command "$CMD_TRUNC" --arg description "$DESC" \
          '{tool: $tool, command: $command, description: $description}')
        bump_stat "total_commands"
        ;;
      Grep)
        PATTERN=$(echo "$INPUT" | jq -r '.tool_input.pattern // empty')
        FILE=$(echo "$INPUT" | jq -r '.tool_input.path // empty')
        EVENT_JSON=$(jq -nc --arg tool "$TOOL_NAME" --arg pattern "$PATTERN" --arg file "$FILE" \
          '{tool: $tool, pattern: $pattern, file: $file}')
        bump_stat "total_searches"
        ;;
      Glob)
        PATTERN=$(echo "$INPUT" | jq -r '.tool_input.pattern // empty')
        FILE=$(echo "$INPUT" | jq -r '.tool_input.path // empty')
        EVENT_JSON=$(jq -nc --arg tool "$TOOL_NAME" --arg pattern "$PATTERN" --arg file "$FILE" \
          '{tool: $tool, pattern: $pattern, file: $file}')
        bump_stat "total_searches"
        ;;
      Agent)
        DESC=$(echo "$INPUT" | jq -r '.tool_input.description // .tool_input.prompt // empty')
        AGENT_TYPE=$(echo "$INPUT" | jq -r '.tool_input.agent_type // "Explore"')
        DESC_TRUNC=$(truncate "$DESC")
        EVENT_JSON=$(jq -nc --arg tool "$TOOL_NAME" --arg description "$DESC_TRUNC" --arg agent_type "$AGENT_TYPE" \
          '{tool: $tool, description: $description, agent_type: $agent_type}')
        ;;
      WebFetch)
        URL=$(echo "$INPUT" | jq -r '.tool_input.url // empty')
        SNIPPET=$(truncate "$URL")
        EVENT_JSON=$(jq -nc --arg tool "$TOOL_NAME" --arg url "$URL" --arg snippet "$SNIPPET" \
          '{tool: $tool, url: $url, snippet: $snippet}')
        ;;
      WebSearch)
        QUERY=$(echo "$INPUT" | jq -r '.tool_input.query // empty')
        SNIPPET=$(truncate "$QUERY")
        EVENT_JSON=$(jq -nc --arg tool "$TOOL_NAME" --arg query "$QUERY" --arg snippet "$SNIPPET" \
          '{tool: $tool, query: $query, snippet: $snippet}')
        bump_stat "total_searches"
        ;;
      *)
        SNIPPET=$(echo "$INPUT" | jq -r '.tool_input // {} | tostring' | head -c 200)
        EVENT_JSON=$(jq -nc --arg tool "$TOOL_NAME" --arg snippet "$SNIPPET" \
          '{tool: $tool, snippet: $snippet}')
        ;;
    esac
    emit_event tool_start "$EVENT_JSON"
    ;;

  # ═══════════════════════════════════════════════════════════════
  # POST TOOL USE — tool invocation complete
  # ═══════════════════════════════════════════════════════════════
  PostToolUse)
    # Determine success from the tool result
    SUCCESS=$(echo "$INPUT" | jq -r 'if .error then "false" else "true" end')

    # Track errors
    if [[ "$SUCCESS" == "false" ]]; then
      bump_stat "total_errors"
      # Emit dedicated error event
      ERROR_MSG=$(echo "$INPUT" | jq -r '.error // .tool_response // empty | tostring')
      ERROR_TRUNC=$(safe_truncate "$ERROR_MSG" 300)
      ERROR_JSON=$(jq -nc --arg tool "$TOOL_NAME" --arg error "$ERROR_TRUNC" \
        '{tool: $tool, error: $error}')
      emit_event error "$ERROR_JSON"
    fi

    case "$TOOL_NAME" in
      Read)
        FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
        if is_sensitive_file "$FILE"; then
          SNIPPET="[content hidden — sensitive file]"
        else
          RESULT=$(echo "$INPUT" | jq -r '.tool_response // empty | tostring')
          SNIPPET=$(safe_truncate "$RESULT")
        fi
        EVENT_JSON=$(jq -nc --arg tool "$TOOL_NAME" --arg file "$FILE" --argjson success "$SUCCESS" --arg snippet "$SNIPPET" \
          '{tool: $tool, file: $file, success: $success, snippet: $snippet}')
        ;;
      Edit)
        FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
        if is_sensitive_file "$FILE"; then
          SNIPPET="[content hidden — sensitive file]"
        else
          RESULT=$(echo "$INPUT" | jq -r '.tool_response // empty | tostring')
          SNIPPET=$(safe_truncate "$RESULT")
        fi
        EVENT_JSON=$(jq -nc --arg tool "$TOOL_NAME" --arg file "$FILE" --argjson success "$SUCCESS" --arg snippet "$SNIPPET" \
          '{tool: $tool, file: $file, success: $success, snippet: $snippet}')
        ;;
      Write)
        FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
        EVENT_JSON=$(jq -nc --arg tool "$TOOL_NAME" --arg file "$FILE" --argjson success "$SUCCESS" \
          '{tool: $tool, file: $file, success: $success}')
        ;;
      Bash)
        CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
        CMD_TRUNC=$(safe_truncate "$CMD")
        RESULT=$(echo "$INPUT" | jq -r '.tool_response // empty | tostring')
        SNIPPET=$(safe_truncate "$RESULT")
        EVENT_JSON=$(jq -nc --arg tool "$TOOL_NAME" --arg command "$CMD_TRUNC" --argjson success "$SUCCESS" --arg snippet "$SNIPPET" \
          '{tool: $tool, command: $command, success: $success, snippet: $snippet}')
        ;;
      Grep)
        PATTERN=$(echo "$INPUT" | jq -r '.tool_input.pattern // empty')
        RESULT=$(echo "$INPUT" | jq -r '.tool_response // empty | tostring')
        SNIPPET=$(safe_truncate "$RESULT")
        EVENT_JSON=$(jq -nc --arg tool "$TOOL_NAME" --arg pattern "$PATTERN" --argjson success "$SUCCESS" --arg snippet "$SNIPPET" \
          '{tool: $tool, pattern: $pattern, success: $success, snippet: $snippet}')
        ;;
      Glob)
        PATTERN=$(echo "$INPUT" | jq -r '.tool_input.pattern // empty')
        RESULT=$(echo "$INPUT" | jq -r '.tool_response // empty | tostring')
        SNIPPET=$(truncate "$RESULT")
        EVENT_JSON=$(jq -nc --arg tool "$TOOL_NAME" --arg pattern "$PATTERN" --argjson success "$SUCCESS" --arg snippet "$SNIPPET" \
          '{tool: $tool, pattern: $pattern, success: $success, snippet: $snippet}')
        ;;
      Agent)
        DESC=$(echo "$INPUT" | jq -r '.tool_input.description // .tool_input.prompt // empty')
        DESC_TRUNC=$(truncate "$DESC")
        EVENT_JSON=$(jq -nc --arg tool "$TOOL_NAME" --arg description "$DESC_TRUNC" --argjson success "$SUCCESS" \
          '{tool: $tool, description: $description, success: $success}')
        ;;
      WebFetch)
        URL=$(echo "$INPUT" | jq -r '.tool_input.url // empty')
        RESULT=$(echo "$INPUT" | jq -r '.tool_response // empty | tostring')
        SNIPPET=$(truncate "$RESULT")
        EVENT_JSON=$(jq -nc --arg tool "$TOOL_NAME" --arg url "$URL" --argjson success "$SUCCESS" --arg snippet "$SNIPPET" \
          '{tool: $tool, url: $url, success: $success, snippet: $snippet}')
        ;;
      WebSearch)
        QUERY=$(echo "$INPUT" | jq -r '.tool_input.query // empty')
        RESULT=$(echo "$INPUT" | jq -r '.tool_response // empty | tostring')
        SNIPPET=$(truncate "$RESULT")
        EVENT_JSON=$(jq -nc --arg tool "$TOOL_NAME" --arg query "$QUERY" --argjson success "$SUCCESS" --arg snippet "$SNIPPET" \
          '{tool: $tool, query: $query, success: $success, snippet: $snippet}')
        ;;
      *)
        RESULT=$(echo "$INPUT" | jq -r '.tool_response // empty | tostring')
        SNIPPET=$(truncate "$RESULT")
        EVENT_JSON=$(jq -nc --arg tool "$TOOL_NAME" --argjson success "$SUCCESS" --arg snippet "$SNIPPET" \
          '{tool: $tool, success: $success, snippet: $snippet}')
        ;;
    esac
    emit_event tool_end "$EVENT_JSON"
    ;;

  # ═══════════════════════════════════════════════════════════════
  # SUBAGENT START/STOP
  # ═══════════════════════════════════════════════════════════════
  SubagentStart)
    AGENT_ID=$(echo "$INPUT" | jq -r '.agent_id // empty')
    AGENT_TYPE=$(echo "$INPUT" | jq -r '.agent_type // "Explore"')
    DESC=$(echo "$INPUT" | jq -r '.description // empty')
    DESC_TRUNC=$(truncate "$DESC")
    EVENT_JSON=$(jq -nc --arg agent_id "$AGENT_ID" --arg agent_type "$AGENT_TYPE" --arg description "$DESC_TRUNC" \
      '{agent_id: $agent_id, agent_type: $agent_type, description: $description}')
    emit_event agent_start "$EVENT_JSON"
    ;;

  SubagentStop)
    AGENT_ID=$(echo "$INPUT" | jq -r '.agent_id // empty')
    AGENT_TYPE=$(echo "$INPUT" | jq -r '.agent_type // "Explore"')
    EVENT_JSON=$(jq -nc --arg agent_id "$AGENT_ID" --arg agent_type "$AGENT_TYPE" \
      '{agent_id: $agent_id, agent_type: $agent_type}')
    emit_event agent_stop "$EVENT_JSON"
    ;;

esac

exit 0
