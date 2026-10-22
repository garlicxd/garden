# Plan: pi extension for colony control + qwen-only OVMS config

## Goal

1. Add a pi extension (custom tool + command) that turns on the colony container with the
   right model — start via `colony --start`, then verify the `qwen` servable is the one
   served by OVMS.
2. Make the colony container serve **only qwen** — drop `bge-small` / `bge-reranker` from
   the OVMS config so startup is faster and RAM is freed.

## Current state (verified)

- Colony = single OVMS container (`colony-ovms:2026.4.0`), compose at
  `~/Documents/colony/docker-compose.yml`, serving 3 models from `models/config.json`:
  `bge-small`, `bge-reranker`, `qwen` (current: Qwen3.8-27B-int4; `qwen.qwen3.6` backup on disk).
- pi already has provider `colony-ovms` → `http://127.0.0.1:8000/v3`, model id `qwen`
  (`~/.pi/agent/models.json`) — **nothing to change there**.
- pi global extensions live in `~/.pi/agent/extensions/` (existing: `rag_researcher.ts`,
  which already talks to OVMS at `http://127.0.0.1:8000/v3` — reuse the same style).
- Command `colony` exists at `~/.local/bin/colony` (symlink → `~/Documents/colony/stop-colony.sh`).
- ⚠️ **Dependency found:** `~/Documents/searxng-rag/rag-proxy/main.py` uses `bge-small`
  (embeddings) + `bge-reranker` (rerank) from colony:8000. Dropping bge breaks RAG
  embeddings/rerank until re-enabled. Flagging — see decision point below.
- `~/Documents/colony` is **not a git repo** → backups via `.bak` files (existing pattern).

## Steps

### Part A — pi extension

- [x] **1. Create `~/.pi/agent/extensions/colony.ts`** — registers:
      - Tool **`colony_control`** (LLM-callable, TypeBox params):
        `action: StringEnum(["start","stop","unload","down","status"])`
        - `start` → `execFile` `${HOME}/.local/bin/colony --start`, then poll
          `GET http://127.0.0.1:8000/v3/models` a few times → report `qwen` readiness
          (qwen load takes 2–5 min → report "loading…" instead of blocking forever)
        - `stop`/`unload`/`down` → delegate to the colony script flags
        - `status` → GET `/v3/models` + `docker compose ps` → report servables + qwen state
      - Command **`/colony`** → same actions manually: `/colony start|stop|unload|down|status`
      - Style matches `rag_researcher.ts` (`defineTool`, `Type` from `@earendil-works/pi-ai`,
        `node:child_process` + `node:os`); adds `promptSnippet`/`promptGuidelines`
      *Dependencies:* none
      *Files:* `~/.pi/agent/extensions/colony.ts` (create)
      *Rollback:* delete file (or keep as `.bak-<ts>`)

### Part B — qwen-only OVMS config

- [x] **2. Back up** — `cp models/config.json models/config.json.bak-qwen-only` and
      `cp docker-compose.yml docker-compose.yml.bak-qwen-only` (suffix avoids clobbering the
      pre-existing `.bak`; no git)
      *Dependencies:* none
      *Files:* backups (create)
      *Rollback:* n/a

- [x] **3. Edit `models/config.json`** — remove `bge-small` + `bge-reranker` entries,
      keep only `qwen`. (bge dirs stay on disk → instant re-enable later)
      *Dependencies:* step 2
      *Files:* `~/Documents/colony/models/config.json` (edit)
      *Rollback:* restore `config.json.bak-qwen-only`

- [x] **4. Edit `docker-compose.yml` healthcheck** — drop the two bge HTTP pings; keep
      only the qwen check (otherwise the healthcheck fails and docker restarts the container)
      *Dependencies:* step 2
      *Files:* `~/Documents/colony/docker-compose.yml` (edit)
      *Rollback:* restore `docker-compose.yml.bak-qwen-only`

### Part C — verification

