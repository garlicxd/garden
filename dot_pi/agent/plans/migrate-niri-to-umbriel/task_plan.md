# Plan: Migrate niri → Umbriel

## Context

Current setup (all live in a running niri session on tty1):

- `~/.config/niri/*.kdl` — modular KDL config (env, layout, input, effects, gestures,
  animation, autostart, keybinds, rules, display, noctalia colors).
- `~/.config/noctalia/` is **empty** — Noctalia shell runs fully on defaults.
- Session start: greetd → `noctalia-greeter-session` → user picks a
  `/usr/share/wayland-sessions/*.desktop` (niri or umbriel both installed).
- Rotation: systemd user units `iio-niri.service` + `niri-iio-lock-applet.service`,
  both `WantedBy=graphical-session.target` (niri's session target — **kept untouched**, see
  decisions); custom wrapper
  `~/Documents/niri-iio-lock-applet/iio-niri-start.sh` (listen --monitor eDP-1, restore
  persisted lock state); SNI applet (`applet.c`, source present) toggles lock via `iio-niri msg`.
- Umbriel packages already installed: `umbriel-git`, `xdg-desktop-portal-umbriel-git`,
  `xwayland-satellite`, session file `umbriel.desktop`. `~/.config/umbriel/config.toml`
  exists but is **identical to the shipped example** (only a comment differs) — nothing migrated yet.

Target: Umbriel (0.1.0-git) + Noctalia v5 shell, matching current behavior/binds as closely
as the compositor allows. Umbriel config is live-reloaded TOML with includes; validates via
`umbriel validate`.

## Key facts driving decisions

- Umbriel action/keybind vocabulary differs from niri (TOML `[keybinds]`, actions like
  `window-focus-left`, `column-move-to-workspace:N`, `workspace-next/previous`). Configured
  chords *replace* matching built-ins; unlisted built-ins stay (Mod+1..9 focus workspace,
  Mod+Shift+1..9 moves window, keypad digits, etc.).
- Umbriel owns `XDG_CURRENT_DESKTOP` (cannot be set in config) and publishes `[environment]`
  to the systemd user manager at startup. No `environment.d` files exist today → niri's
  `env.kdl` vars must move into Umbriel `[environment]` (or new environment.d).
- Umbriel runs as user service on **`umbriel-session.target`** (`umbriel.service`); niri runs on
  `graphical-session.target`. Since rotation is deferred and niri stays installed, the iio
  units keep their `graphical-session.target` wiring and simply do not start under Umbriel.
- `iio-niri` talks **niri IPC only** (strings: `niri-ipc-26.4.0`, NIRI_SOCKET) — unusable under
  Umbriel. Umbriel implements `wlr-output-management-unstable-v1` (wlr-randr/kanshi/wdisplays
  can set transform at runtime), but no transform action exists in `umbriel msg`. A future
  rotation solution would need a wlr-output-management-based daemon.
- Not portable to Umbriel (no equivalent): per-window `scroll-factor` (Electron rule),
  `tabbed` display, `center-visible-columns`, `toggle-keyboard-shortcuts-inhibit`,
  compositor screenshot-window, per-state shadow colors. Handled case-by-case below.
- Lock is Noctalia's own session lock (`noctalia msg session lock`), verified against the
  installed Noctalia CLI — Umbriel supports session locking, so Noctalia's lock screen applies.

## Decisions (approved by user)

1. **Rotation: deferred.** No autorotation under Umbriel for now — iio-niri units stay as-is
   (niri-only via `graphical-session.target`); they just won't run in an Umbriel session.
   If a future rotation need arises, use a `wlr-output-management`-based daemon.
2. **Keep niri installed** for rollback — switch sessions in the greeter any time.
3. **Locker = Noctalia:** lock via `noctalia msg session lock` (verified: `noctalia msg
   session <action>` with actions lock, suspend, lock-and-suspend, logout, reboot, shutdown).
   No swaylock.

## Steps

