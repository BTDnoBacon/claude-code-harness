# Claude Code Harness — Global Guidelines

This project is a learning exercise in building a multi-agent harness. The guidelines here govern how the main session orchestrates sub-agents.

---

## Agent Roster

| Agent | File | Trigger |
|-------|------|---------|
| Planner | `.claude/agents/planner.md` | New requirement arrives |
| Developer | `.claude/agents/developer.md` | A task is ready to implement |
| Reviewer | `.claude/agents/reviewer.md` | Developer marks task `dev-done` |

---

## Workflow

```
User requirement
      │
      ▼
  [Planner]  →  writes tasks.md
      │
      ▼
  [Developer]  →  reads notes.md (if exists), implements one task, writes review_request.md
      │
      ▼
  [Reviewer]  →  reads review_history.md (if exists), writes review_result.md + appends review_history.md
      │
   APPROVED?
   ├── YES  →  main session updates task status [dev-done] → [done] in tasks.md
   │            then commits, then notifies (notify.sh approved), then moves to next task
   │            if all tasks [done] → notify.sh done
   └── NO   →  notify.sh rejected, Developer revises (round += 1)
                  if round > 3 → notify.sh escalated, escalate to user
```

### Review loop limit

- Maximum **3 review rounds** per task.
- If round 3 ends with `REJECTED`, the main session pauses and reports to the user with the full `review_result.md` content. Do not attempt a 4th round automatically.

---

## State Files

All inter-agent communication happens through files under `projects/{project_name}/.state/`:

| File | Written by | Read by |
|------|-----------|---------|
| `tasks.md` | Planner | Developer, main session |
| `review_request.md` | Developer | Reviewer |
| `review_result.md` | Reviewer (overwrite) | main session |
| `review_history.md` | Reviewer (append) | Reviewer (next round) |
| `blockers.md` | Developer | main session (escalate to user) |
| `notes.md` | Developer | Developer (next invocation) |

The main session is responsible for creating `projects/{project_name}/.state/` if it doesn't exist.

---

## Git Rules (main session only)

- **Sub-agents never run git commands.** Only the main session commits, branches, or pushes.
- Commit after each approved task using the convention in `.claude/rules/workflow.md`.
- Never force-push. Never amend a commit that has already been shared.

---

## Notification Rules

See `.claude/rules/notifications.md` for full details.

Call `scripts/notify.sh` at these moments (non-blocking — exits silently if no webhook is set):

```bash
./scripts/notify.sh approved  "TASK-XXX: <title> committed"
./scripts/notify.sh rejected  "TASK-XXX Round N: <first rejection reason>"
./scripts/notify.sh blocked   "TASK-XXX is blocked: <summary>"
./scripts/notify.sh escalated "TASK-XXX: max rounds exceeded — needs human input"
./scripts/notify.sh done      "Project <name>: all tasks complete"
```

---

## Common Operations

- Start a new project: create `projects/{project_name}/` and `.state/`, then invoke Planner.
- Resume work: read `tasks.md` to find the first task not marked `[done]`.
  - `[ ]` = 아직 시작 안 함
  - `[dev-done]` = 개발 완료, 리뷰 대기 중 (또는 리뷰 진행 중)
  - `[done]` = APPROVED + 커밋 완료
- Check for blockers: read `blockers.md` before invoking Developer.
