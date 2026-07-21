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

# Package lists — reference data tracked in repo, not applied to $HOME
pkglists/

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

| Prefix       | Meaning                              | Example → Target                     |
|--------------|--------------------------------------|--------------------------------------|
| `dot_`       | Prepend `.` to name                  | `dot_pi`              → `.pi`        |
| `private_`   | Restrictive permissions (700/600)    | `private_bin`  → `bin` (subdir)     |
| `executable_`| Make file executable                 | `executable_colony-model` → `colony-model` |
| `.tmpl` suffix | Marks file as a Go template        | `foo.sh.tmpl` → `foo.sh` (rendered) |

### Template files (`.tmpl` suffix)

Files ending in `.tmpl` are processed as Go templates by chezmoi before being written to their destination. The `.tmpl` is stripped from the target name.

**Useful template variables:**

| Expression | What it expands to |
|---|---|
| `{{ .chezmoi.sourceDir }}` | Absolute path to the chezmoi source dir (`~/.local/share/chezmoi/`) |
| `{{ include "path/from/source/root" | sha256sum }}` | SHA256 hash of a file in the source tree |
| `{{ .chezmoi.hostname }}` | Machine hostname |
| `{{ .chezmoi.os }}` | OS identifier (e.g. `linux`) |
| `{{ .chezmoi.arch }}` | Architecture (e.g. `amd64`) |

**Example** — a script that references the source directory and includes checksums:

```bash
#!/bin/bash
# sha256: {{ include "pkglists/pacman.txt" | sha256sum }}
pacman -S --needed - < {{ .chezmoi.sourceDir }}/pkglists/pacman.txt
```

**Adding a template file:**

```bash
# 1. Write the file with .tmpl extension in the source dir
# 2. Or let chezmoi add it (it will auto-detect template syntax)
chezmoi add ~/.local/bin/my-script.sh
# If the file contains {{ }} syntax, chezmoi prompts about adding .tmpl
```

> **Gotcha:** When `chezmoi diff` shows `MM` for a `.tmpl` file, that's normal — the source has raw template syntax and the destination has the rendered output. The `M` on both sides is expected.

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

### Package Lists Setup

After the initial `chezmoi init`, install packages from the tracked lists:

```bash
# Official packages
sudo pacman -S --needed - < ~/.local/share/chezmoi/pkglists/pacman.txt

# AUR packages (with shelly, paru, or yay)
shelly install --noconfirm - < ~/.local/share/chezmoi/pkglists/aur.txt
```

Or run the automated script (which does this + bun install):

```bash
~/.local/bin/update-chezmoi-pkglist.sh
```

> The script is a chezmoi template — on `chezmoi apply` it renders with the correct paths.

## Package List Automation

Explicitly installed packages (official + AUR) are automatically exported after every pacman/shelly transaction and tracked in the repo for reference and new-machine bootstrapping.

### Export (automatic via ALPM hook)

**Trigger:** Any `Install` or `Remove` transaction in pacman or shelly.

**Hook:** `/etc/pacman.d/hooks/95-chezmoi-pkglist.hook`

```ini
[Trigger]
Operation = Install
Operation = Remove
Type = Package
Target = *

[Action]
Description = Updating chezmoi package lists...
When = PostTransaction
Exec = /usr/bin/runuser -u <USER> -- /home/<USER>/.local/bin/export-chezmoi-pkglist.sh
```

**Key details:**
- ALPM hooks run as `root` — `runuser -u <USER>` drops privileges so output files stay user-owned
- The hook fires after every package transaction (`PostTransaction`)
- Files are written to `~/.local/share/chezmoi/pkglists/{pacman,aur}.txt` (inside the source dir)

**Export script (called by hook):** `~/.local/bin/export-chezmoi-pkglist.sh`

**Source:** `dot_local/private_bin/executable_export-chezmoi-pkglist.sh`

```bash
#!/bin/bash
TARGET_DIR="$HOME/.local/share/chezmoi/pkglists"
mkdir -p "$TARGET_DIR"
pacman -Qqen > "$TARGET_DIR/pacman.txt"
pacman -Qqem > "$TARGET_DIR/aur.txt"
```

### Install (chezmoi template for new machines)

