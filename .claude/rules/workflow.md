# Workflow Rules

## Commit Message Convention

Format: `<type>(<scope>): <subject>`

| Type | When to use |
|------|-------------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `refactor` | Code change with no behavior change |
| `test` | Adding or updating tests |
| `docs` | Documentation only |
| `chore` | Tooling, config, dependencies |

- **scope**: the task ID or affected module, e.g. `feat(TASK-003): add login endpoint`
- **subject**: imperative mood, lowercase, no period, ≤72 chars
- Body is optional; use it to explain *why*, not *what*

Examples:
```
feat(TASK-001): add user registration form
fix(TASK-004): handle empty email input correctly
refactor(auth): extract token validation to helper
```

---

## Task Scope Limit

Each task (and its corresponding commit) should:

- Touch **≤ 5 files** in total
- Make **one logical change** — if you're doing two things, it's two tasks
- Leave unrelated code exactly as found

If a task naturally grows beyond this, stop and ask the Planner to re-split it before continuing.

---

## Branch Strategy (for future use)

> Not enforced in v0.1 — all work happens on `main`.
> Placeholder for when the harness supports per-task branches.
