#!/usr/bin/env bash
# Usage: ./scripts/notify.sh <event> <message>
#
# Events:
#   approved   TASK-XXX was approved and committed
#   rejected   TASK-XXX was rejected (round N)
#   blocked    A blocker was written — needs human attention
#   done       All tasks in the project are complete
#   escalated  Max review rounds exceeded — needs human decision
#
# Env vars (set in .env or export before running):
#   DISCORD_WEBHOOK_URL   — Discord incoming webhook URL
#   SLACK_WEBHOOK_URL     — Slack incoming webhook URL
#
# If neither is set, the script exits silently (non-blocking).

set -euo pipefail

EVENT="${1:-}"
MESSAGE="${2:-}"

if [[ -z "$EVENT" || -z "$MESSAGE" ]]; then
  echo "Usage: notify.sh <event> <message>" >&2
  exit 1
fi

# Map event → emoji prefix
case "$EVENT" in
  approved)  PREFIX="✅" ;;
  rejected)  PREFIX="❌" ;;
  blocked)   PREFIX="🚧" ;;
  done)      PREFIX="🎉" ;;
  escalated) PREFIX="⚠️" ;;
  *)         PREFIX="ℹ️" ;;
esac

FULL_MESSAGE="${PREFIX} [harness] ${MESSAGE}"

# Load .env if it exists (non-fatal)
if [[ -f ".env" ]]; then
  # shellcheck disable=SC1091
  set -o allexport
  source .env
  set +o allexport
fi

SENT=0

# Discord
if [[ -n "${DISCORD_WEBHOOK_URL:-}" ]]; then
  curl -s -o /dev/null -X POST "$DISCORD_WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "{\"content\": \"${FULL_MESSAGE}\"}"
  SENT=$((SENT + 1))
fi

# Slack
if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
  curl -s -o /dev/null -X POST "$SLACK_WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "{\"text\": \"${FULL_MESSAGE}\"}"
  SENT=$((SENT + 1))
fi

if [[ $SENT -eq 0 ]]; then
  # No webhook configured — silent exit so the main workflow isn't blocked
  exit 0
fi

echo "Notification sent to ${SENT} channel(s): ${FULL_MESSAGE}"
