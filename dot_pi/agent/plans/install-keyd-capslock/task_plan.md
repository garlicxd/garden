# Plan: Install keyd and remap Caps Lock → Left Shift, Left Shift → Left Ctrl

## Overview

Install the `keyd` keyboard remapping daemon and configure custom key overrides:

- **Caps Lock** → Left Shift
- **Left Shift** → Left Ctrl

## Steps

- [x] **1. Install keyd** — Install via pacman (available in CachyOS repos).
      *Dependencies:* none
      *Files:* none
      *Rollback:* `sudo pacman -R keyd`

- [x] **2. Create keyd config** — Write `/etc/keyd/default.conf` with the desired mappings.
      *Dependencies:* step 1
      *Files:* `/etc/keyd/default.conf` (create)
      *Rollback:* `sudo rm /etc/keyd/default.conf && sudo systemctl restart keyd`

- [x] **3. Enable and start keyd service** — Enable the systemd service so it starts at boot and start it now.
      *Dependencies:* step 2
      *Files:* none
      *Rollback:* `sudo systemctl disable --now keyd`

- [x] **4. Verify configuration** — Check that the keyd service is active and the config is loaded.
      *Dependencies:* step 3
      *Files:* none
      *Rollback:* none
