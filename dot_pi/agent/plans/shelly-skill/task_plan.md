# Plan: Shelly Package Manager Skill

Create a token-efficient Pi agent skill (`shelly-pkg-manager`) covering the full Arch Linux package lifecycle via Shelly CLI + makepkg.

## Scope — 8 Areas

1. **System health** — sync, check-updates, list-updates, news (pre-upgrade), upgrade, upgrade-all, cache-clean, purify, fix-permissions
2. **Standard repos** — query (JSON), install, remove, downgrade, ignore, mark
3. **AUR** — search (JSON), install, install-version (pin commit), search-pkgbuild (fetch + audit), update, upgrade, remove
4. **Flatpak** — search, install, update, upgrade, remove, list, remotes
5. **AppImage** — install, remove, upgrade, list, configure-updates
6. **Maintenance** — pacfile (.pacnew/.pacsave mgmt), cache-clean, purify, fix-permissions, keyring, export/import system state
7. **Custom PKGBUILD pipeline** — fetch → security audit → modify → build → install → runtime config → cleanup
8. **Worked example** — llama.cpp + OpenVINO (exercises every PKGBUILD phase)

## Key Skill Design Rules

- **Concise**: Use tables for command references, not prose. Max ~200 lines total.
- **JSON-first**: All queries use `-j`. Show one JSON sample, reference it thereafter.
- **Shortcodes in tables**: Show both `shelly install pkg` and `-SI pkg` side by side.
- **Audit checklist as a bullet list**: Dense, scannable, no narrative.
- **Breaking changes**: Show one workflow, not explained philosophy.

## Steps

- [x] **1. Create skill directory** ✅
- [x] **2. Write frontmatter + system health section** ✅
- [x] **3. Write standard repo + AUR section** ✅
- [x] **4. Write Flatpak + AppImage section** ✅
- [x] **5. Write PKGBUILD security audit checklist** ✅
- [x] **6. Write PKGBUILD modification pipeline** ✅
- [x] **7. Move example to context files** — llama.md + openvino.md extracted, SKILL.md trimmed, all reference ~/AGENTS.md ✅
- [x] **8. Write rollback + troubleshooting section** ✅
- [x] **9. Validate** — YAML, syntax, discoverability ✅
- [x] **10. Create `~/.local/bin/pkgsearch`** — unified repo + AUR search, LLM-friendly JSON, 4 edge cases tested ✅
- [x] **11. Update SKILL.md** — Pre-Install Search section ✅

## Result

- **File**: `/home/garlic/.pi/agent/skills/shelly-pkg-manager/SKILL.md` (219 lines)
- **YAML**: valid, `name: shelly-pkg-manager`
- **Coverage**: All 8 areas, 40+ Shelly commands documented
- **Pi discovery**: Located in `~/.pi/agent/skills/` — will be indexed on next agent restart
