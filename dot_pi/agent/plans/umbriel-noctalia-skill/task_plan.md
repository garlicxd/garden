# Plan: Replace `niri-noctalia` skill with `umbriel-noctalia`

## Context

- Current skill: `~/.pi/skills/niri-noctalia/SKILL.md` (chezmoi-tracked at
  `dot_pi/skills/niri-noctalia/SKILL.md`). It targets niri KDL + old Noctalia CLI
  (`noctalia overlay`, `niri validate`).
- Live session right now is **Umbriel** (`XDG_CURRENT_DESKTOP=umbriel`,
  `/usr/bin/umbriel` running), with **Noctalia v5.1.0** and **Umbriel 0.1.0**.
- User is on Noctalia v5+; supplied a draft for the new skill.
- `grep -rl niri-noctalia .pi/` finds only the skill file itself + old session logs — no
  other config/settings reference it, so the replacement is self-contained.
- Docs base: <https://docs.noctalia.dev/>. All URLs below were fetched/HTTP-checked
  (see "Verified facts").

## Verified facts (checked against installed binaries + live docs)

| Claim in draft | Status |
| --- | --- |
| `umbriel validate` / `-c PATH` | ✅ confirmed via `umbriel --help` |
| `umbriel msg`, `umbriel msg --help` | ✅ confirmed |
| `umbriel windows/workspaces/submap/layers --json` | ✅ confirmed (JSON actually returned) |
| `umbriel outputs/color/keyboard-layouts` | ✅ confirmed; docs say all inspection cmds accept `--json` |
| `umbriel subscribe workspaces,submap` + 6 families | ✅ confirmed |
| `noctalia --daemon` (foreground default) | ✅ confirmed via `noctalia --help` |
| `noctalia msg panel-toggle launcher/control-center/session/clipboard/wallpaper` | ✅ docs Surfaces + live `--help` |
| `noctalia msg window-switcher` / `window-switcher close` | ✅ docs Shell |
| `noctalia msg dock-toggle`, `bar-layer-set overlay`, `config-reload` | ✅ confirmed |
| `noctalia msg session lock/suspend/lock-and-suspend/logout/reboot/shutdown` | ✅ confirmed (live error string lists exactly these) |
| "no generic `noctalia msg overlay`" | ✅ confirmed |
| Doc URL `/umbriel/actions/` | ✅ 200 |
| Doc URL `/umbriel/ipc/` | ✅ 200 |
| Doc URL `/noctalia/ipc/shell/` | ✅ 200 |
| Doc URL `/noctalia/ipc/surfaces/` | ✅ 200 |

**New info the draft is missing (proposed additions):**

- `noctalia config validate [path]` exists — the skill should validate Noctalia config too,
  not only Umbriel.
- Additional Noctalia IPC pages: `/noctalia/ipc/` (overview), `/noctalia/ipc/media-and-ui/`,
  `/noctalia/ipc/plugins/`, `/noctalia/ipc/system-controls/` (all verified 200).
- Umbriel docs also have `/umbriel/configuration/`, `/umbriel/keybinds/`,
  `/umbriel/outputs/`, `/umbriel/window-rules/`, `/umbriel/scratchpads/`, etc.
- Umbriel `msg` also has `overview-toggle`, `config-reload`, `session-quit`,
  `submap:<name>`, `cheatsheet-toggle`, `dpms-off/on` — worth a "common actions" shortlist.
- Umbriel config is modular TOML under `~/.config/umbriel/` (`config.toml` + includes),
  live reload.

## Proposed new file — `~/.pi/skills/umbriel-noctalia/SKILL.md`

