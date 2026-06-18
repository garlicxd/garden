#!/bin/bash
# Start xdg-desktop-portal for the current session
# This is needed because noctalia starts niri directly (not via systemd user service),
# so graphical-session.target is never activated, and the portal service won't start.

set -euo pipefail

# Wait for the systemd user instance to be ready
sleep 1

# Start the portal background implementation
# xdg-desktop-portal-gtk provides most basic functionality
export GSETTINGS_BACKEND=memory

# Check if portal is already running
if dbus-send --session --dest=org.freedesktop.DBus --type=method_call --print-reply \
    /org/freedesktop/DBus org.freedesktop.DBus.ListNames 2>/dev/null | \
    grep -q "org.freedesktop.portal.Desktop"; then
    echo "Portal already running"
    exit 0
fi

# Start xdg-desktop-portal directly (bypasses systemd service which requires graphical-session.target)
/usr/libexec/xdg-desktop-portal &
echo "Started xdg-desktop-portal (PID $!)"
