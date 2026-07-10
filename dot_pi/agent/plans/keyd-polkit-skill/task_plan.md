# Plan: Create sudo→pkexec Extension

## Overview
Create a pi extension at `~/.pi/agent/extensions/sudo-to-pkexec.ts` that intercepts the built-in `bash` tool and replaces any `sudo` commands with equivalent `pkexec` calls. This way the agent never needs sudo — polkit handles privilege escalation via the graphical auth dialog.

## Approach
Use `createBashTool` with a `spawnHook` (as shown in `bash-spawn-hook.ts` example) to wrap the bash tool. The hook transforms any `sudo <command>` into `pkexec <command>` before execution.

## Steps

- [ ] **1. Review extension examples** — Read relevant examples (`bash-spawn-hook.ts`, `tool-override.ts`, `permission-gate.ts`) — ✅ *done*
      *Dependencies:* none

- [x] **2. Create extension** — Write `~/.pi/agent/extensions/sudo-to-pkexec.ts` that:
      - Overrides the built-in `bash` tool using `createBashTool` with a `spawnHook`
      - The hook replaces `sudo ` at the start of commands with `pkexec `
      - Preserves all other bash functionality unchanged
      *Dependencies:* step 1
      *Files:* `~/.pi/agent/extensions/sudo-to-pkexec.ts` (create)
      *Rollback:* delete the file

- [ ] **3. Reload pi** — User types `/reload` to activate the extension
      *Dependencies:* step 2
      *Files:* none
      *Rollback:* n/a

- [ ] **4. Test** — Ask the agent to run a `sudo` command (e.g., check keyd status) and verify it gets redirected to `pkexec`
      *Dependencies:* step 3
