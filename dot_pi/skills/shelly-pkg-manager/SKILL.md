---
name: shelly-pkg-manager
description: >
  Arch Linux package management via Shelly CLI — system upgrades, repo/AUR/Flatpak/AppImage packages,
  and custom PKGBUILD workflows (fetch, audit, modify, build, install). JSON-first, no subshell parsing.
---

# Shelly Package Manager

Shelly is the native libalpm package manager. Always use `-j` for JSON output when querying.
System hardware specs: [`~/AGENTS.md`](~/AGENTS.md) — reference for any hardware-specific build decisions.
Shortcodes: `-<Type><Action>` — e.g. `-SI` = install, `-AS` = AUR search, `-FS` = Flatpak search.

## Discovery — `pkgsearch` (ALWAYS use first)

**`pkgsearch` is the primary tool for finding packages.** It searches repo + AUR in one call with unified JSON including the source field (`s`). Use it whenever you need to look up what packages exist and where they live.

```bash
~/.local/bin/pkgsearch <query>        # JSON (LLM mode) — returns {"results": [...]}
~/.local/bin/pkgsearch -p <query>     # human-readable table
~/.local/bin/pkgsearch -h             # full options
```

Flags: `-r` (repo only), `-a` (AUR only), `-i` (installed only), `-n N` (max results per source, default 30).

### pkgsearch JSON schema

```json
{
  "results": [
    {
      "s": "extra",             // source: repository name or "AUR"
      "n": "firefox",           // package name
      "v": "152.0.5-1",         // version
      "d": "Fast browser",      // description
      "i": false,               // installed
      "dl": 85778857,           // download size bytes (0 for AUR)
      "sz": 300353028,          // installed size bytes (0 for AUR)
      "au": null                // null for repo; {"vt":322,"pp":0.839,"od":false,"m":"dudemanguy"} for AUR
    }
  ]
}
```

Results are sorted by source priority (repo first, then AUR by popularity desc). For AUR entries, `au.pp` = popularity score, `au.vt` = votes, `au.m` = maintainer, `au.od` = out-of-date flag.

To install after discovery: `sudo shelly install pkg` (repo) or `sudo shelly aur install pkg` (AUR).

## Quick Reference — Fallback Commands

Use `pkgsearch` for discovery. These raw shelly commands are for install/upgrade/maintenance or when `pkgsearch` is insufficient:

| Area | Action | Command (long) | Shortcode |
| ------ | -------- | --------------- | ----------- |
| **System** | Sync DB | `sudo shelly sync` | — |
| | Check updates | `shelly check-updates -j` | — |
| | List updates | `shelly list-updates -j` | — |
| | Read news | `shelly news -j` | — |
| | Full upgrade (repo) | `sudo shelly upgrade` | — |
| | Upgrade all sources | `sudo shelly upgrade-all` | — |
| | Upgrade all, skip one | `sudo shelly upgrade-all --no-flatpak` | — |
| **Standard** | Search (repo only, fallback) | `shelly query -a pkg -j` | `-SAs pkg` |
| | Info | `shelly query -d pkg -j` | `-Sd pkg` |
| | Group | `shelly query -g group -j` | `-Sg group` |
| | Install | `sudo shelly install pkg` | `-SI pkg` |
| | Install local .pkg.tar.zst | `sudo shelly install ./file.pkg.tar.zst` | — |
| | Remove | `sudo shelly remove pkg` | — |
| | Remove + opt deps | `sudo shelly remove -o pkg` | — |
| | Downgrade | `shelly downgrade -l pkg` (list)→`sudo shelly downgrade -t ver pkg` | — |
| | Ignore | `sudo shelly ignore -a pkg` / `-r pkg` / `-l` | — |
| | Mark as explicit/dep | `sudo shelly mark pkg` | — |
| **AUR** | Search (AUR only, fallback) | `shelly aur search query -j` | `-AS query` |
| | Fetch PKGBUILD | `shelly aur search-pkgbuild pkg -j` | — |
| | Install | `sudo shelly aur install pkg` | — |
| | Install at commit | `sudo shelly aur install-version pkg <sha>` | — |
| | Update | `sudo shelly aur update pkg` | — |
| | List installed | `shelly aur list -j` | — |
| | Remove | `sudo shelly aur remove pkg` | — |
| **Flatpak** | Search | `shelly flatpak search query -j` | `-FS query` |
| | Install | `sudo shelly flatpak install pkg` | — |
| | Update | `sudo shelly flatpak update pkg` | — |
| | Remove | `sudo shelly flatpak uninstall pkg` | — |
| | List | `shelly flatpak list -j` | — |
| | Add remote | `sudo shelly flatpak add-remotes remote` | — |
| **AppImage** | Install | `sudo shelly appimage install path` | — |
| | List | `shelly appimage list -j` | — |
| | Configure updates | `sudo shelly appimage configure-updates pkg url GitHub` | — |
| | Remove | `sudo shelly appimage remove pkg` | — |
| **Maint** | Pacfiles | `sudo shelly pacfile -j` (list all .pacnew/.pacsave) | — |
| | Clean cache | `sudo shelly cache-clean -d` (dry-run first) | — |
| | Purge orphans | `sudo shelly purify -o -d` (dry-run first) | — |
| | Fix permissions | `sudo shelly fix-permissions` | — |
| | Export state | `shelly export -j` | — |
| | Keyring refresh | `sudo shelly keyring refresh` | — |

