---
name: plan
description: Systematic planning workflow for complex tasks. Produces concise, actionable plans with goal analysis, step decomposition, dependency mapping, and risk assessment. Use before implementing multi-step changes, refactoring, or when asked to plan first.
---

# Plan Skill

Before you write code, read files, or make any changes — create a plan.

## When to Use This Skill

Any time a task involves:
- Multiple files or components
- Refactoring or restructuring
- Complex logic or algorithms
- Features spanning frontend/backend/database
- Uncertainty about the best approach
- The user explicitly asks you to plan first

## Plan Output Format

Produce a concise plan with exactly these sections:

```markdown
## Goal
One sentence. What are we trying to achieve?

## Approach
2-3 sentences on the strategy. The "how" at a high level.

## Steps
1. **Step one** — What to do, which file(s), key changes. Be specific.
2. **Step two** — ...
3. **Step three** — ...
   - Sub-step if needed (indented bullet)
N. **Final step** — Verification or wrap-up.

## Files Changed
- `path/to/file.ts` — brief description of change
- `path/to/new.ts` — new file, purpose

## Risks / Edge Cases
- Things that could go wrong
- Edge cases to handle
- Assumptions being made
```

## Execution Rules

1. **Plan first.** Do not start implementing until the plan is approved. Present the plan to the user and wait.
2. **Be concise.** No long prose. Use bullet points and short sentences.
3. **Be specific.** Include file paths, function names, and concrete changes — not vague descriptions.
4. **Validate.** Before finalizing, quickly verify any assumptions (check existing code, imports, APIs).
5. **Size matters.** If a step feels too big, split it. Each step should be completable in one coding session.
6. **After approval**, execute steps in order. Update the user on progress.

## Step Tracking

During execution, mark progress with `[DONE]` after each completed step:

```
Steps:
1. [DONE] Create the utility module
2. [DONE] Add the API endpoint
3. Write the frontend component  ← currently working on
4. Add tests
```

## Tips for Efficient Planning

- **Read first.** Always check existing code before proposing changes.
- **One plan per task.** Don't create separate plans for sub-tasks unless the user asks.
- **Estimate complexity.** For each step, note if it's trivial, moderate, or complex.
- **Dependencies.** If step 3 depends on step 2, say so. Flag blocking issues early.
- **Rollback plan.** For risky changes, note how to undo if something goes wrong.

## Examples

### Good plan (concise, specific):

```
## Goal
Add a password strength indicator to the registration form.

## Approach
Add a real-time validator component that checks password against common criteria and displays a strength bar below the password field.

## Steps
1. Create `src/components/PasswordStrength.tsx` — React component that computes strength from length, uppercase, lowercase, digits, special chars
2. Add strength bar UI with 4 levels (weak/fair/strong/very-strong) using existing color tokens
3. Wire it into `RegistrationForm.tsx` — pass password value, render below input
4. Add unit tests in `src/components/__tests__/PasswordStrength.test.tsx`

## Files Changed
- `src/components/PasswordStrength.tsx` — new, strength indicator component
- `src/components/RegistrationForm.tsx` — add import and render PasswordStrength
- `src/components/__tests__/PasswordStrength.test.tsx` — new, unit tests

## Risks / Edge Cases
- Empty password should show no bar, not "weak"
- Very long passwords (>100 chars) should not break layout
- Assumes color tokens are already defined
```

### Poor plan (vague, unusable):

```
## Plan
1. Add password strength checker
2. Test it
```
