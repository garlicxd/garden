import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { BorderedLoader, getSettingsListTheme } from "@earendil-works/pi-coding-agent";
import {
  Container,
  type SelectItem,
  SelectList,
  type SettingItem,
  SettingsList,
  Text,
  Spacer,
} from "@earendil-works/pi-tui";
import { Type } from "typebox";
import * as path from "node:path";
import { scanModels } from "./scanner";
import { getTeamGrayInfo, bytesToGB } from "./memcheck";
import { startServer, stopServer, killAll, startTeam, formatSize } from "./process";
import { renderWidget } from "./widget";
import type { ModelConfig, ServerState, TeamPreset } from "./types";
import teamsConfig from "./teams.json";

// ─── State ────────────────────────────────────────────────

let configs: ModelConfig[] = [];
let servers = new Map<string, ServerState>();
let activeTeam: string | null = null;

interface PersistedState {
  activeTeam: string | null;
  activeModelIds: string[];
}

// ─── Helpers ──────────────────────────────────────────────

function persistState(pi: ExtensionAPI) {
  pi.appendEntry<PersistedState>("llama-models-state", {
    activeTeam,
    activeModelIds: Array.from(servers.keys()),
  });
}

function getActiveSizes(): number[] {
  return Array.from(servers.values()).map((s) => s.ramUsedBytes);
}

function fullModelName(cfg: ModelConfig): string {
  return `${cfg.name}   (${formatSize(cfg.ggufSizeBytes)})`;
}

// ─── Provider Registration ────────────────────────────────

function registerProviders(pi: ExtensionAPI) {
  for (const cfg of configs) {
    pi.registerProvider(`llama-${cfg.id}`, {
      baseUrl: `http://localhost:${cfg.port}/v1`,
      api: "openai-completions",
      apiKey: "llamacpp",
      compat: {
        supportsDeveloperRole: false,
        supportsReasoningEffort: false,
        supportsUsageInStreaming: false,
      },
      models: [
        {
          id: cfg.id,
          name: cfg.name,
          reasoning: cfg.reasoning,
          input: ["text"] as const,
          contextWindow: cfg.contextWindow,
          maxTokens: cfg.maxTokens,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          compat: cfg.compat,
        },
      ],
    });
  }
}

// ─── State Restore ────────────────────────────────────────

function restoreState(ctx: ExtensionContext) {
  const branchEntries = ctx.sessionManager.getBranch();
  let saved: PersistedState | undefined;

  for (const entry of branchEntries) {
    if (entry.type === "custom" && entry.customType === "llama-models-state") {
      saved = entry.data as PersistedState | undefined;
    }
  }

  // Kill any leftover (shouldn't happen, but safety)
  servers.clear();
  activeTeam = null;

  if (saved?.activeTeam) {
    applyTeam(saved.activeTeam, ctx);
  } else if (saved?.activeModelIds?.length) {
    for (const modelId of saved.activeModelIds) {
      const cfg = configs.find((c) => c.id === modelId);
      if (!cfg) continue;
      const result = startServer(cfg, getActiveSizes());
      if (result.ok) {
        servers.set(cfg.id, result.state);
      }
    }
    activeTeam = null;
  }
}

// ─── Team Application ─────────────────────────────────────

async function applyTeam(teamId: string, _ctx?: ExtensionContext) {
  const preset = teamsConfig.presets.find((t) => t.id === teamId);
  if (!preset) return;

  // Kill all first
  await killAll(servers);

  // Start team
  const result = await startTeam(preset, configs, servers);
  activeTeam = teamId;

  return result;
}

