#!/bin/bash
sleep 1
killall xdg-desktop-portal-hyprland 
killall xdg-desktop-portal-termfilechooser
killall xdg-desktop-portal
/usr/lib/xdg-desktop-portal-hyprland &
/usr/lib/xdg-desktop-portal-termfilechooser &
sleep 2
/usr/lib/xdg-desktop-portal &
