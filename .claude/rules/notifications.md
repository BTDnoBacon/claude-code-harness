# Notification Rules

The main session calls `scripts/notify.sh` at these trigger points.
Sub-agents never call it — only the main session.

---

## Trigger Points

| Event | When | Command |
|-------|------|---------|
| `approved` | After commit following APPROVED verdict | `./scripts/notify.sh approved "TASK-XXX: <title> committed"` |
| `rejected` | After receiving REJECTED verdict | `./scripts/notify.sh rejected "TASK-XXX Round N rejected: <first required change>"` |
| `blocked` | After detecting a non-empty blockers.md | `./scripts/notify.sh blocked "TASK-XXX is blocked: <blocker summary>"` |
| `escalated` | When round > 3 with REJECTED | `./scripts/notify.sh escalated "TASK-XXX: max review rounds exceeded — human decision needed"` |
| `done` | When all tasks in tasks.md are [done] | `./scripts/notify.sh done "Project <name>: all tasks complete 🎉"` |

---

## Configuration

Copy `.env.example` to `.env` and set at least one webhook URL:

```bash
cp .env.example .env
# then edit .env with your Discord or Slack webhook URL
```

The script exits silently if no webhook is configured, so notifications are
always optional and never block the workflow.

---

## Discord Webhook Setup

1. Go to your Discord server → channel settings → **Integrations** → **Webhooks**
2. Click **New Webhook**, name it (e.g. "harness-bot"), copy the URL
3. Paste into `.env` as `DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...`

## Slack Webhook Setup

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**
2. Enable **Incoming Webhooks**, add to workspace, pick a channel
3. Copy the webhook URL → paste into `.env` as `SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...`
