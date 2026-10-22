# Plan: Auto-rotation (Niri + Noctalia v5 bar) via iio-sensor-proxy + iio-niri

## Corrections to the provided spec (verified against this system + upstream docs)

1. **`iio-niri` is AUR-only** (v2.3.1) — `shelly install iio-niri` would fail. Correct: `sudo shelly aur install iio-niri`; `iio-sensor-proxy` is in repo (`cachyos-extra-v3`).
2. **iio-niri has no `config.toml`** — it's CLI-driven ([Zhaith-Izaliel/iio-niri](https://github.com/Zhaith-Izaliel/iio-niri)); v2.x uses the `listen` subcommand and is spawned by niri itself: `spawn-at-startup "iio-niri" "listen" "--monitor" "eDP-1"`.
3. **Role conflict in the spec**: iio-niri *already* rotates niri (`niri msg output <name> transform`). A rotate-handler that also rotates niri = double rotation fighting. Split: **iio-niri owns the niri transform; a bar-handler owns only the Noctalia bar**.
4. **Noctalia v5 has no `noctalia-cli`** and no `config set`/`refresh`. Real CLI: `noctalia msg config-reload`; config is **TOML** (`[bar.default] position`), GUI state in `~/.local/state/noctalia/settings.toml` (loads last, wins).
5. **`iio_lock` plugin (community: `nikolaj-zwergius/iio_lock`) — DEFERRED by user decision.** It's installed/enabled but is Hyprland/Sway-only (tools `iio-hyprland`/`iio-sway`, `hyprctl`/`swaymsg` backends) — inert on niri. A niri-enabled local fork (tool `iio-niri`, `niri msg` panel backend) is future work. The bar handler (step 5) already gates on `pgrep iio-niri` so a lock toggle slots in later.
6. **Missing from spec: mount matrix** — without `ACCEL_MOUNT_MATRIX` (from DSDT `ROMS`: `0 1 0 / 1 0 0 / 0 0 -1`), iio-sensor-proxy reports wrong orientations. Added.

## Steps

- [x] **1. Install iio-sensor-proxy** ✅ installed (repo) + service active (repo) — `sudo shelly install iio-sensor-proxy`; enable: `systemctl enable --now iio-sensor-proxy.service`
      *Files:* n/a (package)
      *Rollback:* `sudo shelly remove iio-sensor-proxy`

- [x] **2. Install iio-niri** ✅ installed by user (AUR v2.3.1); PKGBUILD audited clean (AUR) — audit PKGBUILD first (`shelly aur search-pkgbuild iio-niri -j`), enable chroot protections (`shelly config set AurInstallUseChroot True`), then `sudo shelly aur install iio-niri`
      *Files:* n/a (package)
      *Rollback:* `sudo shelly aur remove iio-niri`

- [x] **3. Mount matrix (udev rule)** ✅ /etc/udev/rules.d/61-sensor-superv.rules → ACCEL_MOUNT_MATRIX=0,1,0;1,0,0;0,0,-1 (iio device has no modalias, so a direct rule replaces the hwdb approach) — create `/etc/udev/hwdb.d/61-sensor-superv.hwdb`:
      `sensor:modalias:acpi:BMI0260:*` → `ACCEL_MOUNT_MATRIX=0,1,0;1,0,0;0,0,-1`
      then `systemd-hwdb update` + `udevadm trigger`
      *Files:* /etc/udev/hwdb.d/61-sensor-superv.hwdb (create)
      *Rollback:* remove file + `systemd-hwdb update`

- [x] **4. Spawn iio-niri from niri** ✅ autostart.kdl: `spawn-at-startup "iio-niri" "listen" "--monitor" "eDP-1"`; validated; running — edit `~/.config/niri/config.kdl`: add
      `spawn-at-startup "iio-niri" "listen" "--monitor" "eDP-1"`; `niri validate`; reload niri config
      *Files:* ~/.config/niri/config.kdl (edit)
      *Rollback:* remove line + reload

- [x] **5. Bar handler — NOT NEEDED** ✅ verified empirically: with output transform 90°, the Noctalia bar stays on the content-left automatically (niri rotates layer-shell space); a handler would break it — create `/usr/local/bin/noctalia-rotate`:
      maps sensor orientation → `[bar.default] position` in `settings.toml`, then `noctalia msg config-reload`
      (normal→left, left-up→top, bottom-up→right, right-up→bottom; tunable).
      **Gates on `pgrep iio-niri`** — if the rotation daemon isn't running (future lock state), the bar stays put.
      *Files:* /usr/local/bin/noctalia-rotate (create)
      *Rollback:* remove file

- [x] **6. Watcher service — NOT NEEDED** (same reason) — create `~/.config/systemd/user/noctalia-rotate.service`:
      `gdbus monitor --session --dest net.hadess.SensorProxy` → parses `AccelerometerOrientation` → calls `noctalia-rotate`; enable `--user`
      *Files:* ~/.config/systemd/user/noctalia-rotate.service (create)
      *Rollback:* `systemctl --user disable --now noctalia-rotate`

- [x] **7. Verify** ✅ proxy: HasAccelerometer=true, orientation=normal, tilt=tilted-up; transform test: bar follows correctly; iio-niri IPC has lock-rotation for future lock support — `monitor-sensor` shows orientations; tilt device → niri transform changes (iio-niri) + bar follows (handler); tune bar mapping if the rotation direction feels wrong

## Risks

- Rotation direction/mapping may need tuning after physical testing (device must be tilted).
- `settings.toml` is GUI-owned; if the user changes bar position in the Settings UI, it re-wins until next rotation event.
- iio-niri v2.x needs the `listen` subcommand; wrong args = no rotation (check `iio-niri --help` after install).