- [x] **5. Verify config + compose** — `docker compose config -q` passes; `config.json` is
      valid JSON with only `qwen`; extension transpiles via `bun build --external "*"`
      *Dependencies:* steps 3–4
      *Files:* none (verify)
      *Rollback:* n/a

- [~] **6. Extension loads in pi** — transpile verified; live `/reload` left to user
      (colony/qwen currently down, so an LLM-driven test can't run headless)
      *Dependencies:* step 1
      *Files:* none (verify)
      *Rollback:* n/a

- [ ] **7. Live cycle (optional, at your convenience)** — `colony_control start` →
      wait for qwen READY → `GET /v3/models` shows only qwen → `status`; then
      `stop`/`unload` back to current state. Container restart is required for the config
      change to apply (config is volume-mounted `:ro`, read at startup).
      *Dependencies:* steps 5–6
      *Files:* none (verify)
      *Rollback:* n/a

## Decision point

**bge + searxng-rag:** dropping bge models breaks the RAG proxy's embedding/rerank.
Options:

1. **Proceed qwen-only** (as requested) — RAG search degrades to non-reranked web search;
   re-enable later by restoring `config.json.bak`.
2. Keep bge served — contradicts the request; not planned.
Default is option 1. Rollback is one command either way.

## Risks

- Container restart (step 7) takes 2–5 min for qwen to load; pi model calls fail during that window.
- Healthcheck change (step 4) is mandatory — forgetting it causes restart loops.
- Extension PATH: use absolute `${HOME}/.local/bin/colony`, not bare `colony` (execFile PATH
  resolution can differ from interactive shells).

## Post-approval update (user request)

- `colony.ts` now also owns **`generate_text`** (was in `rag_researcher.ts`) with **auto-start**:
  `ensureColonyRunning()` checks `/v3/models` → runs `colony --start` if down → polls up to
  ~6 min for qwen READY (abort-aware) → then sends the chat completion.
- `generate_text` removed from `rag_researcher.ts` (3 RAG tools remain). Required because
  pi's `getAllRegisteredTools()` is **first-registration-per-name-wins** — a duplicate would
  be silently dropped based on load order.
- Fixes applied to the proposed code: `--` flag prefixes (`--start`/`--stop`/`--unload`/`--down`;
  the draft had bare `start`/`stop`), no `status` flag on the colony script → status uses
  `docker compose ps` + `/v3/models`, `execute(..., signal)` is positional (draft destructured
  it → undefined), `max_tokens`/`temperature` `??` fallbacks, accurate model description
  (Qwen3.8 27B-int4, not the stale Qwen 3.6).
- Verified: both files transpile via `bun build --external "*"`; `generate_text` defined +
  registered exactly once; pi-lens diagnostics: 0 errors (style warnings only, consistent
  with the existing extension).

## Update (user follow-up)

- **RAG extension disabled**: `rag_researcher.ts` → `rag_researcher.ts.disabled` (loader only
  picks up `*.ts`/`*.js`; recoverable by renaming back).
- **Boot autostart reverted**: systemd `colony.service` disabled + removed from
  `~/.config/systemd/user/`; source file in `~/Documents/colony/systemd/` restored to original.
- **Autostart moved to pi-level** in `colony.ts`:
  - `session_start` → non-blocking colony start if down (loads while you type).
  - `before_agent_start` → blocks until qwen READY before the first prompt's model call
    (the exact point where pi showed connection errors); warm sessions return instantly.
  - `/colony-start` command → start + wait for qwen READY.
  - `ensureColonyRunningDeduped()` — shared in-flight promise so hooks/commands never race.
- **Bug fixed**: this OVMS build's `/v3/models` omits model `status`; `ovmsServables()` now
  merges native `/v1/config` state (AVAILABLE → READY). Without this the readiness gate
  would have blocked ~6 min on every prompt. Verified live: sees `qwen: READY`.
- Colony started now; qwen healthy; connection error resolved. `/reload` to pick up changes.
