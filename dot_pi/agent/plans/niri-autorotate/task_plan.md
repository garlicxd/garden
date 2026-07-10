# Plan: Automated Screen & Input Rotation for ONEXPLAYER Super V (Niri + Noctalia)

**Device:** ONEXPLAYER Super V — Intel Core Ultra X7 358H, Panther Lake  
**Kernel:** Linux 7.2.0-rc2-cachyos-rc  
**Compositor:** Niri 26.04 + Noctalia  
**Display:** eDP-1 (2880×1800 @ 120Hz, AMOLED)

---

## Summary

Integrate the BMI260 accelerometer with Niri's IPC and input calibration to automatically rotate the screen and recalibrate touch/stylus when the tablet is physically rotated. Uses `iio-sensor-proxy` + `iio-niri` as the primary daemon, with a fallback bash script, sleep-resume hook, and manual hotkey overrides.

---

## Prerequisites

- `rust` / `cargo` (install from repos; needed to build `iio-niri`)
- `iio-sensor-proxy` (in `cachyos-extra-v3` repo)
- `git` + `base-devel` for building from AUR/source

---

## Steps

### ⬜ 1. Install system packages

Install `iio-sensor-proxy`, `rust`, `cargo`, `base-devel`, `git`.

- **Files touched:** none (packages only)
- **Dependencies:** none
- **Rollback:** `sudo pacman -Rns iio-sensor-proxy rust cargo base-devel git`

---

### ⬜ 2. Install iio-niri from source (AUR/cargo)

Since no AUR helper is installed and `iio-niri` isn't in the repos, build via `cargo install iio-niri` or clone from AUR and `makepkg -si`.

- **Files touched:** none (binary installed to `~/.cargo/bin/iio-niri`)
- **Dependencies:** step 1 (rust/cargo/git)
- **Rollback:** `cargo uninstall iio-niri`

---

### ⬜ 3. Enable and test iio-sensor-proxy

Start + enable the D-Bus sensor service, verify accelerometer reports orientation changes via `monitor-sensor`.

- **Files touched:** none (systemd service)
- **Dependencies:** step 1
- **Rollback:** `sudo systemctl disable --now iio-sensor-proxy.service`

---

### ⬜ 4. Configure touch/tablet input map-to-output in Niri

Add `touch { map-to-output "eDP-1" }` and `tablet { map-to-output "eDP-1"; map-to-focused-output }` blocks to `~/.config/niri/config.kdl`.

- **Files touched:** `~/.config/niri/config.kdl` (edit)
- **Dependencies:** none
- **Rollback:** Remove the added input blocks
- **Validation:** `niri validate`

---

### ⬜ 5. Launch iio-niri at startup in Niri config

Add `spawn-at-startup "iio-niri" "listen" "--monitor" "eDP-1"` to `~/.config/niri/config.kdl`.

- **Files touched:** `~/.config/niri/config.kdl` (edit)
- **Dependencies:** step 2 (iio-niri installed), step 4 (input mapping)
- **Rollback:** Remove the spawn-at-startup line
- **Validation:** `niri validate`

---

### ⬜ 6. Add orientation lock / manual rotation hotkeys

Add keybinds to `~/.config/niri/hotkeys.kdl`:

- `Mod+Alt+L` → `iio-niri msg lock`
- `Mod+Alt+U` → `iio-niri msg unlock`
- `Mod+Ctrl+Up` → rotation normal
- `Mod+Ctrl+Right` → rotation 90°
- `Mod+Ctrl+Down` → rotation 180°
- `Mod+Ctrl+Left` → rotation 270°

- **Files touched:** `~/.config/niri/hotkeys.kdl` (edit)
- **Dependencies:** step 4, step 5
- **Rollback:** Remove added keybinds
- **Validation:** `niri validate`

---

### ⬜ 7. Add sleep-resume systemd hook

Create `/usr/lib/systemd/system-sleep/iio-sensor-proxy-resume` that restarts the sensor proxy on resume.

- **Files touched:** `/usr/lib/systemd/system-sleep/iio-sensor-proxy-resume` (create, chmod +x)
- **Dependencies:** step 1 (iio-sensor-proxy installed)
- **Rollback:** `sudo rm /usr/lib/systemd/system-sleep/iio-sensor-proxy-resume`

---

### ⬜ 8. Validate full Niri config

Run `niri validate` to confirm the config is syntactically correct.

- **Files touched:** none
- **Dependencies:** steps 4, 5, 6
- **Rollback:** N/A

---

### ⬜ 9. Reload Niri and verify rotation works

Run `niri msg action do-screen-transition` to reload config, then physically rotate the tablet to confirm the screen and touch inputs follow the orientation.

- **Files touched:** none
- **Dependencies:** step 8
- **Rollback:** Reboot / `niri msg action output "eDP-1" transform "normal"`

---

### ⬜ 10. (Optional Fallback) Create bash autorotate script

If `iio-niri` fails to build or has issues, create `~/.config/niri/scripts/niri-autorotate.sh` as a fallback bash daemon using `monitor-sensor` + `niri msg` for rotation and calibration matrices (supports all 4 orientations with affine matrix correction for touch/stylus). Add `spawn-at-startup` for the script path.

- **Files touched:** `~/.config/niri/scripts/niri-autorotate.sh` (create, chmod +x), `~/.config/niri/config.kdl` (edit spawn-at-startup)
- **Dependencies:** step 1 (iio-sensor-proxy for monitor-sensor)
- **Rollback:** Remove the script and spawn line

---

## Files Summary

| File | Action |
| ------ | -------- |
| `~/.config/niri/config.kdl` | Edit: add touch/tablet map, spawn iio-niri, optional fallback spawn |
| `~/.config/niri/hotkeys.kdl` | Edit: add rotation lock and manual transform keybinds |
| `/usr/lib/systemd/system-sleep/iio-sensor-proxy-resume` | Create: restart sensor proxy on resume |
| `~/.config/niri/scripts/niri-autorotate.sh` | Create (optional fallback): bash autorotate daemon |

## Risks & Mitigations

| Risk | Mitigation |
| ------ | ------------ |
| bmi270 driver doesn't probe on this kernel | Check dmesg; may need kernel module blacklist/update; fall back to bash script watching /sys |
| iio-niri fails to build (Rust deps) | Fall back to bash autorotate script (step 10) |
| Touch calibration matrix ignored (Niri < 25.11 bug) | Running Niri 26.04 — already fixed |
| Accidental rotation on uneven surface | Lock hotkey (`Mod+Alt+L`) locks rotation via iio-niri IPC |
| Sensor dies after suspend | systemd sleep-resume hook restarts iio-sensor-proxy |
| Display orientation mapping mismatch (native portrait panel) | Not an issue: Super V uses natively landscape 2880×1800 panel |
