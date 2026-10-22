# Plan: Lid-wakeup fix + resume unblank (OneXPlayer Super V, CachyOS, Umbriel)

## Verified state (this session)

- uid `1000` / user `garlic`, `XDG_RUNTIME_DIR=/run/user/1000`
- `LID0  S3  *enabled  platform:PNP0C0D:00` → lid IS a wakeup source
- `~/.local/bin/lid-dpms` **already exists** and is more robust than the draft
  (handles bare-array `umbriel outputs --json`, explicit error handling)
- `~/.config/umbriel/config.toml` `[events]` **already** bound to the wrapper
- `/etc/systemd/logind.conf.d/10-power-lid.conf` already correct
- No `lid-resume-unblank.service`, no `disable-lid-wakeup.conf`
- `systemd-inhibit --list` → no inhibitors
- polkit agent IS registered (pkexec works, GUI prompt)
- `umbriel msg` under `env -i` **requires** `UMBRIEL_SOCKET` or `WAYLAND_DISPLAY`
  (bare minimal env fails: "cannot find umbriel socket")
- socket: `/run/user/1000/umbriel-wayland-0.sock` (name tracks WAYLAND_DISPLAY)

## Steps

- [x] **1. Disable lid as ACPI wakeup source** — create
      `/etc/tmpfiles.d/disable-lid-wakeup.conf` with `w /proc/acpi/wakeup - - - - LID0`,
      apply with `systemd-tmpfiles --create`
      *Dependencies:* none
      *Files:* /etc/tmpfiles.d/disable-lid-wakeup.conf (create)
      *Rollback:* delete file + reboot (re-enables)

- [x] **2. Resume-unblank service** — create
      `/etc/systemd/system/lid-resume-unblank.service`, `WantedBy=` the four sleep
      targets, `After=` the same; ExecStart discovers the Umbriel socket at runtime
      *Dependencies:* none
      *Files:* /etc/systemd/system/lid-resume-unblank.service (create)
      *Rollback:* `systemctl disable --now …` + rm

- [x] **3. Docked-safe lid DPMS** — already implemented (wrapper + `[events]` bindings)
      *Dependencies:* none
      *Files:* ~/.local/bin/lid-dpms, ~/.config/umbriel/config.toml (verify only)

- [x] **4. Verify** — grep /proc/acpi/wakeup, is-enabled, inhibit list
      Result: LID0 *disabled; service enabled + `systemd-analyze verify` clean +
      live `systemctl start` finished successfully
      *Dependencies:* steps 1,2

## Not done (needs the user; disruptive)

- Reboot persistence check, suspend/wake test — left to the user.
