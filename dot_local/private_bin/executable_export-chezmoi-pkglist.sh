#!/bin/bash
TARGET_DIR="$HOME/.local/share/chezmoi/pkglists"

mkdir -p "$TARGET_DIR"

pacman -Qqen >"$TARGET_DIR/pacman.txt"
pacman -Qqem >"$TARGET_DIR/aur.txt"
