# Plan: Rename `stop-colony` → `colony` with on/off modes

## Interpretation

Current script has 3 modes: `unload` (default, `compose stop`), `stop` (`rm -s`), `down` (`down --remove-orphans`).
The request: give each mode an **on** version that brings containers back up, and make the no-flag
default a **toggle** (running → unload, stopped → on). Rename command to `colony`.

| flag            | action                                          | pairs with |
|-----------------|-------------------------------------------------|------------|
| (no flag)       | **toggle**: running → `unload`, not running → `on` | — |
| `--unload`      | `docker compose stop` (keep state/cache)        | `--unload-on` |
| `--unload-on`   | `docker compose start`                          | `--unload` |
| `--stop`        | `docker compose rm -s -f` (keep volumes)        | `--stop-on` |
| `--stop-on`     | `docker compose up -d`                          | `--stop` |
| `--down`        | `docker compose down --remove-orphans` (full)   | `--down-on` |
| `--down-on`     | `docker compose up -d`                          | `--down` |
| `--start`       | `docker compose up -d` (robust, works after any mode incl. down) | — |

## Steps

- [x] **1. Rename the script** — `mv ~/.local/bin/stop-colony ~/.local/bin/colony`, keep +x
      *Dependencies:* none
      *Files:* `~/.local/bin/stop-colony` → `~/.local/bin/colony` (rename)
      *Rollback:* `mv ~/.local/bin/colony ~/.local/bin/stop-colony`

- [x] **2. Rewrite arg parsing** — modes become `--unload | --unload-on | --stop | --stop-on | --down | --down-on | --start`; no flag = auto toggle; keep `-h/--help`; keep unknown-flag error
      *Dependencies:* step 1
      *Files:* `~/.local/bin/colony` (edit)
      *Rollback:* restore from `~/Documents/colony/stop-colony.sh` (identical copy)

- [x] **3. Implement on-modes + toggle** — on-modes pre-check "already running" and exit; toggle picks unload/on from `compose ps -q`; keep memory before/after + pre-checks
      *Dependencies:* step 2
      *Files:* `~/.local/bin/colony` (edit)
      *Rollback:* step 2 rollback

- [x] **4. Verify** — `bash -n`, `--help`, unknown-flag + missing-dir errors, and a full 12-scenario lifecycle test against a throwaway compose project in /tmp (all modes, guards, toggle both ways) — `bash -n ~/.local/bin/colony`, run `colony --help`, run `colony` toggle + a `--unload-on` smoke test
      *Dependencies:* step 3
      *Files:* none (verify only)
      *Rollback:* n/a

## Open questions (defaults assumed)

1. **Flag style** — keeping the existing `--flag` style (matches current script). Subcommand style (`colony unload-on`) is easy to switch to if preferred.
2. **`~/Documents/colony/stop-colony.sh`** — identical copy; leave untouched unless you want it synced/renamed too.
3. **Toggle "on"** uses `compose start` (fast restart, matches existing hint). If the last op was `--down`, `start` won't work — say the word and toggle-on will use `up -d` instead (robust in all states).
