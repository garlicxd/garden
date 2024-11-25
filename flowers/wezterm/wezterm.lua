local wezterm = require 'wezterm'
local config = wezterm.config_builder()

config.enable_wayland = true
config.font = wezterm.font_with_fallback {
    'RobotoMono',
    'Noto Sans'
}

return config