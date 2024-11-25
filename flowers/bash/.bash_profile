
# ~/.bash_profile
#
[[ -f ~/.profile ]] && . ~/.profile
[[ -f ~/.bashrc ]] && . ~/.bashrc

[[ "$(tty)" == /dev/tty1 ]] && Hyprland
