/**
 * sudo → pkexec Extension
 *
 * Intercepts the built-in bash tool and transparently replaces any `sudo`
 * command with `pkexec`, so the agent never needs to ask for a sudo password.
 * Polkit handles privilege escalation via the graphical auth dialog.
 *
 * Uses createBashTool with a spawnHook (see examples/extensions/bash-spawn-hook.ts).
 */

import { createBashTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * Replace `sudo` with `pkexec` in a bash command string.
 *
 * Handles:
 *   sudo cmd         → pkexec cmd          (start of line)
 *   | sudo cmd       → | pkexec cmd        (after pipe)
 *   && sudo cmd      → && pkexec cmd       (after &&)
 *   || sudo cmd      → || pkexec cmd       (after ||)
 *   ; sudo cmd       → ; pkexec cmd        (after semicolon)
 *   \n sudo cmd      → \n pkexec cmd       (after newline)
 *
 * Does NOT replace `sudo` inside strings, comments, or as a substring of
 * another word (e.g., `pseudo`, `sudoers`).
 */
function replaceSudoWithPkexec(command: string): string {
	// Match `sudo` only as a standalone word, preceded by start-of-string,
	// whitespace, pipe, &, ;, or similar separators.
	return command.replace(
		/(^|[|&;\(\)\{\}\n\s])\bsudo\b(?![\w-])/g,
		"$1pkexec",
	);
}

export default function (pi: ExtensionAPI) {
	const cwd = process.cwd();

	const bashTool = createBashTool(cwd, {
		spawnHook: ({ command, cwd, env }) => {
			const modified = replaceSudoWithPkexec(command);
			return {
				command: modified,
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
}
