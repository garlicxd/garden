import { spawn, type ChildProcess } from "node:child_process";
import * as http from "node:http";
import type { ModelConfig, ServerState, TeamPreset } from "./types";
import { canStart, bytesToGB } from "./memcheck";

const LLAMA_SERVER_BIN = "/home/garlic/llama.cpp/build/bin/llama-server";
const ONEAPI_SETVARS = "source /opt/intel/oneapi/setvars.sh --force";

const KILL_TIMEOUT_MS = 5000;
const RAM_STABILIZE_MS = 2000;
const HEALTH_TIMEOUT_MS = 30000;
const HEALTH_RETRY_MS = 500;

function buildServerCommand(config: ModelConfig): string {
  return `${ONEAPI_SETVARS} && ${LLAMA_SERVER_BIN} -m '${config.ggufPath}' --host 127.0.0.1 --port ${config.port} -ngl 99 -c ${config.contextWindow} --flash-attn on`;
}

export function startServer(
  config: ModelConfig,
  activeSizes: number[],
): { ok: true; state: ServerState } | { ok: false; reason: string } {
  // RAM gate
  const check = canStart(config.ggufSizeBytes, activeSizes);
  if (!check.ok) {
    return { ok: false, reason: check.reason };
  }

  const cmd = buildServerCommand(config);

  const proc = spawn("bash", ["-c", cmd], {
    stdio: "pipe",
    detached: false,
  });

  proc.stdout?.on("data", () => {});
  proc.stderr?.on("data", () => {});

  proc.on("error", (err) => {
    console.error(`[llama-models] spawn error for ${config.id}:`, err.message);
  });

  const state: ServerState = {
    process: proc,
    port: config.port,
    modelId: config.id,
    startedAt: Date.now(),
    ramUsedBytes: config.ggufSizeBytes,
  };

  return { ok: true, state };
}

export function stopServer(state: ServerState): Promise<void> {
  return new Promise((resolve) => {
    if (!state.process || state.process.killed) {
      resolve();
      return;
    }

    let resolved = false;

    const onExit = () => {
      if (!resolved) {
        resolved = true;
        state.process = null;
        state.startedAt = null;
        resolve();
      }
    };

    state.process.once("exit", onExit);

    // Send SIGTERM
    state.process.kill("SIGTERM");

    // Fallback: SIGKILL after timeout
    setTimeout(() => {
      if (!resolved && state.process && !state.process.killed) {
        state.process.kill("SIGKILL");
      }
    }, KILL_TIMEOUT_MS);
  });
}

export async function killAll(servers: Map<string, ServerState>): Promise<number> {
  const promises: Promise<void>[] = [];
  for (const [, state] of servers) {
    if (state.process && !state.process.killed) {
      promises.push(stopServer(state));
    }
  }
  await Promise.all(promises);
  servers.clear();
  return promises.length;
}

function healthCheck(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(
      `http://127.0.0.1:${port}/v1/models`,
      { timeout: 2000 },
      (res) => {
        resolve(res.statusCode === 200);
        res.resume();
      },
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForHealthy(port: number): Promise<boolean> {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const ok = await healthCheck(port);
    if (ok) return true;
    await new Promise((r) => setTimeout(r, HEALTH_RETRY_MS));
  }
  return false;
}

export interface TeamStartResult {
  started: string[];
  failed: { modelId: string; reason: string }[];
}

export async function startTeam(
  preset: TeamPreset,
  allConfigs: ModelConfig[],
  activeServers: Map<string, ServerState>,
): Promise<TeamStartResult> {
  const result: TeamStartResult = { started: [], failed: [] };

  // 1. Kill all running servers
  await killAll(activeServers);

  // 2. Wait for RAM to stabilize
  await new Promise((r) => setTimeout(r, RAM_STABILIZE_MS));

  // 3. Resolve members (handle "*")
  let memberIds: string[];
  if (preset.members.length === 1 && preset.members[0] === "*") {
    // Start smallest models first to maximize count
    const sorted = [...allConfigs].sort((a, b) => a.ggufSizeBytes - b.ggufSizeBytes);
    memberIds = sorted.map((c) => c.id);
  } else {
    memberIds = preset.members;
  }

  // 4. Start each model sequentially (RAM-permitting)
  const activeSizes: number[] = [];

  for (const memberId of memberIds) {
    const config = allConfigs.find((c) => c.id === memberId);
    if (!config) {
      result.failed.push({ modelId: memberId, reason: "Unknown model" });
      continue;
    }

    const startResult = startServer(config, activeSizes);
    if (!startResult.ok) {
      result.failed.push({ modelId: memberId, reason: startResult.reason });
      continue;
    }

    // Health check
    const healthy = await waitForHealthy(config.port);
    if (!healthy) {
      await stopServer(startResult.state);
      result.failed.push({ modelId: memberId, reason: "Failed health check (server not responding)" });
      continue;
    }

    activeServers.set(config.id, startResult.state);
    activeSizes.push(config.ggufSizeBytes);
    result.started.push(memberId);
  }

  return result;
}

export function formatSize(bytes: number): string {
  const gb = bytesToGB(bytes);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}
