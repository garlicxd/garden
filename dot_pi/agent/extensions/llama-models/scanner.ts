import * as fs from "node:fs";
import * as path from "node:path";
import type { ModelConfig } from "./types";

const MODELS_DIR = "/home/garlic/models";

const MODEL_METADATA: Record<string, Omit<ModelConfig, "ggufPath" | "ggufSizeBytes" | "port">> = {
  "qwen2.5-coder-1.5b": {
    id: "qwen2.5-coder-1.5b",
    name: "Qwen 2.5 Coder 1.5B (SYCL)",
    reasoning: false,
    contextWindow: 32768,
    maxTokens: 4096,
  },
  "gemma4-12b": {
    id: "gemma4-12b",
    name: "Gemma 4 12B (SYCL)",
    reasoning: false,
    contextWindow: 256000,
    maxTokens: 8192,
  },
  "deepseek-r1-32b-qwen-distill-q4_K_M": {
    id: "deepseek-r1-32b-qwen-distill-q4_K_M",
    name: "DeepSeek R1 32B — Auditor (SYCL)",
    reasoning: true,
    contextWindow: 131072,
    maxTokens: 8192,
    compat: {
      thinkingFormat: "deepseek",
      requiresThinkingAsText: true,
    },
  },
  "qwen3.6-27b-q4_K_M": {
    id: "qwen3.6-27b-q4_K_M",
    name: "Qwen3.6 27B — Precision Engineer (SYCL)",
    reasoning: true,
    contextWindow: 256000,
    maxTokens: 8192,
    compat: {
      thinkingFormat: "qwen-chat-template",
    },
  },
  "Qwen3.6-35B-A3B-bartowski-Q4_K_M": {
    id: "Qwen3.6-35B-A3B-bartowski-Q4_K_M",
    name: "Qwen3.6 35B-A3B — Orchestrator (SYCL)",
    reasoning: false,
    contextWindow: 256000,
    maxTokens: 8192,
  },
};

function modelKeyFromFilename(filename: string): string {
  // Strip .gguf extension
  const base = filename.replace(/\.gguf$/, "");
  // Known: return the metadata key
  if (MODEL_METADATA[base]) return base;
  // Unknown: use basename without extension as the ID
  return base;
}

export function scanModels(startPort: number): ModelConfig[] {
  if (!fs.existsSync(MODELS_DIR)) return [];

  const files = fs.readdirSync(MODELS_DIR).filter(
    (f) => f.endsWith(".gguf") && !f.endsWith(".bak")
  );

  const configs: ModelConfig[] = [];
  let port = startPort;

  for (const file of files) {
    const key = modelKeyFromFilename(file);
    const fullPath = path.join(MODELS_DIR, file);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(fullPath);
    } catch {
      continue; // skip unreadable files
    }

    const metadata = MODEL_METADATA[key] ?? {
      id: key,
      name: key,
      reasoning: false,
      contextWindow: 32768,
      maxTokens: 4096,
    };

    configs.push({
      ...metadata,
      ggufPath: fullPath,
      ggufSizeBytes: stat.size,
      port: port++,
    });
  }

  return configs;
}
