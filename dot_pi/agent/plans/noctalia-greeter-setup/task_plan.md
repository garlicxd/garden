# Plan: Noctalia Greeter + GNOME Keyring + PAM Setup (Revised)

## Current State
- `greetd` v0.10.3 installed, **disabled**, inactive
- `noctalia-greeter` v1.0.0-1 installed (binaries at /usr/bin/)
- `noctalia-git` v5.0.0 installed
- `gnome-keyring` v50.0-1.1 installed
- `/etc/pam.d/greetd` — exists, **no** `pam_gnome_keyring.so`
- `/etc/greetd/config.toml` — default `agreety --cmd /bin/sh`
- `/var/lib/noctalia-greeter/greeter.toml` — exists, empty
- `greeter` user: unknown

---

## Steps

- [ ] **0. Backup files**
      *Dependencies:* none
      *Files:* `/etc/greetd/config.toml` → `config.toml.bak`, `/etc/pam.d/greetd` → `greetd.bak`
      *Rollback:* restore both from .bak

- [ ] **1. Ensure `greeter` user exists**
      *Dependencies:* step 0
      *Files:* — (system user)
      *Rollback:* `sudo userdel greeter` (if newly created)
      *Command:* `id greeter` first; if missing or broken → `sudo useradd -r -s /usr/bin/nologin -d /var/lib/noctalia-greeter greeter`

- [ ] **2. Configure greetd for noctalia-greeter**
      *Dependencies:* step 1
      *Files:* `/etc/greetd/config.toml` (write)
      *Rollback:* `sudo cp config.toml.bak config.toml`
      *Config:*
      ```toml
      [terminal]
      vt = 1

      [default_session]
      command = "/usr/bin/noctalia-greeter-session"
      user = "greeter"
      ```

- [ ] **3. Configure PAM for GNOME Keyring**
      *Dependencies:* step 0
      *Files:* `/etc/pam.d/greetd` (edit)
      *Rollback:* `sudo cp greetd.bak greetd`
      *Details:* Add `pam_gnome_keyring.so` in correct order:
        - `auth optional pam_gnome_keyring.so` after `auth include system-local-login`
        - `session optional pam_gnome_keyring.so auto_start` after `session include system-local-login`, before `session required pam_systemd.so`

- [ ] **4. Check for conflicting display managers**
      *Dependencies:* none
      *Files:* — (systemd check)
      *Rollback:* re-enable disabled DMs if needed
      *Command:* `systemctl is-enabled sddm gdm lightdm 2>&1` — disable any that are enabled

- [ ] **5. Enable greetd (no --now)**
      *Dependencies:* steps 2–4
      *Files:* — (systemd)
      *Rollback:* `sudo systemctl disable greetd`
      *Command:* `sudo systemctl enable greetd`
      *⚠️ No `--now` — test via reboot, not mid-session takeover*

- [ ] **6. Set niri as default session**
      *Dependencies:* step 2
      *Files:* `/var/lib/noctalia-greeter/greeter.toml` (edit)
      *Rollback:* revert to empty config
      *Config:*
      ```toml
      [session]
      default = "niri"
      ```

- [ ] **7. Verify gnome-keyring-daemon user service**
      *Dependencies:* none
      *Files:* — (systemctl --user)
      *Rollback:* `systemctl --user disable gnome-keyring-daemon.service`
      *Command:* `systemctl --user is-enabled gnome-keyring-daemon.service`; enable if not

- [ ] **8. Reboot and verify**
      *Dependencies:* steps 5–6
      *Files:* — (runtime)
      *Checks:*
        - Greeter appears on VT1
        - Login into niri works
        - `secret-tool search --all ''` returns results without password prompt
        - `journalctl -b | grep -i keyring` shows "unlocked keyring"

---

## Rollback (full)
```bash
sudo systemctl disable greetd
sudo cp /etc/greetd/config.toml.bak /etc/greetd/config.toml
sudo cp /etc/pam.d/greetd.bak /etc/pam.d/greetd
```
