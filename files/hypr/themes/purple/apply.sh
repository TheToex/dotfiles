#!/bin/bash

THEME_DIR="$(dirname "$(realpath "$0")")"
THEMES="$HOME/.config/hypr/themes"

# set current
ln -sfn "$THEME_DIR" "$THEMES/current"
ln -sfn "$THEME_DIR/yazi/theme.toml" "/home/toex/.config/yazi"
ln -sf "$HOME/.config/hypr/themes/purple/hypr/hyprlock/hyprlock.conf" "$HOME/.config/hypr/hyprlock.conf"
# wallpaper
awww img --transition-type grow --transition-duration 1 --transition-fps 60 ~/.config/hypr/themes/purple/wall.jpg

# waybar
killall -9 waybar
waybar -c "$THEME_DIR/waybar/waybar.jsonc" \
       -s "$THEME_DIR/waybar/waybar.css" &

# swaync
pkill swaync
swaync -s "$THEME_DIR/swaync/style.css" &
# reload hyprland
hyprctl reload