Separate script at `~/.local/bin/update-chezmoi-pkglist.sh` installs packages FROM the lists on a new machine. It's a chezmoi template (`.tmpl` source) — `{{ .chezmoi.sourceDir }}` gets expanded to the actual path, and package-list hashes are computed at render time.

On a new machine, `chezmoi init --apply` renders this template to `~/.local/bin/update-chezmoi-pkglist.sh`, then you run it to bootstrap packages.

**Source:** `dot_local/private_bin/executable_update-chezmoi-pkglist.sh.tmpl`

```bash
#!/bin/bash
# pacman.txt hash: {{ include "pkglists/pacman.txt" | sha256sum }}
# aur.txt hash: {{ include "pkglists/aur.txt" | sha256sum }}

if command -v pacman &> /dev/null; then
    sudo pacman -S --needed --noconfirm - < {{ .chezmoi.sourceDir }}/pkglists/pacman.txt
fi

if command -v shelly &> /dev/null; then
    shelly install --noconfirm - < {{ .chezmoi.sourceDir }}/pkglists/aur.txt
elif command -v paru &> /dev/null; then
    paru -S --needed --noconfirm - < {{ .chezmoi.sourceDir }}/pkglists/aur.txt
elif command -v yay &> /dev/null; then
    yay -S --needed --noconfirm - < {{ .chezmoi.sourceDir }}/pkglists/aur.txt
fi

if command -v bun &> /dev/null; then
    bun add -g @earendil-works/pi-coding-agent
fi
```

### What's tracked in pkglists/

| File | Source | Generated by |
|------|--------|-------------|
| `pkglists/pacman.txt` | Official repo packages (`pacman -Qqen`) | ALPM hook after every Install/Remove |
| `pkglists/aur.txt` | Foreign/AUR packages (`pacman -Qqem`) | ALPM hook after every Install/Remove |

These are **reference data only** — `pkglists/` is in `.chezmoiignore` so they're never applied to `$HOME`.

## What's Currently Tracked

| Category        | Path in Repo                            | Manages                           |
|-----------------|-----------------------------------------|-----------------------------------|
| Niri WM         | `dot_config/niri/`              | Config + `cfg/*.kdl` modular dir  |
| Noctalia        | `dot_config/noctalia/`          | Settings, colors, plugins, themes |
| Local scripts   | `dot_local/private_bin/`        | `colony-model`, `start-portal.sh`, `pi/`, `export-chezmoi-pkglist.sh`, `update-chezmoi-pkglist.sh.tmpl` |
| Noctalia state  | `dot_local/private_state/noctalia/` | `settings.toml` only          |
| Pi agent        | `dot_pi/`                               | Settings, models, extensions, themes, skills |
| Package lists   | `pkglists/`                             | Exported package lists (ignored by apply)    |

## Tips

- **Don't manually edit files inside `~/.local/share/chezmoi/`** — use `chezmoi add` to add, `chezmoi unmanage` to remove, and let chezmoi handle the naming.
- **After `chezmoi add`**, always verify with `chezmoi status` or `chezmoi diff` before committing.
- **Ignored files still show up in `chezmoi add` output** — they just say "warning: ignoring" and aren't copied to the source dir.
- **Edit tool edits the destination, not the source** — when using pi's `edit` tool (or any editor) on a managed file, you're modifying `~/dot_config/...`, not `~/.local/share/chezmoi/dot_config/...`. After editing, run `chezmoi re-add ~/.config/path/to/file` to sync the source before committing.
- **`chezmoi re-add` is a snapshot** — it only picks up files modified *at the moment you run it*. If you edit more files afterward, run `chezmoi re-add` again (or for individual files) before committing.
- **`chezmoi unmanaged` shows files in `$HOME` not tracked** — useful for finding things you forgot to add or should add to `.chezmoiignore`.
- **`--` dash-dash is required before git flags** — e.g. `chezmoi git -- commit -m "msg"` not `chezmoi git commit -m`. Without `--`, chezmoi tries to parse flags itself.
- **`chezmoi diff` shows source vs actual in git format** — `--- /dev/null` means the actual file doesn't exist on disk; `+++ /dev/null` means the source doesn't have it.
