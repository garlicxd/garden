#!/usr/bin/env bash
# Privileged setup for the lid-wakeup fix. Run via: pkexec /usr/bin/bash <this>
set -euo pipefail

# --- 1. Disable LID0 as an ACPI wakeup source (applied once per boot) ---------
cat >/etc/tmpfiles.d/disable-lid-wakeup.conf <<'EOF'
# Disable the lid switch as an ACPI wakeup source (toggle-once at boot).
# NOTE: writing to /proc/acpi/wakeup TOGGLES state. Do not re-run
# `systemd-tmpfiles --create` after a manual change.
# Re-verify the label after kernel updates:  grep -i lid /proc/acpi/wakeup
w /proc/acpi/wakeup - - - - LID0
EOF

# --- 2. Unblank displays after resume ----------------------------------------
# The lid no longer wakes the machine, so lid_open never fires on a
# power-button wake. This runs on every resume and re-enables DPMS.
# Socket path tracks WAYLAND_DISPLAY, so discover it at runtime instead of
# hardcoding umbriel-wayland-0.sock.
cat >/etc/systemd/system/lid-resume-unblank.service <<'EOF'
[Unit]
Description=Unblank displays after resume from sleep
After=suspend.target hibernate.target hybrid-sleep.target suspend-then-hibernate.target

[Service]
Type=oneshot
User=garlic
Environment=XDG_RUNTIME_DIR=/run/user/1000
Environment=PATH=/usr/bin:/bin
ExecStart=/bin/sh -c 'for s in "$XDG_RUNTIME_DIR"/umbriel-*.sock; do [ -S "$s" ] && export UMBRIEL_SOCKET="$s" && break; done; exec umbriel msg dpms-on'

[Install]
WantedBy=suspend.target hibernate.target hybrid-sleep.target suspend-then-hibernate.target
EOF

/usr/bin/systemctl daemon-reload
/usr/bin/systemctl enable lid-resume-unblank.service

# --- 3. Apply the wakeup change now ------------------------------------------
/usr/bin/systemd-tmpfiles --create /etc/tmpfiles.d/disable-lid-wakeup.conf

# --- 4. Report ----------------------------------------------------------------
echo "===== RESULT ====="
printf 'wakeup : '
/usr/bin/grep '^LID0' /proc/acpi/wakeup || echo 'LID0 line not found'
printf 'service: '
/usr/bin/systemctl is-enabled lid-resume-unblank.service