```markdown
---
name: umbriel-noctalia
description: "Umbriel Wayland compositor + Noctalia v5+ shell. Look up docs, validate TOML before/after edits, prefer CLI/IPC over sockets. Triggers: umbriel, noctalia, wayland, compositor, desktop shell, toml, keybinds, actions, workspace, window rules, scratchpad, overlay, ipc, validate."
metadata:
  triggers: umbriel, noctalia, wayland, compositor, desktop shell, toml, keybinds, actions, workspace, window rules, scratchpad, overlay, ipc, validate
  last_verified: 2026-09-23
---

# Umbriel + Noctalia (v5+)

## Rules
1. **Docs > memory.** Check the docs or `--help` before guessing a TOML key, action, or IPC command.
2. **Validate after every config edit.**
   - Umbriel: `umbriel validate` (or `umbriel validate -c PATH`) — works without a running session.
   - Noctalia: `noctalia config validate` (optionally pass a path).
3. **Use the CLIs, not the sockets.** `umbriel msg` / `noctalia msg`; don't talk to `$UMBRIEL_SOCKET` directly.

## Keep current
- If a command errors or `last_verified` is stale: re-read the relevant docs, fix this skill, bump `last_verified`.
- Quick fallbacks: `umbriel msg --help`, `noctalia msg --help`.

## Docs
Umbriel
- Overview: <https://docs.noctalia.dev/umbriel/>
- Configuration: <https://docs.noctalia.dev/umbriel/configuration/>
- Keybinds: <https://docs.noctalia.dev/umbriel/keybinds/>
- Actions (all `msg` verbs): <https://docs.noctalia.dev/umbriel/actions/>
- IPC (socket + event stream): <https://docs.noctalia.dev/umbriel/ipc/>

Noctalia
- Overview: <https://docs.noctalia.dev/noctalia/>
- IPC overview: <https://docs.noctalia.dev/noctalia/ipc/>
- Shell IPC: <https://docs.noctalia.dev/noctalia/ipc/shell/>
- Surfaces IPC: <https://docs.noctalia.dev/noctalia/ipc/surfaces/>
- Media & UI IPC: <https://docs.noctalia.dev/noctalia/ipc/media-and-ui/>
- Plugins IPC: <https://docs.noctalia.dev/noctalia/ipc/plugins/>
- System Controls IPC: <https://docs.noctalia.dev/noctalia/ipc/system-controls/>

## Umbriel
Config: TOML under `~/.config/umbriel/` (`config.toml` plus includes); most changes live-reload on save, errors show on screen.

```bash
umbriel validate              # validate default config
umbriel validate -c PATH      # validate a specific file
umbriel msg ACTION            # run an action
umbriel msg --help            # full grouped action list
```

Inspect (all accept `--json`):

```bash
umbriel windows --json
umbriel workspaces --json
umbriel submap --json
umbriel layers --json
umbriel outputs --json
umbriel color --json
umbriel tearing --json
umbriel keyboard-layouts --json
```

Events (JSON lines; full snapshots, not deltas):

```bash
umbriel subscribe workspaces,submap
umbriel subscribe theme,overview,keyboard_layout,windows,workspaces,submap
```

Families: `theme`, `overview`, `keyboard_layout`, `windows`, `workspaces`, `submap`.

Common `msg` actions:

```bash
umbriel msg spawn:kitty
umbriel msg window-focus-left
umbriel msg window-toggle-floating
umbriel msg window-toggle-fullscreen
umbriel msg workspace-next
umbriel msg workspace-switch:3
umbriel msg column-move-to-workspace:2
umbriel msg scratchpad-toggle
umbriel msg overview-toggle
umbriel msg config-reload
umbriel msg session-quit            # :skip-confirmation to skip the prompt
```

Full list: <https://docs.noctalia.dev/umbriel/actions/>

## Noctalia

Start:

```bash
noctalia           # foreground (debug/logs)
noctalia --daemon  # background (session)
```

IPC:

```bash
noctalia msg panel-toggle launcher
noctalia msg panel-toggle control-center
noctalia msg panel-toggle session
noctalia msg panel-toggle clipboard
noctalia msg panel-toggle wallpaper
noctalia msg window-switcher
noctalia msg window-switcher close
noctalia msg dock-toggle
noctalia msg bar-layer-set overlay
noctalia msg config-reload
noctalia msg session lock
noctalia msg session suspend
noctalia msg session lock-and-suspend
noctalia msg session logout
noctalia msg session reboot
noctalia msg session shutdown
noctalia msg --help
```

No generic `noctalia msg overlay`; use `panel-toggle <id>` or `bar-layer-set overlay`.

```

