---
name: chezmoi
description: Manage dotfiles with chezmoi — add folders (not individual files), use .chezmoiignore for exclusions, and sync with github.com/garlicxd/garden.
---

# Chezmoi Dotfiles — garlicxd/garden

Manages dotfiles via [chezmoi](https://chezmoi.io) pointed at the GitHub repo `garlicxd/garden`.

## Source Directory

```
~/.local/share/chezmoi/    ← the repo clone (chezmoi source)
```

## Adding New Configs — Folder Method

**Always add whole directories, not individual files.** Chezmoi will skip anything matching `.chezmoiignore`.

```bash
# Good — add the whole dir at once
chezmoi add ~/.config/some-app

# Bad — don't add individual files
chezmoi add ~/.config/some-app/settings.toml      # NO
```

This keeps the source tree clean and matches how niri, noctalia, local/bin, and pi were set up.

## `.chezmoiignore` — Exclusions

The ignore file lives at:
```
~/.local/share/chezmoi/.chezmoiignore
```

Patterns match against **destination paths** (relative to `$HOME`). When new files appear inside a tracked folder, they're included **unless** they match an ignore pattern. Sensitive/ephemeral stuff goes here instead of manually deleting files.

### Current ignores

```
# Pi — auth tokens, sessions, node_modules, compiled bins
.pi/agent/auth.json
.pi/agent/extensions/auth.json
.pi/agent/sessions
.pi/agent/npm/node_modules
.pi/agent/bin

# Noctalia — ephemeral state (cache, clipboard, history, community data)
.local/state/noctalia/clipboard
.local/state/noctalia/notification_history.json
.local/state/noctalia/recently_used.json
.local/state/noctalia/usage_counts.json
.local/state/noctalia/community-palettes
.local/state/noctalia/community-templates
.local/state/noctalia/.setup-complete
.local/state/noctalia/plugins
```

### Adding a new ignore pattern

```bash
# 1. Edit .chezmoiignore
echo ".config/some-app/cache" >> ~/.local/share/chezmoi/.chezmoiignore

# 2. Remove already-tracked files (if the file was added before the ignore)
rm ~/.local/share/chezmoi/dot_config/some-app/cache

# 3. Commit
cd ~/.local/share/chezmoi && git add -A && git commit -m "..." && git push
```

## Source Path Conventions

| Prefix      | Meaning                              | Example → Target                     |
|-------------|--------------------------------------|--------------------------------------|
| `dot_`      | Prepend `.` to name                  | `dot_pi`       → `.pi`              |
| `private_`  | Restrictive permissions (700/600)    | `private_dot_config` → `.config`    |
| `executable_`| Make file executable                | `executable_colony-model` → `colony-model` |

The `private_` prefix appears because `$HOME` has mode `700`. This is normal — don't remove it.

## Common Commands

```bash
# Status — what's changed since last sync
chezmoi status

# Diff — preview pending changes
chezmoi diff

# Apply — sync the repo's state to your home dir
chezmoi apply

# Add a new folder
chezmoi add ~/.config/some-app

# See what chezmoi manages
chezmoi managed --include=files | sort

# Compare source file vs actual file
chezmoi diff ~/.config/some-app/settings.toml

# Remove a file from chezmoi management (without deleting the real file)
chezmoi unmanage ~/.config/some-app/settings.toml
```

## Sync Workflow (add → commit → push)

```bash
# After adding/changing files with chezmoi add
chezmoi git add -A
chezmoi git commit -m "Add/update <description>"
chezmoi git push
```

**Don't** `cd` into the source dir and use raw `git` — use `chezmoi git` instead to keep the state database in sync.

## Setup on a New Machine

```bash
# Install chezmoi
# (Arch: pacman -S chezmoi, or brew install chezmoi)

# Clone and apply
chezmoi init --apply git@github.com:garlicxd/garden

# Or after the first init, re-apply latest
chezmoi update
```

## What's Currently Tracked

| Category        | Path in Repo                            | Manages                           |
|-----------------|-----------------------------------------|-----------------------------------|
| Niri WM         | `private_dot_config/niri/`              | Config + `cfg/*.kdl` modular dir  |
| Noctalia        | `private_dot_config/noctalia/`          | Settings, colors, plugins, themes |
| Local scripts   | `private_dot_local/private_bin/`        | `colony-model`, `start-portal.sh`, `pi/` |
| Noctalia state  | `private_dot_local/private_state/noctalia/` | `settings.toml` only          |
| Pi agent        | `dot_pi/`                               | Settings, models, extensions, themes, skills |

## Tips

- **Don't manually edit files inside `~/.local/share/chezmoi/`** — use `chezmoi add` to add, `chezmoi unmanage` to remove, and let chezmoi handle the naming.
- **After `chezmoi add`**, always verify with `chezmoi status` or `chezmoi diff` before committing.
- **Ignored files still show up in `chezmoi add` output** — they just say "warning: ignoring" and aren't copied to the source dir.
