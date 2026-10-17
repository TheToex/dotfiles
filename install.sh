#!/bin/bash
# install reqirements
sudo pacman -S --needed hyprland hyprlock hypridle ags thunar kitty fastfetch
# copy configs
cp -r files/hypr ~/.config/
cp -r files/fastfetch ~/.config
cp -r files/ags ~/.config
echo "Installation Completed!"