## Steps

> Status: ✅ all steps complete — commit `7431afd` pushed to `garlicxd/garden` (main).

- [x] **1. Create the new skill directory + SKILL.md**
      Write the content above to `~/.pi/skills/umbriel-noctalia/SKILL.md`. Confirm the
      frontmatter name matches the directory name (`umbriel-noctalia`) per the pi skills
      spec.
      *Dependencies:* none
      *Files:* `~/.pi/skills/umbriel-noctalia/SKILL.md` (create)
      *Rollback:* `rm -rf ~/.pi/skills/umbriel-noctalia`

- [x] **2. Remove the old `niri-noctalia` skill**
      Delete the target dir and drop it from chezmoi source:
      `rm -rf ~/.pi/skills/niri-noctalia && chezmoi forget ~/.pi/skills/niri-noctalia`
      (`chezmoi rm` no longer exists; `forget`/`unmanage` is the supported path).
      *Dependencies:* step 1 (no gap where neither skill exists)
      *Files:* `~/.pi/skills/niri-noctalia/` (delete),
      `~/.local/share/chezmoi/dot_pi/skills/niri-noctalia/` (drop from source)
      *Rollback:* `git -C ~/.local/share/chezmoi checkout -- dot_pi/skills/niri-noctalia` +
      `chezmoi apply ~/.pi/skills/niri-noctalia`

- [x] **3. Register the new skill in chezmoi**
      `chezmoi add ~/.pi/skills/umbriel-noctalia` (whole folder, per the chezmoi skill).
      *Dependencies:* step 1
      *Files:* `~/.local/share/chezmoi/dot_pi/skills/umbriel-noctalia/SKILL.md` (create)
      *Rollback:* `rm -rf ~/.local/share/chezmoi/dot_pi/skills/umbriel-noctalia`

- [x] **4. Verify**
      - `chezmoi managed | grep skills` → shows `umbriel-noctalia`, not `niri-noctalia`.
      - `chezmoi status` clean for both skill paths.
      - Sanity-run the commands the skill documents: `umbriel validate`,
        `noctalia config validate`.
      - Re-read the file to confirm valid frontmatter (pi discovers dirs containing
        `SKILL.md`; no restart needed beyond `/reload`).
      *Dependencies:* steps 2, 3
      *Files:* read-only verification

- [x] **5. Commit + push the dotfiles change**
      `chezmoi git add -A && chezmoi git -- commit -m "skills: replace niri-noctalia with umbriel-noctalia" && chezmoi git -- push`
      Note: `chezmoi git status` currently also shows unrelated modified files
      (`.chezmoiignore`, `dot_config/keyd/default.conf`, `dot_config/niri/autostart.kdl`) —
      stage only the skill paths unless the user wants those committed too.
      *Dependencies:* step 4
      *Rollback:* `chezmoi git -- reset` / revert commit

## Decisions (resolved by user)

1. **Extra links + extras** — ✅ included.
2. **Old skill fate** — ✅ deleted (`niri-noctalia` removed from disk and chezmoi source).
3. **Chezmoi commit scope** — ✅ committed only the two skill paths; the other
   modified tracked files (`.chezmoiignore`, `dot_config/keyd/default.conf`,
   `dot_config/niri/autostart.kdl`) were left unstaged.
4. **Skill location** — ✅ unchanged, stays at `~/.pi/skills/`.

## Result

- New skill: `~/.pi/skills/umbriel-noctalia/SKILL.md`
- Removed: `~/.pi/skills/niri-noctalia/`
- Commit: `7431afd` — `skills: replace niri-noctalia with umbriel-noctalia` (pushed)
- Rollback: `git -C ~/.local/share/chezmoi revert 7431afd && chezmoi apply`
