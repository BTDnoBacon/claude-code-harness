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
  [Developer]  →  implements one task, writes review_request.md
      │
      ▼
  [Reviewer]  →  writes review_result.md
      │
   APPROVED?
   ├── YES  →  main session commits, move to next task
   └── NO   →  Developer revises (round += 1)
                  if round > 3 → escalate to user
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
| `review_result.md` | Reviewer | main session |
| `blockers.md` | Developer | main session (escalate to user) |
| `notes.md` | Developer | next Developer invocation |

The main session is responsible for creating `projects/{project_name}/.state/` if it doesn't exist.

---

## Git Rules (main session only)

- **Sub-agents never run git commands.** Only the main session commits, branches, or pushes.
- Commit after each approved task using the convention in `.claude/rules/workflow.md`.
- Never force-push. Never amend a commit that has already been shared.

---

## Common Operations

- Start a new project: create `projects/{project_name}/` and `.state/`, then invoke Planner.
- Resume work: read `tasks.md` to find the first task not marked `[done]`.
- Check for blockers: read `blockers.md` before invoking Developer.