^- [x] **0. Snapshot & baseline**
      Copy current state for rollback: `cp -a ~/.config/umbriel ~/.config/umbriel.bak-$(date +%F)`;
      note git-less niri config, capture `umbriel validate` output on stock config.
      *Dependencies:* none | *Files:* ~/.config/umbriel (backup) | *Rollback:* restore backup.

^- [x] **1. Umbriel config skeleton (includes + main)**
      Restructure `~/.config/umbriel/config.toml` as a thin main file plus include files
      mirroring the old niri module layout:
      `keybinds.toml`, `outputs.toml`, `rules.toml`, `appearance/input/env` kept in main.
      Validate after writing (`umbriel validate`). Main-file values win over includes; later
      includes win over earlier — document precedence in comments.
      *Dependencies:* step 0 | *Files:* ~/.config/umbriel/config.toml (rewrite),
      keybinds.toml, outputs.toml, rules.toml (create) | *Rollback:* restore backup.

^- [x] **2. Environment (`env.kdl` → `[environment]`)** — values apply only at startup; requires
      session restart to take effect, so do early.
      - Port: PATH (bun/pi/bin additions), TERMINAL=kitty, FILE_MANAGER=nautilus,
        BROWSER=brave-origin, MY_FONT_SIZE, OZONE_PLATFORM_HINT/ELECTRON_OZONE...=wayland,
        QT_QPA_PLATFORM=wayland, QT_QPA_PLATFORMTHEME=qt6ct, QT_WAYLAND_DISABLE_WINDOWDECORATION=1,
        GDK_BACKEND=wayland, CLUTTER_BACKEND=wayland.
      - **Drop** `XDG_CURRENT_DESKTOP=niri` (Umbriel owns it), `XDG_SESSION_TYPE` (owned).
      - Verify qt6ct theme etc. still resolve; confirm Noctalia behaves the same with
        XDG_CURRENT_DESKTOP=umbriel (first-run check).
      *Dependencies:* step 1 | *Files:* config.toml | *Rollback:* remove [environment] keys.

^- [x] **3. Outputs (`display.kdl` → `outputs.toml`)**
      `[output.eDP-1]`: mode "2880x1800@120", scale 1.8, position [0,0].
      niri `variable-refresh-rate on-demand=true` has no exact Umbriel equivalent →
      **decision** `vrr = "fullscreen"` (recommended) or `"always"`; note disabled is default.
      Get connector name/current mode first via nested run or `umbriel outputs` inside session.
      *Dependencies:* step 2 | *Files:* outputs.toml | *Rollback:* delete file → stock.

^- [x] **4. Appearance / layout / effects / animation / colors (`layout.kdl`, `effects.kdl`,
      `animation.kdl`, `noctalia.kdl` → config.toml)**
      - `[appearance]`: corner_radius 12 (was geometry-corner-radius 12), prefer_no_csd=true,
        border_width 2, outer 0.
      - `[appearance.blur]`: enabled, passes 3, radius 3 (≈ niri blur passes 3 offset 3).
      - `[appearance.shadow]`: enabled, softness 10 (niri softness 10 / spread 1; Umbriel has
        offset_x/y — leave offsets 2 or set 1 for parity, cosmetic).
      - `[layout]`: mode scrolling, gap 12 (niri gaps 12), width_presets [0.333,0.5,0.667],
        scrolling.default_width_fraction 0.5, center_focused=false ("never"),
        center_underfull_strip true, expand_single_column true.
      - `[colors]` from noctalia.kdl: border focused `#d7827e`→`#D7827EFF`; unfocused
        transparent (`#00000000` — layout.kdl forced inactive ring/border transparent);
        insert_hint `#d7827e80`; keep default shadow/backdrop (note: backdrop shows in
        fullscreen-gap edges; verify wallpaper look, set backdrop transparent only if needed).
        Urgent/overview badge colors optional.
      - `[animation]`: translate niri springs/curves to Umbriel duration/curve presets
        (workspace-switch ~250ms easeout, window-open popin ~200ms, window-close fade ~200ms,
        movement snappy ~250ms, overview ~250ms). No spring curves unless registered.
      *Dependencies:* step 1 | *Files:* config.toml | *Rollback:* git-less copy kept in step 0.

