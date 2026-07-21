#!/bin/bash
# Export enabled systemd service lists for chezmoi tracking
# Mirrors the pattern from export-chezmoi-pkglist.sh

TARGET_DIR="$HOME/.local/share/chezmoi/pkglists"

mkdir -p "$TARGET_DIR"

systemctl list-unit-files --state=enabled --type=service --no-legend 2>/dev/null \
    | awk '{print $1}' \
    > "$TARGET_DIR/enabled-system-services.txt"

systemctl --user list-unit-files --state=enabled --type=service --no-legend 2>/dev/null \
    | awk '{print $1}' \
    > "$TARGET_DIR/enabled-user-services.txt"
