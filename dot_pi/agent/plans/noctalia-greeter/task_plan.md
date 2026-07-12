# Plan: Set Noctalia Greeter as Default Display Manager

## Current State

| Component | Status |
| ----------- | -------- |
| `greetd` (v0.10.3) | Installed, **disabled**, not running |
| `noctalia-greeter` (v1.0.0) | Installed (binaries in `/usr/bin/`) |
| `greeter` user | Exists, but shell=`/bin/bash` home=`/` (wrong) |
| `/etc/greetd/config.toml` | Uses `agreety --cmd /bin/sh` (text greeter) |
| Display manager service | No symlink; `greetd.service` has `Alias=display-manager.service` |
| Other DMs (SDDM/GDM/LightDM) | Not installed — no conflict |

## Prerequisites

- `greetd` and `noctalia-greeter` packages are already installed
- `niri.desktop` session exists at `/usr/share/wayland-sessions/`
- The `greeter` user already exists (needs fixing)

## Steps

- [x] **1. Fix the `greeter` user** — change shell to `/usr/bin/nologin` and home to `/var/lib/noctalia-greeter`, ensure `video` group membership is preserved
      *Dependencies:* none
      *Files:* N/A (`usermod` commands)
      *Rollback:* `sudo usermod -s /bin/bash -d / greeter`

- [x] **2. Configure greetd to use noctalia-greeter** — backup current `/etc/greetd/config.toml` and write new config pointing to `noctalia-greeter-session`
      *Dependencies:* step 1
      *Files:* `/etc/greetd/config.toml` (edit), `/etc/greetd/config.toml.bak` (backup)
      *Rollback:* `sudo mv /etc/greetd/config.toml.bak /etc/greetd/config.toml`

- [x] **3. Enable and start greetd** — this auto-creates the `display-manager.service` alias
      *Dependencies:* step 2
      *Files:* systemd symlink `/etc/systemd/system/display-manager.service -> /usr/lib/systemd/system/greetd.service`
      *Rollback:* `sudo systemctl disable --now greetd`

- [x] **4. Verify** — confirm greetd is running, display-manager symlink exists, and no errors in journal
      *Dependencies:* step 3
      *Files:* N/A (verification only)
      *Rollback:* N/A

## Notes

- Noctalia Greeter is **not** a full DM — it's a greeter that runs under **greetd**. greetd is the actual display manager.
- `greetd.service` already declares `Alias=display-manager.service` in its unit file, so enabling it is sufficient — no manual symlink needed.
- The greeter will show a user picker with password entry. If niri should be the default session, add `--session niri` to the command.
- Reboot or switch VT (Ctrl+Alt+F1) to see the new greeter after setup.