^- [x] **5. Window & layer rules (`rules.kdl` → `rules.toml`)**
      - Global: selectorless `blur = true` first; selectorless `opacity = 0.95`.
      - Dynamic dim: `match.is_focused = false → opacity 0.85` (niri inactive 0.85).
        (Corner radius is global now, not per-window.)
      - **Drop / note**: Electron `scroll-factor 0.15` rule — no Umbriel equivalent; instead
        tune `[input.mouse] scroll_wheel_step` / `[input.touchpad] scroll_factor` if the feel
        is off. Flag as behavior difference.
      - Steam: float non-main windows — `match.app_id "^steam$"` + title negative lookahead
        `"^(?![Ss]team$)"` → default_floating (niri used exclude-title; Umbriel has no exclude).
      - Brave PiP: `app_id "^brave-origin$"`, title `^(Picture-in-Picture|Picture in picture)$`,
        default_floating, default_position {x=10,y=10,anchor="bottom_right"}, default_focused=false
        (example already ships a generic variant; replace with user's scoped one).
      - Steam toasts: adopt example rule (bottom_right, default_focused=false, pinned).
      - Noctalia layers: union of niri namespaces (`noctalia-(background|launcher-overlay|dock)-.*`)
        with example's (`bar-…|notification|dock|panel|attached-panel|osd|desktop-widget-…`) →
        single blur layer_rule. **Verify real namespaces** with `umbriel layers` after Noctalia is up.
      - Noctalia wallpaper backdrop rule has no layer-rule key → verify wallpaper renders behind
        translucent windows; wallpaper layer surfaces at background layer normally suffice.
      - Keep/adjust example Noctalia window rules (Noctalia settings/share picker) as-is.
      *Dependencies:* step 4 | *Files:* rules.toml | *Rollback:* restore file.

^- [x] **6. Keybinds (`keybinds.kdl` → `keybinds.toml`)** — largest step; map every niri chord to
      Umbriel action (table below). Confirm key names (e.g. `Semicolon`, `Print`, `Page_Up`,
      `WheelUp`, `BracketLeft`) via `umbriel validate` + on-screen cheatsheet
      (`umbriel msg cheatsheet-open` in nested session).
      Apps: Mod+P pi-launcher spawn; Mod+A noctalia msg panel-toggle launcher; Mod+T spawn
      ${TERMINAL:-kitty}; Mod+E nautilus; Mod+B brave-origin; Mod+Semicolon `qwen --toggle`.
      Screenshot: Mod+S/Print → noctalia msg screenshot-region; Ctrl+Print fullscreen;
      Alt+Print `fullscreen pick`; Shift+Print → check `noctalia msg screenshot-window`
      (fallback: region). Media/volume/brightness/nightlight/mic: keep `noctalia msg …`
      spawn binds, with `allow_when_locked = true` on the audio/brightness set (table form).
      Overview Mod+D = overview-toggle repeat=false. Close Mod+Q window-close repeat=false.
      Focus: Mod+Arrows + Mod+H/J/K/L → window-focus-left/down/up/right.
      Move-in-column: Mod+Ctrl+(Left/Right/H/L) → column-move-left/right;
      Mod+Ctrl+J/K → window-move-down/up.
      Workspace nav: Mod+Page_Down/Up & Mod+U/I → workspace-next/previous;
      Mod+Ctrl+Page_/Ctrl+U/I → column-move-to-workspace-next/previous;
      Mod+Shift+Page_/Shift+U/I → workspace-move-down/up (reorder, matching niri semantics;
      note Umbriel docs recipe assigns Shift+Page to move-window-to-workspace — we override).
      Index: rely on built-in Mod+1..9; bind Mod+Ctrl+1..9 → column-move-to-workspace:N.
      Columns: Mod+Home/End → column-focus-first/last; Mod+Ctrl+Home/End → column-move-to-first/last.
      Monitors: Mod+Shift+Arrows/HJKL → output-focus-*; Mod+Shift+Ctrl+Arrows/HJKL →
      column-move-to-output-*.
      Consume/expel: Mod+BracketLeft/Right → window-consume-or-expel-left/right;
      Mod+Comma/Period → window-consume-left / window-consume-or-expel-right.
      Width/height: Mod+R/Shift+R → window-cycle-width(-back); Mod+Ctrl+Shift+R →
      window-cycle-height; Mod+Minus/Equal → window-modify-width:-0.1/0.1; Mod+Shift+Minus/Equal →
      window-modify-height:-0.1/0.1. (No reset-height → drop Mod+Ctrl+R or map to set 0.5.)
      Modes: Mod+F → window-toggle-maximize; Mod+Shift+F → window-toggle-fullscreen;
      Mod+Ctrl+F → window-toggle-maximize; Mod+M → window-toggle-maximize-to-edges;
      Mod+C → column-center; Mod+V → window-toggle-floating; Mod+Shift+V →
      window-focus-switch-floating; Mod+P → pi-launcher already above → pinned moves to
      Mod+Shift+P? (conflicts w/ niri dpms-off → keep dpms-off elsewhere; see system).
      Dropped (no equivalent): Mod+Ctrl+C center-visible-columns, Mod+W tabbed, Mod+Escape
      shortcut-inhibit (optionally repurpose to submap:reset), Shift+Print screenshot-window
      (unless noctalia msg provides), Mod+WheelRight/Left & Ctrl+wheel (Umbriel wheel names are
      WheelUp/Down only for vertical; WheelLeft/Right exist → bind if supported).
      Wheel: Mod+WheelDown/Up → workspace-next/previous; Mod+Ctrl+WheelDown/Up →
      column-move-to-workspace-next/previous; Mod+Shift+WheelDown/Up → window-focus-right/left
      (verify vs Umbriel built-ins: Mod+WheelUp/Down default to window-focus-left/right — we
      override; Mod+Shift+Wheel recipe in docs is column-move — choose and validate cheatsheet
      shows no duplicates).
      Lock/quit/power: Super+Alt+L → `noctalia msg session lock`;
      Mod+Shift+E & Ctrl+Alt+Delete → session-quit; Mod+Shift+P → dpms-off.
      *Dependencies:* step 5 | *Files:* keybinds.toml | *Rollback:* remove file → built-ins.

^- [x] **7. Autostart & systemd (no session-target churn)**
      - `general.autostart = ["noctalia"]` (dbus-update-activation-environment is already done by
        start-umbriel; drop from autostart).
      - `shelly-notifications.service` is symlinked into both `default.target.wants` and
        `graphical-session.target.wants` — it starts at user login regardless of compositor,
        so it needs **no change**.
      - Rotation units: **leave untouched** (decision 1) — keyed to niri's
        `graphical-session.target`, inert under Umbriel.
      - `systemctl --user daemon-reload` after any unit edits (expect none here).
      *Dependencies:* step 3 | *Files:* config.toml | *Rollback:* revert autostart list.

- [ ] **8. Session switch & acceptance run**
      Log out of niri; in noctalia-greeter pick **Umbriel**. Verify: session boots, Noctalia
      bar/panels/dock/launcher/wallpaper work, outputs/scale/VRR, keybinds (cheatsheet),
      blur/opacity/corners/shadows, floating rules (Steam, PiP, toasts), lock via
      `noctalia msg session lock`, portals (xdg-desktop-portal-umbriel), Xwayland apps.
      Rotation is N/A (deferred). Iterate on `umbriel validate` + live reload while inside the
      session. Keep niri installed; switch back anytime via greeter.
      *Dependencies:* all prior | *Files:* none | *Rollback:* pick niri at greeter.

## Risks / notes

- Umbriel is 0.1.0-git and docs warn defaults/keys change between releases; config written
  against the installed binary's behavior — validate after every edit.
- No per-window scroll factor → Electron/Steam trackpad feel may differ (global factors only).
- Layer/wallpaper interaction and focus-ring parity need visual confirmation on the real session.
- XDG_CURRENT_DESKTOP becomes Umbriel — confirm Noctalia's desktop integration and any app
  behavior keyed on niri.
- Multi-step plan; keep niri + old umbriel example untouched until step 9 passes.
