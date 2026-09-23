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
