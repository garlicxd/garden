/**
 * Sudo Password Extension
 *
 * Caches the user's sudo password in memory (never on disk in plain sight),
 * automatically feeds it to sudo commands via SUDO_ASKPASS, keeps the
 * password hidden from the LLM/provider, and re-prompts on wrong passwords.
 *
 * Commands:
 *   /sudo           - prompt to set password (retries up to 3 times on wrong pw)
 *   /sudo <pw>      - set password directly (warning: visible in pi history)
 *   /sudo clear     - clear cached password
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isBashToolResult } from "@earendil-works/pi-coding-agent";
import { writeFile, unlink, readdir, access } from "node:fs/promises";

export default function (pi: ExtensionAPI) {
  // --- State ---
  let cachedPassword: string | null = null;       // verified-good password
  /** Track which toolCallIds originated from sudo commands.
   *  Set-based so parallel tool execution is handled correctly. */
  const sudoCallIds = new Set<string>();
  const pid = process.pid;
  const PASS_FILE = `/tmp/.pi-sudo-pass-${pid}`;
  const ASKPASS_SCRIPT = `/tmp/.pi-sudo-askpass-${pid}.sh`;

  // --- Helpers ---

  /** Write password to temp files only (no caching). */
  async function writePasswordFiles(password: string): Promise<void> {
    await writeFile(PASS_FILE, password, { mode: 0o600 });
    await writeFile(
      ASKPASS_SCRIPT,
      `#!/bin/sh\ncat '${PASS_FILE}'\n`,
      { mode: 0o700 },
    );
  }

  /** Write password files AND mark as verified-cached. */
  async function storePassword(password: string): Promise<void> {
    await writePasswordFiles(password);
    cachedPassword = password;
  }

  /** Run sudo -A -v to verify the password in PASS_FILE is correct.
   *  Uses bash -c for Unix env-var prefix instead of pi.exec's env option
   *  (which is not supported by ExecOptions). Returns true if sudo accepted
   *  the password, false otherwise. */
  async function verifyPassword(): Promise<boolean> {
    try {
      // Invalidate sudo's timestamp first via -K so a previously cached auth
      // doesn't make -v succeed without asking our askpass script.
      const cmd = `SUDO_ASKPASS='${ASKPASS_SCRIPT}' sudo -K; SUDO_ASKPASS='${ASKPASS_SCRIPT}' sudo -A -v`;
      const result = await pi.exec("bash", ["-c", cmd], {
        timeout: 10_000,
      });
      return result.code === 0;
    } catch {
      // If verification itself fails (e.g. sudo not available), assume
      // password is valid rather than blocking the user's command.
      return true;
    }
  }

  /** Prompt for password, verify via sudo -A -v, and retry up to maxAttempts.
   *  Returns the verified password, or null if cancelled / max attempts exhausted. */
  async function promptAndVerify(
    ctx: {
      hasUI: boolean;
      ui: { input: (title: string, placeholder: string) => Promise<string | undefined>; notify: (msg: string, level: "info" | "warning" | "error") => void };
    },
    maxAttempts: number = 3,
  ): Promise<string | null> {
    if (!ctx.hasUI) return null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const title = attempt === 1
        ? "Enter sudo password (stored in memory only for this session):"
        : "Wrong password. Try again:";
      const pw = await ctx.ui.input(title, "");
      if (!pw || pw.length === 0) return null; // cancelled

      await writePasswordFiles(pw);
      const verified = await verifyPassword();
      if (verified) return pw;

      // Wrong password — clean up files for the next attempt
      await unlink(PASS_FILE).catch(() => {});
      await unlink(ASKPASS_SCRIPT).catch(() => {});

      if (attempt < maxAttempts) {
        ctx.ui.notify(
          `Wrong sudo password — attempt ${attempt}/${maxAttempts}.`,
          "error",
        );
      }
    }

    ctx.ui.notify(
      `Wrong sudo password — ${maxAttempts} attempts exhausted.`,
      "error",
    );
    return null;
  }

  /** Check whether a bash command string contains a sudo invocation
   *  that we should intercept.  Skips commands that already use -A / --askpass
   *  (already handled), or -v (validate/refresh), or -k (invalidate),
   *  or -V (version — does not require auth).
   *  Also skips if SUDO_ASKPASS is already present (prevents double-injection). */
  function hasSudo(command: string): boolean {
    if (/SUDO_ASKPASS/.test(command)) return false;
    // Must be followed by whitespace or end-of-string (not hyphen/underscore like sudo-password)
    // Exclude sudo -V (version, no auth), -v (validate), -k (invalidate), -A (askpass).
    return /\bsudo\b(?=\s|$)(?!\s+-[AvVk]|\s+--askpass)/.test(command);
  }

  /** Replace all `sudo` tokens with an askpass-prefixed `sudo -A` (handles compound commands). */
  function injectAskpass(command: string): string {
    return command.replace(
      /\bsudo\b/g,
      `SUDO_ASKPASS='${ASKPASS_SCRIPT}' sudo -A`,
    );
  }

  /** Strip askpass-related paths from text so the LLM never sees them. */
  function redact(text: string): string {
    return text
      .split(ASKPASS_SCRIPT).join("[sudo-askpass]")
      .split(PASS_FILE).join("[sudo-pass]");
  }

  /** Heuristic: does the output text indicate sudo rejected the password? */
  function isWrongPassword(outputText: string): boolean {
    return /incorrect password|authentication failure|3 incorrect password|Sorry, try again/i.test(outputText);
  }

  /** Determine sudo status from bash output and exit code. */
  function getSudoStatus(outputText: string, isError: boolean): "success" | "wrong-password" | "failed" {
    if (isWrongPassword(outputText)) return "wrong-password";
    if (isError) return "failed";
    return "success";
  }

  /** Remove helper files and clear all password state. */
  async function cleanup(): Promise<void> {
    await unlink(PASS_FILE).catch(() => {});
    await unlink(ASKPASS_SCRIPT).catch(() => {});
    cachedPassword = null;
  }

  // --- Session lifecycle ---

  /** Clean up orphaned temp files from previous pi sessions that
   *  terminated without running session_shutdown cleanup. */
  async function cleanupOrphanedFiles(): Promise<void> {
    try {
      const entries = await readdir("/tmp");
      for (const name of entries) {
        if (!name.startsWith(".pi-sudo-")) continue;
        const match = name.match(/-(\d+)/);
        if (!match) continue;
        const filePid = parseInt(match[1], 10);
        if (filePid === pid) continue;
        try {
          process.kill(filePid, 0);
        } catch {
          // Process no longer exists — safe to clean up
          await unlink(`/tmp/${name}`).catch(() => {});
        }
      }
    } catch {
      // Best-effort; ignore readdir failures
    }
  }

  pi.on("session_start", async () => {
    await cleanupOrphanedFiles();
    // Re-create helper files if we already have a password cached
    // (e.g. after a /reload).
    if (cachedPassword) await storePassword(cachedPassword);
  });

  pi.on("session_shutdown", async () => {
    await cleanup();
  });

  // --- tool_call: block reads to password files + detect & inject sudo ---

  pi.on("tool_call", async (event, ctx) => {
    const input = event.input as Record<string, unknown>;

    // Block read tool from accessing our password / askpass files
    if (event.toolName === "read") {
      const path = input.path as string;
      if (path.includes(PASS_FILE) || path.includes(ASKPASS_SCRIPT)) {
        return { block: true, reason: "Access to sudo password helper is restricted" };
      }
    }

    // Detect sudo in bash commands and inject askpass
    if (event.toolName === "bash") {
      const command = input.command as string;
      if (hasSudo(command)) {
        sudoCallIds.add(event.toolCallId);

        if (!cachedPassword) {
          // No verified password — prompt and verify with retry loop.
          const pw = await promptAndVerify(ctx, 3);
          if (!pw) {
            return {
              block: true,
              reason:
                "No valid sudo password provided (required for sudo commands). Use /sudo to set one.",
            };
          }
          cachedPassword = pw;
          ctx.ui.notify(
            "Sudo password verified \u2713 \u2014 cached for this session.",
            "info",
          );
        } else {
          // Verified password cached — ensure files exist, then re-verify.
          // Always re-verify so stale/expired passwords are caught early
          // rather than relying on output heuristics in tool_result.
          let filesOk = true;
          try {
            await access(PASS_FILE);
            await access(ASKPASS_SCRIPT);
          } catch {
            await writePasswordFiles(cachedPassword);
            filesOk = false; // Files were missing — force re-verify
          }

          if (filesOk) {
            // Files exist — re-verify in case the password changed externally
            const verified = await verifyPassword();
            if (!verified) {
              // Cached password is no longer valid — prompt for a new one
              await cleanup();
              ctx.ui.notify(
                "Cached sudo password expired or incorrect — re-prompting.",
                "warning",
              );
              const pw = await promptAndVerify(ctx, 3);
              if (!pw) {
                return {
                  block: true,
                  reason:
                    "No valid sudo password provided. Cached password was invalid; use /sudo to reset.",
                };
              }
              cachedPassword = pw;
              ctx.ui.notify(
                "Sudo password verified \u2713 \u2014 cached for this session.",
                "info",
              );
            }
          } else {
            // Files were missing — re-verify after regenerating
            const verified = await verifyPassword();
            if (!verified) {
              await cleanup();
              ctx.ui.notify(
                "Cached sudo password is no longer valid \u2014 will re-prompt on next sudo.",
                "error",
              );
            }
          }
        }

        // Mutate the command in place — this is what gets executed
        input.command = injectAskpass(command);
      }
    }

    return undefined;
  });

  // --- tool_result: detect wrong password, inject sudo status ---

  pi.on("tool_result", async (event, ctx) => {
    if (!isBashToolResult(event)) return undefined;

    // Redact askpass paths from the result so the LLM never sees them
    const newContent = event.content.map((block) =>
      block.type === "text" ? { ...block, text: redact(block.text) } : block,
    );

    const wasSudo = sudoCallIds.has(event.toolCallId);
    sudoCallIds.delete(event.toolCallId);
    if (!wasSudo) return { content: newContent };

    // Collect all text from content blocks for password heuristics
    const allText = newContent
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    const status = getSudoStatus(allText, event.isError);

    // Password is verified synchronously in tool_call via sudo -A -v,
    // so wrong-password here means something went wrong (e.g. askpass
    // race, permissions). Clear cache and notify.
    if (status === "wrong-password") {
      await cleanup();
      ctx.ui.notify(
        "Wrong sudo password — cache cleared. Use /sudo to retry, or run another sudo command to re-prompt.",
        "error",
      );
    }

    // Inject status block into content so the LLM knows the outcome.
    const statusMessages: Record<string, string> = {
      "success": "[sudo] Password accepted (cached).",
      "wrong-password":
        "[sudo] Wrong password \u2717 \u2014 cache cleared. The user must re-enter their password (/sudo or run a sudo command to prompt).",
      "failed":
        "[sudo] Password accepted but command failed (non-password error \u2014 check stderr above).",
    };
    newContent.push({ type: "text", text: statusMessages[status] });

    // Cache-state line so the agent knows whether next sudo will auto-inject
    const cacheState = cachedPassword
      ? "active (next sudo will auto-inject)"
      : "empty (next sudo will prompt)";
    newContent.push({ type: "text", text: `[sudo] Cache: ${cacheState}` });

    return { content: newContent };
  });

  // --- context: redact askpass from historical messages sent to LLM ---

  pi.on("context", async (event) => {
    for (const msg of event.messages) {
      if (!msg || typeof msg !== "object") continue;

      // Handle both top-level and nested message shapes (but not both)
      const hasNested = !!(msg as any).message;
      const content: any[] = hasNested
        ? ((msg as any).message.content ?? [])
        : ((msg as any).content ?? []);

      for (const block of content) {
        // Redact from tool-call arguments
        if (
          block?.type === "toolCall" &&
          block?.name === "bash" &&
          typeof block?.arguments?.command === "string"
        ) {
          block.arguments.command = redact(block.arguments.command);
        }

        // Redact from text content blocks (tool results, assistant text)
        if (block?.type === "text" && typeof block?.text === "string") {
          block.text = redact(block.text);
        }
      }
    }

    return { messages: event.messages };
  });

  // --- /sudo command ---

  pi.registerCommand("sudo", {
    description: "Set or clear the cached sudo password",
    handler: async (args, ctx) => {
      if (args === "clear") {
        await cleanup();
        ctx.ui.notify("Sudo password cache cleared.", "info");
        return;
      }

      if (args) {
        // Verify before caching
        await writePasswordFiles(args);
        const verified = await verifyPassword();
        if (!verified) {
          await cleanup();
          ctx.ui.notify(
            "Wrong sudo password — not cached. Try /sudo (no args) for interactive retry.",
            "error",
          );
          return;
        }
        cachedPassword = args;
        ctx.ui.notify("Sudo password cached for this session.", "info");
        return;
      }

      if (cachedPassword) {
        ctx.ui.notify(
          "Sudo password is already cached \u2713  Use /sudo clear to remove.",
          "info",
        );
        return;
      }

      // Interactive — prompt and verify with retry loop
      const pw = await promptAndVerify(ctx, 3);
      if (pw) {
        cachedPassword = pw;
        ctx.ui.notify("Sudo password cached for this session.", "info");
      } else {
        ctx.ui.notify("Password not set.", "warning");
      }
    },
  });
}
