# Discord

Noctalia-colored variants of Midnight, Material Discord (with its Material You addon), and System24 for Discord clients with custom CSS theme support.

## Setup

Install and configure a compatible client or theme loader first. Enable the desired client/style entries under **Noctalia Settings -> Templates**, then enable the generated theme through that client's theme loader. The template does not install a loader or select a theme for you; choose one style rather than enabling competing styles together.

Each destination directory below receives these files:

| Style | Filename |
| --- | --- |
| Midnight | `noctalia.theme.css` |
| Material | `noctalia-material.theme.css` |
| System24 | `discord-system24.css` |

| Client | Destination directory |
| --- | --- |
| Vesktop | `$XDG_CONFIG_HOME/vesktop/themes/` |
| Vesktop Flatpak | `~/.var/app/dev.vencord.Vesktop/config/vesktop/themes/` |
| WebCord | `$XDG_CONFIG_HOME/webcord/themes/` |
| Legcord | `$XDG_CONFIG_HOME/legcord/themes/` |
| Equibop | `$XDG_CONFIG_HOME/equibop/themes/` |
| Equicord | `$XDG_CONFIG_HOME/Equicord/themes/` |
| Lightcord | `$XDG_CONFIG_HOME/lightcord/themes/` |
| Dorion | `$XDG_CONFIG_HOME/dorion/themes/` |
| Vencord | `$XDG_CONFIG_HOME/Vencord/themes/` |
| Vencord / Discord Flatpak | `~/.var/app/com.discordapp.Discord/config/Vencord/themes/` |
| BetterDiscord | `$XDG_CONFIG_HOME/BetterDiscord/themes/` |

`$XDG_CONFIG_HOME` normally resolves to `~/.config`. Back up any existing files at these paths; generation replaces them.

## Dependencies and updates

The styles import upstream CSS over the network: Midnight and System24 from `refact0r.github.io`, and Material Discord plus its addon from `capnkitten.github.io`. Those resources must be accessible to the client.

There are no hooks or reload commands. Theme activation and reloading are handled through your chosen client/theme loader.
