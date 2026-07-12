/**
 * sudo → pkexec Extension
 *
 * Intercepts shell commands from both the built-in `bash` tool AND the
 * `hypa_shell` tool (from @hypabolic/pi-hypa), transparently replacing any
 * `sudo` or `su -c` invocation with an equivalent `pkexec` call, so the
 * agent never needs a sudo password. Polkit handles privilege escalation
 * via the graphical auth dialog.
 *
 * Handles:
 *   sudo cmd              → pkexec cmd
 *   sudo -u user cmd      → pkexec --user user cmd
 *   sudo -n cmd           → pkexec --disable-internal-agent cmd
 *   sudo -E cmd           → pkexec cmd              (env stripped — minimal env)
 *   sudo -H cmd           → pkexec cmd              (pkexec already sets HOME)
 *   sudo -i / -s / -b     → pkexec cmd              (dropped — no pkexec equivalent)
 *   sudo -u user -n cmd   → pkexec --user user --disable-internal-agent cmd
 *   su -c 'cmd'           → pkexec /bin/sh -c 'cmd'
 *   su user -c 'cmd'      → pkexec --user user /bin/sh -c 'cmd'
 *
 * Uses createBashTool with a spawnHook for the `bash` tool, plus a
 * tool_call event listener for `hypa_shell` (the hypa extension disables
 * the built-in bash tool in replace mode).
 */