async function switchToMainModel(preset: TeamPreset, ctx: ExtensionContext, pi: ExtensionAPI) {
  const queenId = preset.members[0];
  if (!queenId) return;

  const mainCfg = configs.find((c) => c.id === queenId);
  if (!mainCfg) return;

  const targetFull = `llama-${mainCfg.id}/${mainCfg.id}`;
  const current = ctx.model;
  if (current && `${current.provider}/${current.id}` === targetFull) {
    return; // already selected, nothing to do
  }

  // Queue a model switch. /model <provider>/<id> is handled as an internal command,
  // so it switches the model without triggering an agent turn.
  pi.sendUserMessage(`/model ${targetFull}`);
}

// ─── Widget Setup ─────────────────────────────────────────

function setupWidget(pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.setWidget("llama-models", (_tui, theme) => ({
      render: () => renderWidget(configs, servers, activeTeam, theme),
      invalidate: () => {},
    }));
  });
}

// ─── Entry Point ──────────────────────────────────────────

export default async function (pi: ExtensionAPI) {
  // Discover models
  configs = scanModels(8081);
  console.log(
    `[llama-models] Found ${configs.length} models:`,
    configs.map((c) => `${c.id} :${c.port} (${formatSize(c.ggufSizeBytes)})`),
  );

  // Register providers for all models
  registerProviders(pi);
  console.log("[llama-models] Providers registered for all models");

  // Set up widget
  setupWidget(pi);

  // Restore state on session start
  pi.on("session_start", async (_event, ctx) => {
    restoreState(ctx);
    if (servers.size > 0) {
      ctx.ui.notify(
        `Restored: ${servers.size} model${servers.size !== 1 ? "s" : ""} running` +
          (activeTeam ? ` (team: ${activeTeam})` : ""),
        "info",
      );
    } else if (activeTeam) {
      // Team was set but no servers - apply it now
      const preset = teamsConfig.presets.find((t) => t.id === activeTeam);
      if (preset) {
        const result = await startTeam(preset, configs, servers);
        ctx.ui.notify(
          `Team "${activeTeam}": ${result.started.length}/${result.started.length + result.failed.length} started`,
          result.failed.length > 0 ? "warning" : "info",
        );
      } else {
        activeTeam = null;
      }
      persistState(pi);
    }
  });

  // Navigate session tree — refresh widget
  pi.on("session_tree", async (_event, ctx) => {
    restoreState(ctx);
    persistState(pi);
  });

  // Clean up on shutdown
  pi.on("session_shutdown", async () => {
    console.log("[llama-models] Shutting down all servers...");
    await killAll(servers);
    activeTeam = null;
  });

  // ─── /models command: individual model toggle ────────────

  pi.registerCommand("models", {
    description: "Toggle individual models on/off",
    handler: async (_args, ctx) => {
      if (ctx.mode !== "tui") {
        ctx.ui.notify("/models requires TUI mode", "error");
        return;
      }

      await ctx.ui.custom((tui, theme, _kb, done) => {
        const items: SettingItem[] = configs.map((cfg) => {
          const isRunning = servers.has(cfg.id);
          const sizeStr = formatSize(cfg.ggufSizeBytes);
          return {
            id: cfg.id,
            label: `${cfg.name}  (${sizeStr})`,
            currentValue: isRunning ? "running" : "stopped",
            values: ["running", "stopped"],
          };
        });

        const container = new Container();
        container.addChild(
          new Text(theme.fg("accent", theme.bold("Model Configuration")), 1, 0),
        );
        container.addChild(new Text("", 0, 0)); // spacer

        const settingsList = new SettingsList(
          items,
          Math.min(items.length + 3, 15),
          getSettingsListTheme(),
          (id, newValue) => {
            const cfg = configs.find((c) => c.id === id);
            if (!cfg) return;

            if (newValue === "running") {
              // Try to start
              const result = startServer(cfg, getActiveSizes());
              if (result.ok) {
                servers.set(id, result.state);
                activeTeam = null; // individual toggle clears team
                persistState(pi);
              } else {
                ctx.ui.notify(`${cfg.name}: ${result.reason}`, "error");
              }
            } else {
              // Stop
              const state = servers.get(id);
              if (state) {
                stopServer(state).then(() => {
                  servers.delete(id);
                  activeTeam = null;
                  persistState(pi);
                });
              }
            }
          },
          () => done(undefined),
          { enableSearch: false },
        );

        container.addChild(settingsList);
        container.addChild(new Spacer(1));
        container.addChild(
          new Text(theme.fg("dim", "←→ toggle  •  esc close"), 1, 0),
        );

        return {
          render: (w: number) => container.render(w),
          invalidate: () => container.invalidate(),
          handleInput: (data: string) => {
            settingsList.handleInput?.(data);
            tui.requestRender();
          },
        };
      });
    },
  });

  // ─── /team command: preset teams ─────────────────────────

  pi.registerCommand("team", {
    description: "Select a preset team of models",
    handler: async (_args, ctx) => {
      if (ctx.mode !== "tui") {
        ctx.ui.notify("/team requires TUI mode", "error");
        return;
      }

      // Step 1: show team picker, get selected team
      const teamId = await new Promise<string | null>((resolve) => {
        ctx.ui.custom((tui, theme, _kb, done) => {
          const activeSizes = getActiveSizes();

          const selectableItems: SelectItem[] = [];
          const greyedLines: string[] = [];

          for (const preset of teamsConfig.presets) {
            const grayInfo = getTeamGrayInfo(preset, configs, activeSizes);
            if (grayInfo) {
              greyedLines.push(
                theme.fg("dim", `${preset.name}  —  ${grayInfo.reason}`),
              );
            } else {
              selectableItems.push({
                value: preset.id,
                label: preset.name,
                description: preset.description,
              });
            }
          }

          let selectList: SelectList | null = null;

          const container = new Container();
          container.addChild(
            new Text(theme.fg("accent", theme.bold("Select Team")), 1, 0),
          );
          container.addChild(new Text("", 0, 0));

          if (selectableItems.length === 0) {
            container.addChild(
              new Text(theme.fg("dim", "  No teams fit in current RAM."), 2, 0),
            );
          } else {
            selectList = new SelectList(selectableItems, Math.min(selectableItems.length + 2, 12), {
              selectedPrefix: (t: string) => theme.fg("accent", t),
              selectedText: (t: string) => theme.fg("accent", t),
              description: (t: string) => theme.fg("muted", t),
              scrollInfo: (t: string) => theme.fg("dim", t),
              noMatch: (t: string) => theme.fg("warning", t),
            });

            selectList.onSelect = (value) => { done(undefined); resolve(value); };
            selectList.onCancel = () => { done(undefined); resolve(null); };
            container.addChild(selectList);
          }

          container.addChild(new Spacer(1));

          if (greyedLines.length > 0) {
            container.addChild(
              new Text(theme.fg("dim", theme.bold("Greyed (won't fit even after unloading):")), 1, 0),
            );
            for (const line of greyedLines) {
              container.addChild(new Text(line, 3, 0));
            }
          }

          container.addChild(new Spacer(1));
          container.addChild(
            new Text(theme.fg("dim", "enter select  •  esc cancel"), 1, 0),
          );

          return {
            render: (w: number) => container.render(w),
            invalidate: () => container.invalidate(),
            handleInput: (data: string) => {
              selectList?.handleInput?.(data);
              tui.requestRender();
            },
          };
        });
      });

      if (!teamId) return;

      // Step 2: show loader while team starts
      const resultMsg = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
        const loader = new BorderedLoader(tui, theme, `Starting team "${teamId}"...`);
        loader.onAbort = () => done(null);

        applyTeam(teamId).then((result) => {
          persistState(pi);
          if (result) {
            const total = result.started.length + result.failed.length;
            done(
              result.failed.length === 0
                ? `Team "${teamId}" ready — ${total}/${total} started`
                : `Team "${teamId}": ${result.started.length}/${total} started, ${result.failed.length} failed`,
            );
          } else {
            done(null);
          }
        });

        return loader;
      });

      if (resultMsg) {
        ctx.ui.notify(resultMsg, resultMsg.includes("failed") ? "warning" : "info");
      }

      // Step 3: NOW switch model — pi is idle, command handler is about to return
      const preset = teamsConfig.presets.find((t) => t.id === teamId);
      if (preset) switchToMainModel(preset, ctx, pi);
    },
  });

  // ─── Custom tool: manage_models ──────────────────────────

  pi.registerTool({
    name: "manage_models",
    label: "Manage Models",
    description:
      "Check which models are running, start or stop llama.cpp model servers, or switch to a preset team. " +
      "Use this to manage the local model fleet on Intel SYCL GPU.",
    parameters: Type.Object({
      action: Type.Union([
        Type.Literal("status"),
        Type.Literal("start"),
        Type.Literal("stop"),
        Type.Literal("team"),
      ]),
      model_id: Type.Optional(
        Type.String({ description: "Model ID to start/stop (required for start/stop actions)" }),
      ),
      team_id: Type.Optional(
        Type.String({
          description:
            "Team preset ID to switch to (required for team action). Available: " +
            teamsConfig.presets.map((p) => `${p.id} (${p.description})`).join(", "),
        }),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (params.action === "status") {
        const running = Array.from(servers.entries()).map(([id, s]) => {
          const cfg = configs.find((c) => c.id === id);
          return `${cfg?.name ?? id} (${formatSize(s.ramUsedBytes)}) on port ${s.port}`;
        });

        const availGb = bytesToGB(getActiveSizes().reduce((a, b) => a + b, 0));

        return {
          content: [
            {
              type: "text",
              text:
                running.length === 0
                  ? "No models are currently running. Use /models or /team to start some."
                  : `Running models (${running.length}):\n${running.map((r) => `  - ${r}`).join("\n")}` +
                    (activeTeam ? `\nActive team: ${activeTeam}` : ""),
            },
          ],
          details: { running: running.length, activeTeam },
        };
      }

      if (params.action === "start" || params.action === "stop") {
        if (!params.model_id) {
          return {
            content: [
              {
                type: "text",
                text: "model_id is required for start/stop actions.",
              },
            ],
            details: {},
          };
        }

        const cfg = configs.find((c) => c.id === params.model_id);
        if (!cfg) {
          return {
            content: [
              {
                type: "text",
                text: `Unknown model: ${params.model_id}. Available: ${configs.map((c) => c.id).join(", ")}`,
              },
            ],
            details: {},
          };
        }

        if (params.action === "start") {
          if (servers.has(cfg.id)) {
            return {
              content: [
                {
                  type: "text",
                  text: `${cfg.name} is already running on port ${cfg.port}.`,
                },
              ],
              details: {},
            };
          }

          const result = startServer(cfg, getActiveSizes());
          if (!result.ok) {
            return {
              content: [{ type: "text", text: `Cannot start ${cfg.name}: ${result.reason}` }],
              details: { error: result.reason },
              isError: true,
            };
          }

          servers.set(cfg.id, result.state);
          activeTeam = null;
          persistState(pi);
          return {
            content: [
              {
                type: "text",
                text: `Started ${cfg.name} on port ${cfg.port} (${formatSize(cfg.ggufSizeBytes)}).`,
              },
            ],
            details: { model: cfg.id, port: cfg.port },
          };
        }

        // Stop
        const state = servers.get(cfg.id);
        if (!state) {
          return {
            content: [
              {
                type: "text",
                text: `${cfg.name} is not running.`,
              },
            ],
            details: {},
          };
        }

        await stopServer(state);
        servers.delete(cfg.id);
        activeTeam = null;
        persistState(pi);
        return {
          content: [
            {
              type: "text",
              text: `Stopped ${cfg.name} (freed ${formatSize(cfg.ggufSizeBytes)}).`,
            },
          ],
          details: { model: cfg.id },
        };
      }

      // Team action
      if (params.action === "team") {
        if (!params.team_id) {
          return {
            content: [
              {
                type: "text",
                text:
                  "team_id is required for team action. Available teams: " +
                  teamsConfig.presets.map((p) => `"${p.id}" (${p.description})`).join(", "),
              },
            ],
            details: {},
          };
        }

        const preset = teamsConfig.presets.find((p) => p.id === params.team_id);
        if (!preset) {
          return {
            content: [
              {
                type: "text",
                text:
                  `Unknown team: ${params.team_id}. Available: ` +
                  teamsConfig.presets.map((p) => p.id).join(", "),
              },
            ],
            details: {},
          };
        }

        // Check if it fits
        const grayInfo = getTeamGrayInfo(preset, configs, getActiveSizes());
        if (grayInfo) {
          return {
            content: [
              {
                type: "text",
                text: `Team "${preset.name}" won't fit in RAM: ${grayInfo.reason}`,
              },
            ],
            details: { error: grayInfo.reason },
            isError: true,
          };
        }

        const result = await applyTeam(params.team_id);
        persistState(pi);
        switchToMainModel(preset, ctx, pi);

        if (result) {
          const total = result.started.length + result.failed.length;
          const text =
            result.failed.length === 0
              ? `Team "${preset.name}" ready — ${total}/${total} started.`
              : `Team "${preset.name}": ${result.started.length}/${total} started. Failures: ${result.failed.map((f) => `${f.modelId} (${f.reason})`).join(", ")}`;

          return {
            content: [{ type: "text", text }],
            details: { ...result, team: params.team_id },
            isError: result.failed.length > 0,
          };
        }

        return {
          content: [
            { type: "text", text: `Team "${preset.name}" could not be applied.` },
          ],
          details: {},
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: `Unknown action: ${params.action}` }],
        details: {},
        isError: true,
      };
    },
  });

  // ─── Custom tool: set_model_team ─────────────────────────

  pi.registerTool({
    name: "set_model_team",
    label: "Set Model Team",
    description:
      "Switch to a preset team of models (kills all running models first). " +
      "Available teams: " +
      teamsConfig.presets.map((p) => `${p.id} (${p.description})`).join(", "),
    parameters: Type.Object({
      team_id: Type.String({
        description: "Team preset ID. One of: " + teamsConfig.presets.map((p) => p.id).join(", "),
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const preset = teamsConfig.presets.find((p) => p.id === params.team_id);
      if (!preset) {
        return {
          content: [
            {
              type: "text",
              text:
                `Unknown team: ${params.team_id}. Available: ` +
                teamsConfig.presets.map((p) => p.id).join(", "),
            },
          ],
          details: {},
          isError: true,
        };
      }

      const grayInfo = getTeamGrayInfo(preset, configs, getActiveSizes());
      if (grayInfo) {
        return {
          content: [
            {
              type: "text",
              text: `Team "${preset.name}" won't fit in RAM: ${grayInfo.reason}`,
            },
          ],
          details: { error: grayInfo.reason },
          isError: true,
        };
      }

      const result = await applyTeam(params.team_id);
      persistState(pi);
      switchToMainModel(preset, ctx, pi);

      if (result) {
        const total = result.started.length + result.failed.length;
        const text =
          result.failed.length === 0
            ? `Team "${preset.name}" ready — ${total}/${total} started.`
            : `Team "${preset.name}": ${result.started.length}/${total} started. Failures: ${result.failed.map((f) => `${f.modelId} (${f.reason})`).join(", ")}`;

        return {
          content: [{ type: "text", text }],
          details: { ...result, team: params.team_id },
          isError: result.failed.length > 0,
        };
      }

      return {
        content: [
          { type: "text", text: `Team "${preset.name}" could not be applied.` },
        ],
        details: {},
        isError: true,
      };
    },
  });

  console.log("[llama-models] Extension loaded. /models and /team commands available.");
}
