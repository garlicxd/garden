import * as fs from "node:fs";
import type { GrayInfo, ModelConfig, TeamPreset } from "./types";

const MEMINFO_PATH = "/proc/meminfo";
const OVERHEAD_GB = 4;

function parseMeminfo(): { totalKb: number; availableKb: number } {
  const content = fs.readFileSync(MEMINFO_PATH, "utf-8");
  let totalKb = 0;
  let availableKb = 0;

  for (const line of content.split("\n")) {
    const memMatch = line.match(/^MemTotal:\s+(\d+)\s+kB/);
    if (memMatch) totalKb = parseInt(memMatch[1]!, 10);
    const availMatch = line.match(/^MemAvailable:\s+(\d+)\s+kB/);
    if (availMatch) availableKb = parseInt(availMatch[1]!, 10);
  }

  return { totalKb, availableKb };
}

function bytesToGB(bytes: number): number {
  return bytes / (1024 * 1024 * 1024);
}

export function getAvailableRAM(): number {
  const { availableKb } = parseMeminfo();
  return availableKb * 1024; // bytes
}

export function getTotalRAM(): number {
  const { totalKb } = parseMeminfo();
  return totalKb * 1024; // bytes
}

export function getMemoryStats() {
  const { totalKb, availableKb } = parseMeminfo();
  return {
    totalBytes: totalKb * 1024,
    availableBytes: availableKb * 1024,
  };
}

/**
 * Check if a single model can be started given currently active model sizes.
 */
export function canStart(
  modelSizeBytes: number,
  activeModelSizesBytes: number[],
): { ok: true } | { ok: false; reason: string; freeBytes: number; neededBytes: number } {
  const { availableKb } = parseMeminfo();
  const availableBytes = availableKb * 1024;
  const overheadBytes = OVERHEAD_GB * 1024 * 1024 * 1024;
  const alreadyUsed = activeModelSizesBytes.reduce((a, b) => a + b, 0);

  const usable = availableBytes + alreadyUsed - overheadBytes;
  const needed = modelSizeBytes;

  if (needed <= usable) {
    return { ok: true };
  }

  return {
    ok: false,
    reason: `Needs ${bytesToGB(needed).toFixed(1)} GB, only ${bytesToGB(usable).toFixed(1)} GB available`,
    freeBytes: usable,
    neededBytes: needed,
  };
}

/**
 * Compute grey-out info for a team preset.
 *
 * Team budget = MemTotal - systemUsage - overhead
 * where systemUsage = MemTotal - MemAvailable - sum(activeModelSizes)
 *
 * After killing all active models, the new team has this budget to fit in.
 */
export function getTeamGrayInfo(
  preset: TeamPreset,
  allConfigs: ModelConfig[],
  activeModelSizesBytes: number[],
): GrayInfo | null {
  const { totalKb, availableKb } = parseMeminfo();
  const totalBytes = totalKb * 1024;
  const availableBytes = availableKb * 1024;
  const overheadBytes = OVERHEAD_GB * 1024 * 1024 * 1024;
  const alreadyUsed = activeModelSizesBytes.reduce((a, b) => a + b, 0);

  // systemUsage = everything that is NOT the active models
  const systemUsage = totalBytes - availableBytes - alreadyUsed;
  const teamBudget = totalBytes - systemUsage - overheadBytes;

  // Compute team size
  let teamSize: number;
  if (preset.members.length === 1 && preset.members[0] === "*") {
    teamSize = allConfigs.reduce((a, c) => a + c.ggufSizeBytes, 0);
  } else {
    teamSize = 0;
    for (const memberId of preset.members) {
      const cfg = allConfigs.find((c) => c.id === memberId);
      if (cfg) teamSize += cfg.ggufSizeBytes;
    }
  }

  if (teamSize <= teamBudget) return null; // fits, not greyed

  return {
    reason: `Needs ${bytesToGB(teamSize).toFixed(1)} GB, budget ${bytesToGB(teamBudget).toFixed(1)} GB`,
    totalNeeded: teamSize,
    totalAvailable: teamBudget,
  };
}

export { bytesToGB };
