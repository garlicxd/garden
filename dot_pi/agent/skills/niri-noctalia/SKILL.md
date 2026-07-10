---
name: niri-noctalia
description: "Niri WM and Noctalia launcher — manual lookup, validate after edits, prefer CLI commands. Triggered by: niri, noctalia, desktop widget, window manager, launcher, overlay, keybinds."
metadata:
  trigger-words: niri, noctalia, desktop widget, window manager, launcher, overlay, kdl, keybinds, compositor
---

# Niri WM + Noctalia Skill

## Principles

1. **Look things up manually** — don't guess flags, keybinds, or config syntax. Open the docs.
2. **Validate after every Niri edit** — run `niri validate` immediately after changing any KDL config.
3. **Prefer CLI commands** over GUI actions for both Niri and Noctalia whenever possible.

## Documentation

| Tool | Docs |
|------|------|
| Niri WM | <https://niri-wm.github.io/niri/> |
| Noctalia | <https://docs.noctalia.dev/v5/> |

## Niri

```bash
# Validate config after any edit
niri validate

# Reload config (no restart needed)
niri msg action do-screen-transition
```

## Noctalia

```bash
# Launch (start the daemon)
noctalia

# Toggle overlay
noctalia overlay

# List available actions
noctalia --help
```

For anything beyond these basics, **read the docs first** — don't guess.