import {
	createBashTool,
	type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";

// ─── Tokenizer helpers ───────────────────────────────────────────────────────

/** Shell metacharacters that terminate a sudo/su argument list at the top level. */
const SHELL_SEPARATORS = new Set(["|", "&", ";", "(", ")", ">", "<", "\n"]);

/** Check if `str` at `pos` starts with a shell command substitution `$(…)`. */
function looksLikeCmdSubst(str: string, pos: number): boolean {
	return str.startsWith("$(", pos);
}

/**
 * Read the next shell token from `text` starting at `pos`.
 * Advances `pos` past leading whitespace and the token itself.
 * Returns the token (preserving quotes), or `null` at end or on a shell separator.
 *
 * Handles single quotes, double quotes (with `\` escape), and stops at
 * shell metacharacters only at the top level (not inside quotes).
 */
function nextToken(text: string, pos: { value: number }): string | null {
	// Skip whitespace
	while (pos.value < text.length && /\s/.test(text[pos.value])) {
		pos.value++;
	}
	if (pos.value >= text.length) return null;

	// Stop at shell separators (top level)
	if (SHELL_SEPARATORS.has(text[pos.value])) return null;
	if (looksLikeCmdSubst(text, pos.value)) return null;

	const start = pos.value;
	while (pos.value < text.length) {
		const c = text[pos.value];

		// Shell metacharacters stop the token (unless quoted)
		if (SHELL_SEPARATORS.has(c)) break;
		if (looksLikeCmdSubst(text, pos.value)) break;
		// Whitespace stops the token
		if (/\s/.test(c)) break;

		if (c === "'") {
			pos.value++; // skip opening quote
			while (pos.value < text.length && text[pos.value] !== "'") {
				pos.value++;
			}
			if (pos.value < text.length) pos.value++; // skip closing quote
			continue;
		}

		if (c === '"') {
			pos.value++; // skip opening quote
			while (pos.value < text.length && text[pos.value] !== '"') {
				if (text[pos.value] === "\\") pos.value++; // skip escaped
				pos.value++;
			}
			if (pos.value < text.length) pos.value++; // skip closing quote
			continue;
		}

		pos.value++;
	}

	return text.slice(start, pos.value);
}

// ─── Sudo flag parser ────────────────────────────────────────────────────────

type FlagResult =
	| { kind: "boolean"; arg: string | null }
	// kind:boolean with null arg means "drop the flag"
	| { kind: "value"; flag: string }
	// kind:value — the next token IS the value; flag is the pkexec flag name
	| { kind: "value_attached"; flag: string; value: string }
	// kind:value_attached — value was attached (--user=foo or -ufoo)
	| { kind: "drop_value" }
	// drop_value — drop this flag AND its next-token value
	| { kind: "unknown" };
// unknown — pass through as-is (best-effort)

/**
 * Parse a single sudo flag token and return how to translate it to pkexec.
 */
function parseSudoFlag(token: string): FlagResult {
	if (token.startsWith("--")) {
		const eq = token.indexOf("=");
		const name = eq >= 0 ? token.slice(2, eq) : token.slice(2);
		const value = eq >= 0 ? token.slice(eq + 1) : null;

		switch (name) {
			case "user":
				if (value) return { kind: "value_attached", flag: "--user", value };
				return { kind: "value", flag: "--user" };
			case "non-interactive":
				return { kind: "boolean", arg: "--disable-internal-agent" };
			case "preserve-env":
			case "preserve-environment":
			case "set-home":
			case "login":
			case "shell":
			case "background":
			case "validate":
			case "reset-timestamp":
			case "list":
			case "help":
			case "version":
				return { kind: "boolean", arg: null };
			case "group":
			case "prompt":
			case "close-from":
			case "other-user":
			case "askpass":
				return value ? { kind: "drop_value" } : { kind: "drop_value" };
			default:
				return { kind: "unknown" };
		}
	}

	// Short flags: starts with single '-'
	const chars = token.slice(1); // everything after the leading '-'

	// Handle short flag with attached value: -u=postgres or -upostgres
	const eqIdx = chars.indexOf("=");
	let attachedValue: string | null = null;
	let isValueAttached = false;
	if (eqIdx > 0) {
		// -u=postgres
		attachedValue = chars.slice(eqIdx + 1);
		isValueAttached = true;
	} else if (chars.length > 1) {
		// -upostgres
		attachedValue = chars.slice(1);
		isValueAttached = true;
	}

	// Determine if this is a single-char flag (possibly with attached value)
	const singleCharFlag =
		chars.length === 1 || isValueAttached ? chars[0] : null;

	if (singleCharFlag) {
		switch (singleCharFlag) {
			case "u":
				if (isValueAttached) {
					return {
						kind: "value_attached",
						flag: "--user",
						value: attachedValue,
					};
				}
				return { kind: "value", flag: "--user" };
			case "n":
				return { kind: "boolean", arg: "--disable-internal-agent" };
			case "E":
			case "H":
			case "i":
			case "s":
			case "b":
			case "v":
			case "k":
			case "A":
				return { kind: "boolean", arg: null };
			case "g":
			case "C":
			case "U":
			case "p":
				return { kind: "drop_value" };
			default:
				return { kind: "unknown" };
		}
	}

	// Multiple combined short flags (e.g. -nE, -uHn) — we could handle these
	// by iterating each char, but it's rare in sudo and error-prone.
	// Treat as unknown to preserve correctness.
	return { kind: "unknown" };
}

// ─── Sudo → pkexec transformation ───────────────────────────────────────────

/**
 * Parse the text that follows `sudo` and return the remapped pkexec args plus
 * how much of the input was consumed (everything up to & including the program).
 */
function transformSudoInvocation(afterSudo: string): {
	pkexecPart: string;
	consumed: number;
} {
	const pos = { value: 0 };
	const pkexecArgs: string[] = [];

	while (pos.value < afterSudo.length) {
		// Check for shell separators at top level
		const c = afterSudo[pos.value];
		if (SHELL_SEPARATORS.has(c)) break;
		if (looksLikeCmdSubst(afterSudo, pos.value)) break;
		if (/\s/.test(c)) {
			pos.value++;
			continue;
		}

		// Not a flag? We're at the command name — stop.
		if (c !== "-") break;

		// `--` marks end of flags
		if (
			afterSudo.startsWith("--", pos.value) &&
			(pos.value + 2 >= afterSudo.length || /\s/.test(afterSudo[pos.value + 2]))
		) {
			pos.value += 2;
			break;
		}

		const token = nextToken(afterSudo, pos);
		if (!token) break;

		const result = parseSudoFlag(token);

		switch (result.kind) {
			case "boolean":
				if (result.arg) pkexecArgs.push(result.arg);
				break;
			case "value": {
				pkexecArgs.push(result.flag);
				const val = nextToken(afterSudo, pos);
				if (val) pkexecArgs.push(val);
				break;
			}
			case "value_attached":
				pkexecArgs.push(result.flag, result.value);
				break;
			case "drop_value":
				nextToken(afterSudo, pos); // consume & discard value
				break;
			case "unknown":
				pkexecArgs.push(token); // passthrough
				break;
		}
	}

	return {
		pkexecPart: pkexecArgs.join(" "),
		consumed: pos.value,
	};
}

/**
 * Transform `su` invocations. Returns the replacement text and how much of
 * `afterSu` was consumed (including the program, i.e. everything).
 *
 * Handles:
 *   su -c 'cmd'        →  pkexec /bin/sh -c 'cmd'
 *   su user -c 'cmd'   →  pkexec --user user /bin/sh -c 'cmd'
 */
function transformSuInvocation(afterSu: string): {
	pkexecPart: string;
	consumed: number;
} {
	const pos = { value: 0 };
	const pkexecArgs: string[] = [];

	// Skip whitespace
	while (pos.value < afterSu.length && /\s/.test(afterSu[pos.value])) {
		pos.value++;
	}

	// Peek: if first token starts with '-', it's su flags (like su -c)
	// If it doesn't start with '-', it might be a username (su user -c)
	const first = nextToken(afterSu, pos);

	if (!first) {
		// Just `su` with no args — translate to `pkexec` (which starts a shell)
		return { pkexecPart: "pkexec", consumed: pos.value };
	}

	if (first === "-c" || first === "-") {
		// su -c 'cmd'  or  su - user -c 'cmd'
		if (first === "-") {
			// su - user -c 'cmd' — the '-' means login shell, ignore
			const maybeUser = nextToken(afterSu, pos);
			const dashC = nextToken(afterSu, pos);
			if (dashC === "-c") {
				const cmd = nextToken(afterSu, pos);
				if (cmd) {
					// --user only if maybeUser looks like a username (not a flag)
					if (maybeUser && !maybeUser.startsWith("-")) {
						pkexecArgs.push("--user", maybeUser);
					}
					pkexecArgs.push("/bin/sh", "-c", cmd);
				} else {
					// Fall back for safety
					pkexecArgs.push("/bin/sh", "-c");
					if (maybeUser) pkexecArgs.push(maybeUser);
				}
			}
		} else {
			// su -c 'cmd'
			const cmd = nextToken(afterSu, pos);
			if (cmd) {
				pkexecArgs.push("/bin/sh", "-c", cmd);
			}
		}
		return {
			pkexecPart: "pkexec " + pkexecArgs.join(" "),
			consumed: pos.value,
		};
	}

	// su <user> -c 'cmd'
	const dashC = nextToken(afterSu, pos);
	if (dashC === "-c") {
		const cmd = nextToken(afterSu, pos);
		if (cmd) {
			pkexecArgs.push("--user", first, "/bin/sh", "-c", cmd);
		}
		return {
			pkexecPart: "pkexec " + pkexecArgs.join(" "),
			consumed: pos.value,
		};
	}

	// Just `su <user>` — translate to pkexec --user user (starts shell as that user)
	pkexecArgs.push("--user", first);
	return { pkexecPart: "pkexec " + pkexecArgs.join(" "), consumed: pos.value };
}

// ─── Command-level transformation ────────────────────────────────────────────

/**
 * Pattern that matches `sudo` or `su` at a word boundary, preceded by a shell
 * separator or start-of-string. Capture group 1 is the separator prefix,
 * capture group 2 is the keyword (`sudo` or `su`).
 */
const KEYWORD_PATTERN = /(^|[|&;(){}\n\s])\b(sudo|su)\b(?![\w-])/g;

/**
 * Transform all `sudo`/`su` invocations in a command string to use `pkexec`.
 *
 * Processes the string left to right. When `sudo` or `su` is found at a word
 * boundary, the following arguments are parsed (respecting shell quoting and
 * stopping at shell separators), flags are remapped to pkexec equivalents,
 * and the invocation is replaced in the output.
 *
 * Invocations that can't be parsed are left as-is (safe fallback).
 */
function transformCommand(command: string): string {
	const parts: string[] = [];
	let lastIndex = 0;
	KEYWORD_PATTERN.lastIndex = 0;

	let m: RegExpExecArray | null;
	while ((m = KEYWORD_PATTERN.exec(command)) !== null) {
		const prefix = m[1];
		const keyword = m[2];
		const keywordEnd = m.index + m[0].length; // position right after keyword
		const afterKeyword = command.slice(keywordEnd);

		if (keyword === "sudo") {
			const { pkexecPart, consumed } = transformSudoInvocation(afterKeyword);

			parts.push(command.slice(lastIndex, m.index + prefix.length));
			parts.push("pkexec");
			if (pkexecPart) parts.push(" ", pkexecPart);

			// Advance past the parsed portion
			const newPos = keywordEnd + consumed;
			lastIndex = newPos;
			KEYWORD_PATTERN.lastIndex = newPos;
		} else {
			// su
			const { pkexecPart, consumed } = transformSuInvocation(afterKeyword);

			parts.push(command.slice(lastIndex, m.index + prefix.length));
			parts.push(pkexecPart);

			const newPos = keywordEnd + consumed;
			lastIndex = newPos;
			KEYWORD_PATTERN.lastIndex = newPos;
		}
	}

	parts.push(command.slice(lastIndex));
	return parts.join("");
}

// ─── Extension entry point ───────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	const cwd = process.cwd();

	// ── 1. Bash tool (for when hypa isn't in replace mode) ──
	const bashTool = createBashTool(cwd, {
		spawnHook: ({ command, cwd, env }) => {
			return {
				command: transformCommand(command),
				cwd,
				env,
			};
		},
	});

	pi.registerTool({
		...bashTool,
		execute: async (id, params, signal, onUpdate, _ctx) => {
			return bashTool.execute(id, params, signal, onUpdate);
		},
	});

	// ── 2. Hypa shell tool (the one actually used in this session) ──
	// The @hypabolic/pi-hypa extension registers hypa_shell and disables the
	// built-in bash tool in replace mode, so the spawnHook above never fires.
	// Instead, we intercept the tool_call event and mutate the command param
	// before hypa_shell executes it.
	pi.on("tool_call", (event, _ctx) => {
		if (event.toolCall?.name !== "hypa_shell") return;
		if (typeof event.input.command === "string") {
			event.input.command = transformCommand(event.input.command);
		}
	});
}