## System Upgrade — Safe Workflow

```
1. shelly news -j          # read latest Arch news (breaking changes)
2. shelly check-updates    # what's available
3. sudo shelly sync        # sync databases
4. sudo shelly upgrade     # repo packages
5. sudo shelly aur upgrade # AUR packages
6. sudo shelly flatpak upgrade  # Flatpaks
```

Or all at once: `sudo shelly upgrade-all` (add `--no-aur` etc. to skip sources).

After upgrade, check for `.pacnew` files: `sudo shelly pacfile -j` → merge config changes.

## JSON Query Output Sample

```json
// shelly query -a -j firefox (single result shown)
[{"Name":"firefox","Version":"152.0.5-1","Repository":"extra","Depends":["alsa-lib",...],
  "InstallReason":"Not Installed","DownloadSize":85778857,"InstalledSize":300353028}]
```

Key fields: `Name`, `Version`, `Repository`, `Depends`, `InstallReason`, `DownloadSize`, `InstalledSize`.
AUR search-pkgbuild returns `{"Name":"...","PkgBuild":"<full PKGBUILD text>"}`.

---

## PKGBUILD Security Audit (MUST run before makepkg)

For any custom PKGBUILD — whether from AUR, GitHub, or user-provided — audit in this order:

1. **Read `.SRCINFO` first** — it's declarative (no Bash execution). Verify `sha256sums`/`sha512sums`.
2. **Inspect `source=()`** — flag URLs not matching expected upstream (typosquatting, hijacked mirrors).
3. **Scan `.install` files** — `post_install`/`pre_remove` run as root. Flag: `curl`, `wget`, `rsync`, `nc`.
4. **Scan `build()`/`package()`** — flag: `pip`, `npm`, `cargo`, `gem`, `docker`, `sudo`, `eval`, base64→bash pipes.
5. **Cross-check checksums** — if upstream publishes hashes, verify them independently.
6. **Check `install=`** in PKGBUILD — this is a root-executed hook file. Read it before building.
7. **Enable Shelly protections** before AUR builds:

   ```
   shelly config set AurInstallUseChroot True   # build in clean chroot
   shelly config set AurInstallRunChecks True    # run check() function
   ```

**NEVER** use `--skipchecksums`, `--skippgpcheck`, or `--skipinteg` with makepkg.

---

## Custom PKGBUILD Pipeline

```
FETCH → AUDIT → MODIFY → BUILD → INSTALL → CONFIGURE → CLEANUP
```

### 1. Fetch

```bash
# From AUR (preferred — no git clone needed)
shelly aur search-pkgbuild llama.cpp-git -j  # contains full PKGBUILD text

# From GitHub (for custom PKGBUILDs)
git clone https://github.com/user/repo.git /tmp/build-pkg
```

### 2. Audit

Run the 7-point checklist above. Use `read` tool on every downloaded file.

### 3. Modify

Use `edit` tool for surgical changes — never overwrite entire file:

- **CMake flags**: inject into `_cmake_options` array or `cmake` invocation
- **Dependencies**: add to `makedepends=()` and `depends=()` arrays
- **Env/config files**: edit `.conf`, `.service`, or env files in the `source=()` array

### 4. Build

```bash
cd /tmp/build-pkg
makepkg -s          # -s resolves dependencies automatically
```

If build fails: check `src/` for build logs, verify all `makedepends` are installed.

### 5. Install

```bash
sudo shelly install ./pkgname-*.pkg.tar.zst  # natively registered in ALPM
```

### 6. Configure Runtime

Write env files, systemd overrides, or configs:

```bash
sudo mkdir -p /var/cache/some-dir && sudo chmod 755 /var/cache/some-dir
```

If a systemd service was installed, enable it: `sudo systemctl enable --now svc-name`.

### 7. Cleanup

```bash
rm -rf /tmp/build-pkg     # on success
# KEEP on failure — needed for debugging
```

---

---

## Extended Context Files

For hardware-specific build recipes and backend configurations, the LLM should `read` the adjacent context files when needed:

- **`llama.md`** — llama.cpp PKGBUILD injection points, custom PKGBUILD template, build issues, local repo setup for persistent custom builds, compiler optimizations
- **`openvino.md`** — OpenVINO package matrix, device-specific env vars (GPU/NPU/CPU), known runtime issues, cache dir setup

These files are updated independently from the skill as build issues and hardware features evolve.

---

## Rollback & Troubleshooting

| Problem | Action |
| --------- | -------- |
| Bad upgrade | `shelly downgrade -l pkg` → `sudo shelly downgrade -t <version> pkg` |
| Pin version | `sudo shelly ignore -a pkg` (remove with `-r`) |
| .pacnew conflicts | `sudo shelly pacfile -j` → manually merge, then remove .pacnew |
| Build fails | Check `src/` build dir logs; verify `makedepends`; try `shelly config set AurInstallUseChroot True` for clean chroot |
| Dependency loop | `sudo shelly remove -c broken-pkg` then reinstall |
| Corrupted DB | `sudo shelly purify -d` (dry-run) → `sudo shelly purify` |
| Key errors | `sudo shelly keyring refresh` |
| Shell-y broken | `sudo shelly fix-permissions` |
