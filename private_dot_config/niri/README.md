# niri config — extras on top of stock

Custom additions to the niri window manager setup.

## Touchscreen gestures (via lisgd)

**`~/.local/bin/niri/touch-gestures`** — auto-detects the touchscreen and runs lisgd.

| Fingers | Swipe | Edge | Action |
|---------|-------|------|--------|
| 1 | ←→ | left/right | Back (Alt+Left) — works in browsers, file managers |
| 1 | ↓ | top | Toggle overview |
| 1 | ↑ | bottom | Toggle overview |
| 3 | ←→ | any | **Horizontal scroll** (scrolls content in the focused app) |
| 3 | ↑↓ | any | Switch workspace up/down |

Uses `scroll-h`, a tiny uinput helper (`~/.local/bin/niri/scroll-h`), to emit
horizontal wheel events. Works without ydotool or extra daemons.

### Udev rule

`/etc/udev/rules.d/99-uinput.rules` — grants `input` group access to `/dev/uinput`
so `scroll-h` can create virtual input devices.

## Auto screen rotation (via rot8)

**Integrates the BMI260 accelerometer** so the screen rotates automatically
when the device is tilted (e.g. tablet mode, 2-in-1).

- **Daemon:** `rot8` (spawned at startup from `config.kdl`)
- **Hooks:** `~/.config/rot8/hooks.sh` — translates rot8 orientations into niri
  transforms and moves the Noctalia bar to stay on the right physical edge
- **Manual rotate scripts** (`~/.local/bin/niri/`):
  - `rotate_90`, `rotate_180`, `rotate_270`, `rotate_normal` — set a specific rotation
  - `rotate_next` — cycle to next rotation clockwise
  - `rotate_flip` — flip horizontally
  - `rotate_list` — list outputs and available scripts

## Noctalia integration

- **`noctalia.kdl`** — visual theme (focus ring, borders, shadows, tab indicators)
  using colors from the Noctalia palette (`#a2b574` green, `#161311` dark bg, `#e37874` red)
- **Bar rotation** — `update-bar-position` keeps the Noctalia bar on the physical
  right edge when the screen rotates
- **Screenshots, volume, brightness, night light** — all routed through Noctalia's
  IPC (`noctalia msg ...`) in `hotkeys.kdl`

## Portal startup

**`~/.local/bin/niri/start-portal.sh`** — starts `xdg-desktop-portal` directly.
Needed because Noctalia starts niri without systemd user session integration,
so `graphical-session.target` is never activated and the portal won't auto-start.
Enables things like Secret portal (gnome-keyring), file chooser portal, etc.

## Font size propagation

**`apply-font-size`** (spawned at startup) — reads `MY_FONT_SIZE` from
`environment.kdl` (default: 14) and pushes it to:
- **Kitty** — config include + live reload
- **GTK apps** — gsettings + gtk-3.0 settings.ini

## Environment defaults

**`environment.kdl`** sets:
- `TERMINAL=kitty`, `FILE_MANAGER=nautilus`, `BROWSER=brave-origin`
- `MY_FONT_SIZE=14`
- Wayland-only force for Electron, Qt, and GTK apps

## Window rules

In `config.kdl`:
- **Transparency + blur** on all windows (`opacity 0.95`, active; `0.90`, inactive)
- **22px rounded corners** with `clip-to-geometry`
- **Noctalia wallpaper** placed in backdrop so transparent windows show it
- **Noctalia bar/dock/launcher** — blurred backgrounds
- **Picture-in-Picture** windows open floating
- **WezTerm** gets an empty default column width (works around init bug)

## Visual style

- **Transparent background** — `background-color "transparent"` lets Noctalia
  wallpaper show through
- **Global blur** — 3 passes, offset 3.0
- **Drop shadows** — softness 30, spread 5, offset y=5, dark tint
