---
name: plan
description: >
  Plan mode for multi-step tasks. Enforces a plan-first workflow:
  create `task_plan.md` with steps, dependencies, and files touched,
  get user approval, then implement. Use for setup, configuration,
  or any multi-step system changes.
---

# Plan Mode

## Workflow

### 1. Plan Phase
- Analyze requirements and gather context
- Create `task_plan.md` at the project root or `~/.pi/agent/plans/<name>/`
  with: each step, dependencies, files to touch, risks/backup steps
- Present the plan to the user for approval

### 2. Build Phase
- Implement steps in order
- Mark each step done in `task_plan.md` after completing it
- If something goes wrong, note it and adjust

### 3. Verification Phase
- Confirm each step worked
- Present a summary of what was done

## Plan File: `task_plan.md` Format

```markdown
# Plan: <title>

## Steps

- [ ] **1. Step name** — description
      *Dependencies:* none | step X
      *Files:* /path/to/file (create|edit|verify)
      *Rollback:* how to undo

- [ ] **2. Step name** — description
      *Dependencies:* step 1
      ...
```

## Rules

- Do NOT start implementing until the plan is approved
- If requirements change, update the plan first
- Keep a rollback path for each step
- Reference relative paths from the plan file's directory
