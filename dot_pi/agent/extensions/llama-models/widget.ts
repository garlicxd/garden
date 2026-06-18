import type { ModelConfig, ServerState } from "./types";
import { getAvailableRAM, bytesToGB } from "./memcheck";

export function renderWidget(
  configs: ModelConfig[],
  servers: Map<string, ServerState>,
  activeTeamName: string | null,
  theme: { fg: (kind: string, text: string) => string },
): string[] {
  const lines: string[] = [];
  const availableBytes = getAvailableRAM();
  const activeBytes = Array.from(servers.values()).reduce((a, s) => a + s.ramUsedBytes, 0);
  // MemAvailable is the true free number — accounts for kernel + all process usage
  const freeGB = bytesToGB(availableBytes);

  // Active team
  if (activeTeamName) {
    lines.push(theme.fg("accent", "Team: " + activeTeamName));
  }

  // Per-model status
  for (const config of configs) {
    const state = servers.get(config.id);
    if (state) {
      const sizeStr = formatSize(config.ggufSizeBytes);
      lines.push(
        theme.fg("success", "█ ") +
          theme.fg("accent", config.name) +
          theme.fg("dim", "  :" + state.port + "  " + sizeStr),
      );
    }
  }

  if (servers.size === 0) {
    lines.push(theme.fg("dim", "No models active. Use /models or /team to start."));
  }

  // Free RAM summary
  const freeColored =
    freeGB > 16 ? theme.fg("success", freeGB.toFixed(1)) :
    freeGB > 5 ? theme.fg("warning", freeGB.toFixed(1)) :
    theme.fg("error", freeGB.toFixed(1));

  const activeGB = bytesToGB(activeBytes).toFixed(1);
  const plural = servers.size !== 1 ? "s" : "";
  const summaryLine =
    theme.fg("dim", "Free: ") +
    freeColored +
    theme.fg("dim", " GB") +
    theme.fg("muted", "  |  ") +
    theme.fg("dim", "Active: " + activeGB + " GB (" + servers.size + " model" + plural + ")");

  lines.push("", summaryLine);

  // Running models summary (greyed)
  if (servers.size > 0) {
    const names = Array.from(servers.keys())
      .map(function (id) { return configs.find(function (c) { return c.id === id; })?.name ?? id; })
      .join(", ");
    lines.push(theme.fg("muted", "Running: " + names));
  }

  // Keybindings hint
  lines.push(
    theme.fg("dim", "/models toggle") +
      theme.fg("muted", "  |  ") +
      theme.fg("dim", "/team presets"),
  );

  return lines;
}

function formatSize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return gb.toFixed(1) + " GB";
  return (bytes / (1024 * 1024)).toFixed(0) + " MB";
}
