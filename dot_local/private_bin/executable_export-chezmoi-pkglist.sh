#!/bin/bash
TARGET_DIR="$HOME/.local/share/chezmoi/pkglists"

mkdir -p "$TARGET_DIR"

# Package lists
pacman -Qqen >"$TARGET_DIR/pacman.txt"
pacman -Qqem >"$TARGET_DIR/aur.txt"

# Enabled systemd services (excluding template @.service units)
systemctl list-unit-files --state=enabled --type=service --no-legend 2>/dev/null |
	awk '$1 !~ /@\.service$/ {print $1}' \
		>"$TARGET_DIR/enabled-system-services.txt"

# User services — skip if no session bus (e.g. running from ALPM hook)
if systemctl --user list-unit-files --type=service &>/dev/null; then
	systemctl --user list-unit-files --state=enabled --type=service --no-legend 2>/dev/null |
		awk '$1 !~ /@\.service$/ {print $1}' \
			>"$TARGET_DIR/enabled-user-services.txt"
fi

# Bun global packages
test -f "$HOME/.bun/install/global/package.json" && jq -r '.dependencies | keys[]' "$HOME/.bun/install/global/package.json" > "$TARGET_DIR/bun.txt" || true

# Uv tools
if command -v uv &> /dev/null; then
    uv tool list --show-version-specifiers 2>/dev/null \
        | grep '^- ' | sed 's/^- //' | cut -d' ' -f1 \
        > "$TARGET_DIR/uv.txt"
fi
