import type { ChildProcess } from "node:child_process";

export interface ModelConfig {
  id: string;
  name: string;
  ggufPath: string;
  ggufSizeBytes: number;
  port: number;
  contextWindow: number;
  maxTokens: number;
  reasoning: boolean;
  compat?: {
    thinkingFormat?: string;
    requiresThinkingAsText?: boolean;
  };
}

export interface ServerState {
  process: ChildProcess | null;
  port: number;
  modelId: string;
  startedAt: number | null;
  ramUsedBytes: number;
}

export interface TeamPreset {
  id: string;
  name: string;
  description: string;
  members: string[];
  /** Auto-selected model when this team activates — first element of members. Order matters. */
  default: boolean;
}

export interface GrayInfo {
  reason: string;
  totalNeeded: number;
  totalAvailable: number;
}
