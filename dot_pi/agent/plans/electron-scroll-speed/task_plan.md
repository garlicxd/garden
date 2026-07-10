# Plan: Niri scroll-factor for Vesktop & all Electron apps

## Context

Brave's scroll speed is slowed via Niri's `window-rule` using `scroll-factor 0.15` matched on `app-id=r#"^brave-origin$"#` in `/home/garlic/.config/niri/config.kdl`.

Vesktop (app-id: `"vesktop"`) is another Electron app that likely has overly fast scrolling. The same approach works for **any** window Niri can match by `app-id`.

## Steps

- [x] **1. Merge Brave + Vesktop into combined window-rule** — insert a `window-rule` block matching `app-id=r#"^vesktop$"#` with `scroll-factor 0.15`, right after the Brave rule.
      *Dependencies:* none
      *Files:* `/home/garlic/.config/niri/config.kdl` (edit)
      *Rollback:* remove the added lines

- [x] ~~**2. Add window-rule for generic Electron apps (optional)** — merged into step 1~~ — if desired, add a broader rule matching a regex like `r#"^(vesktop|discord|code|obsidian|slack|riot|element|signal-desktop)$"#` to cover common Electron apps. Discuss with user first.
      *Dependencies:* step 1 (insertion position)
      *Files:* `/home/garlic/.config/niri/config.kdl` (edit)
      *Rollback:* remove the added lines

- [x] **3. Validate Niri config** — run `niri validate` to confirm the config is syntactically valid.
      *Dependencies:* steps 1–2
      *Files:* none
      *Rollback:* n/a (validation only; if it fails, fix before proceeding)

- [x] **4. Reload Niri** — run `niri msg action do-screen-transition` to apply the new rules live.
      *Dependencies:* step 3
      *Files:* none
      *Rollback:* `niri msg action do-screen-transition` again after reverting the config

## Verification

- `niri validate` exits with code 0
- `niri msg action do-screen-transition` succeeds
- Scroll in Vesktop (and other added apps) is noticeably slower
