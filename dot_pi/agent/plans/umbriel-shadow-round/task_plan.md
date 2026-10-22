# Plan: Round Umbriel shadows to match window corner radius (config-only)

## Decision

No compositor rebuild. Use the configuration compromise: minimum `softness` > 0 so the
shader takes the blurred path, which derives its shape from `corner_radius`.

Background: with `softness = 0` the shader's flat-alpha fast path ignores `corner_radius`
(outer shadow contour is square). There is no shadow-radius config key.

## Steps

- [x] **1. Set `softness = 1`** in `~/.config/umbriel/appearance.toml`
      (`[appearance.shadow]`). Offsets left untouched (`offset_x/offset_y = 20`).
      *Rollback:* set back to `0`.
- [x] **2. Validate** — `umbriel validate` → `config: ok`.
- [ ] **3. Confirm visually** — config live-reloads on save; corners should now be rounded.
      Bump `softness` to `2` if the 0.5px diffusion is too subtle/sharp.

## Notes

- If a crisp (unblurred) rounded shadow is ever required, it needs the upstream shader
  patch (`box_shadow.frag` hard-edge branch → apply `corner_alpha` with `corner_radius`).
- The alternative compromise (shadows off + border outlines) was not used.
