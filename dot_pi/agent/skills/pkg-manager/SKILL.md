---
name: pkg-manager
description: "Package management via zypper (primary), flatpak (secondary), and opi (fallback) for openSUSE. Trigger words: install, remove, update, search, package, zypper, flatpak, flathub, opi, rpm."
---

# Package Manager

Priority order: **zypper → flatpak → vendor RPM repos → opi**

## zypper (primary — official openSUSE repos)

| Action | Command |
|--------|---------|
| Search | `zypper se <query>` |
| Info | `zypper info <pkg>` |
| Install | `sudo zypper in <pkg>` |
| Remove | `sudo zypper rm <pkg>` |
| Update all | `sudo zypper up` |
| Dist-upgrade | `sudo zypper dup` |
| List repos | `zypper lr` |
| List installed | `zypper se --installed-only` |
| What provides | `zypper wp <file>` |

**Non-interactive mode:** When running zypper from scripts, tools, or any non-terminal context, add `--non-interactive` to skip prompts and use default answers:

```bash
sudo zypper --non-interactive in <pkg>
sudo zypper --non-interactive rm <pkg>
```

If you see `Cannot read input: bad stream or EOF`, it means zypper was called without a terminal — add `--non-interactive`.

## Flatpak (secondary — Flathub)

Try Flatpak after zypper if the package isn't in official repos.

### Setup

Flatpak and the Flathub remote are available in the default openSUSE repos:

```bash
# Install Flatpak (already done on this system)
sudo zypper in flatpak

# Flathub remote is auto-installed via flatpak-remote-flathub package
# Verify it's present:
flatpak remote-list
```

**Note on user vs system mode:** If `flatpak install flathub <app-id>` fails with permission errors (common on single-user systems), use `--user` flag:

```bash
# Add Flathub for user mode if needed
flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo

# Install for current user only
flatpak install --user flathub <app-id>
```

### Common commands

| Action | Command |
|--------|---------|
| Search apps | `flatpak search <query>` |
| Install (system) | `flatpak install flathub <app-id>` |
| Install (user) | `flatpak install --user flathub <app-id>` |
| Remove | `flatpak uninstall <app-id>` |
| Update all | `flatpak update` |
| List installed | `flatpak list --app` |
| Run an app | `flatpak run <app-id>` |
| Info / details | `flatpak info <app-id>` |
| List remotes | `flatpak remote-list` |
| Add a remote | `flatpak remote-add --if-not-exists <name> <url>` |

### Security policy

Flathub is the official, curated Flatpak repository — more trustworthy than OBS/opi. Good for desktop apps (browsers, editors, media tools, etc.). Still, prefer zypper (official distro packages) first when available.

## Vendor/official repos (alternative to opi)

Some apps have official RPM repos that are more trustworthy than opi/OBS builds.

### Brave Origin (minimalist Brave, free on Linux)

Brave Origin is a **separate product** from regular Brave Browser — a minimalist version that strips out revenue features (Leo AI, Rewards, Wallet, VPN, etc.). On Linux it's **free**. Package is `brave-origin`, not `brave-browser`.

```bash
sudo zypper addrepo https://brave-browser-rpm-release.s3.brave.com/brave-browser.repo
sudo zypper install brave-origin
```

For regular Brave Browser (full-featured):
```bash
sudo zypper addrepo https://brave-browser-rpm-release.s3.brave.com/brave-browser.repo
sudo zypper install brave-browser
```

Always prefer adding the **official vendor RPM repo** over opi when one exists (Brave, Google Chrome, VS Code, etc.).

## opi (last resort — OBS/Packman user repos)

Install: `sudo zypper install opi`
Usage: `opi <pkg>` (searches OBS, Packman, vendors)
Popular: `opi codecs`, `opi chrome`, `opi vscode`, `opi brave` (use official repo for Brave instead — see above)
Non-interactive: `opi -n <pkg>`

### ⚠️ opi security policy

opi pulls from OBS/Packman (user-contributed repos), not official repos.
- **Devel packages** (build tools, libs, headers, `-devel`, `*-dev`) — install freely
- **Non-devel packages** (apps, media, browsers, etc.) — **always ask the user first**
