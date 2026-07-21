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

# Bun — track only package.json (package list), ignore lockfile + node_modules
.bun/install/global/node_modules
.bun/install/global/bun.lock

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
chezmoi git add . && chezmoi git -- commit -m "..." && chezmoi git -- push
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

# Re-add all modified tracked files (sync machine state to repo)
chezmoi re-add

# See what chezmoi manages
chezmoi managed --include=files | sort

# See what's NOT managed (unmanaged files in home dir)
chezmoi unmanaged

# Compare source file vs actual file
chezmoi diff ~/.config/some-app/settings.toml

# Remove a file from chezmoi management (without deleting the real file)
chezmoi unmanage ~/.config/some-app/settings.toml
```

## Understanding `chezmoi status` Output

The status output has two columns (like `git status`), but the meaning is different.

| Char | 1st col: last-written vs actual state | 2nd col: actual state vs target (source) |
|------|--------------------------------------|------------------------------------------|
| ` `  | No change                            | No change / entry stays as-is            |
| `A`  | Entry was **created** in actual       | Entry will be **created** by apply       |
| `D`  | Entry was **deleted** from actual     | Entry will be **deleted** by apply       |
| `M`  | Entry was **modified** in actual      | Entry will be **modified** by apply      |

### Common status patterns

| Pattern | Meaning | Action needed |
|---------|---------|---------------|
| `  ` (clean) | Source, last-applied, and actual all match | Nothing |
| `MM` | Both source AND actual diverged from last-applied | `chezmoi re-add` to sync source → actual |
| `DA` | File exists in **source** but was **deleted from disk** | `chezmoi apply` to restore, OR `chezmoi unmanage` to remove from source |
| `AM` | File exists on disk but not in source | `chezmoi add` to track it (whole dirs) |
| ` D` | File deleted from disk, source has it | `chezmoi apply` to restore, or `chezmoi rm` to confirm deletion |
| `AD` | File added to source but deleted from disk | `chezmoi apply` to restore |

**Key insight:** `chezmoi re-add` updates the **source** to match the **actual** (disk). It handles `MM` entries. It does NOT handle `DA` entries — those need manual handling (apply or unmanage).

## Sync Workflow (add → commit → push)

```bash
# After adding/changing files with chezmoi add
chezmoi git add .
chezmoi git -- commit -m "Add/update <description>"
chezmoi git -- push
```

**Don't** `cd` into the source dir and use raw `git` — use `chezmoi git` instead to keep the state database in sync. 

**Important:** `chezmoi git` needs `--` before any git flags (e.g., `-m`). Without `--`, chezmoi tries to parse them as its own flags.

## Sync Machine State (re-add → status-check → handle DAs → commit → push)

When the local machine has drifted from the repo (e.g., you changed configs and want to capture the current state), use this workflow:

```bash
# 1. Re-add all modified tracked files to match current state
chezmoi re-add

# 2. Check what's left — `DA` entries won't be handled by re-add
chezmoi status

# 3a. For DA entries: if the file was intentionally removed from disk,
#     remove it from chezmoi source too:
chezmoi unmanage ~/.config/some-app/some-file

# 3b. Or if the file should exist on disk, restore it:
chezmoi apply ~/.config/some-app/some-file

# 4. Add any new untracked files (whole dirs, not individual files)
chezmoi add ~/.config/some-app     # only if not already tracked

# 5. Final verification — should be clean (no output)
chezmoi status

# 6. Commit & push
chezmoi git add .
chezmoi git -- commit -m "Sync machine state: <description>"
chezmoi git -- push
```

`chezmoi re-add` with no args updates all modified managed files at once — it's the fastest way to sync the repo to the current machine. Always verify with `chezmoi status` afterward because some entries (like `DA`) need manual handling.

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
- **Edit tool edits the destination, not the source** — when using pi's `edit` tool (or any editor) on a managed file, you're modifying `~/dot_config/...`, not `~/.local/share/chezmoi/dot_config/...`. After editing, run `chezmoi re-add ~/.config/path/to/file` to sync the source before committing.
- **`chezmoi re-add` is a snapshot** — it only picks up files modified *at the moment you run it*. If you edit more files afterward, run `chezmoi re-add` again (or for individual files) before committing.
- **`chezmoi unmanaged` shows files in `$HOME` not tracked** — useful for finding things you forgot to add or should add to `.chezmoiignore`.
- **`--` dash-dash is required before git flags** — e.g. `chezmoi git -- commit -m "msg"` not `chezmoi git commit -m`. Without `--`, chezmoi tries to parse flags itself.
- **`chezmoi diff` shows source vs actual in git format** — `--- /dev/null` means the actual file doesn't exist on disk; `+++ /dev/null` means the source doesn't have it.
