local mainMod = "SUPER"

local terminal = "kitty"
local fileManager = "thunar"
local menu = "rofi -show drun -config ~/.config/hypr/themes/current/rofi/config.rasi"

-- ===================
-- === KEYBINDINGS ===
-- ===================

hl.bind(mainMod .. " + ESCAPE", hl.dsp.exec_cmd("~/.config/rofi/scripts/powermenu.sh"))
hl.bind(mainMod .. " + N",      hl.dsp.exec_cmd("swaync-client -t"))
hl.bind(mainMod .. " + A",      hl.dsp.exec_cmd("~/.config/rofi/scripts/theme.sh"))
hl.bind(mainMod .. " + T",      hl.dsp.exec_cmd(terminal))

hl.bind(mainMod .. " + Q",      hl.dsp.window.close())
hl.bind(mainMod .. " + L",      hl.dsp.exec_cmd("hyprlock"))
hl.bind(mainMod .. " + F",      hl.dsp.exec_cmd(fileManager))
hl.bind(mainMod .. " + F11",    hl.dsp.window.fullscreen())

hl.bind("Print",                hl.dsp.exec_cmd("hyprshot -m output --clipboard-only"))
hl.bind(mainMod .. " + Print",  hl.dsp.exec_cmd("hyprshot -m region --clipboard-only"))
hl.bind("SHIFT + Print",        hl.dsp.exec_cmd("hyprshot -m output -o ~/Pictures/Screenshots"))

hl.bind(mainMod .. " + F7",     hl.dsp.exec_cmd("wf-recorder -f \"$HOME/Videos/ScreenRecords/Recording-$(date +'%Y-%m-%d_%H-%M-%S').mp4\""))
hl.bind("SHIFT + F7",           hl.dsp.exec_cmd("killall wf-recorder && notify-send \"Video Recorded\""))

hl.bind(mainMod .. " + V",      hl.dsp.window.float({ action = "toggle" }))
hl.bind(mainMod .. " + Return", hl.dsp.exec_cmd(menu))
hl.bind(mainMod .. " + P",      hl.dsp.window.pseudo())
hl.bind(mainMod .. " + B",      hl.dsp.exec_cmd("blueman-manager"))
hl.bind(mainMod .. " + D",      hl.dsp.exec_cmd("nwg-drawer"))

-- super + tab
hl.bind(mainMod .. " + Tab",    hl.dsp.exec_cmd("hyprctl dispatch cyclenext"))
hl.bind(mainMod .. " + Tab",    hl.dsp.exec_cmd("hyprctl dispatch bringactivetotop"))

-- TouchPad
-- متغیر برای ذخیره وضعیت فعلی تاچ‌پد (پیش‌فرض روشن)
local tp_enabled = true

-- کلید ترکیبی Win + M با اجرای یک تابع مستقیم Lua
hl.bind(mainMod .. " + M", function()
    -- معکوس کردن وضعیت
    tp_enabled = not tp_enabled
    
    -- اعمال تنظیمات جدید به دستگاه به صورت در لحظه
    hl.device({
        name = "syna2ba6:00-06cb:ce2d-touchpad",
        enabled = tp_enabled
    })
    
    -- ارسال نوتیفیکیشن سیستم
    if tp_enabled then
        os.execute("notify-send 'Touchpad' 'ON' &")
    else
        os.execute("notify-send 'Touchpad' 'OFF' &")
    end
end)

-- Move focus with mainMod + arrow keys
hl.bind(mainMod .. " + left",   hl.dsp.focus({ direction = "left" }))
hl.bind(mainMod .. " + left",   hl.dsp.exec_cmd("hyprctl dispatch bringactivetotop"))
hl.bind(mainMod .. " + right",  hl.dsp.focus({ direction = "right" }))
hl.bind(mainMod .. " + right",  hl.dsp.exec_cmd("hyprctl dispatch bringactivetotop"))
hl.bind(mainMod .. " + up",     hl.dsp.focus({ direction = "up" }))
hl.bind(mainMod .. " + up",     hl.dsp.exec_cmd("hyprctl dispatch bringactivetotop"))
hl.bind(mainMod .. " + down",   hl.dsp.focus({ direction = "down" }))
hl.bind(mainMod .. " + down",   hl.dsp.exec_cmd("hyprctl dispatch bringactivetotop"))

-- Switch workspaces with mainMod + [1-4]
-- Move active window to a workspace with mainMod + SHIFT + [1-4]
for i = 1, 4 do
    hl.bind(mainMod .. " + " .. i,           hl.dsp.focus({ workspace = i }))
    hl.bind(mainMod .. " + SHIFT + " .. i,   hl.dsp.window.move({ workspace = i }))
end

-- Example special workspace (scratchpad)
hl.bind(mainMod .. " + S",         hl.dsp.workspace.toggle_special("magic"))
hl.bind(mainMod .. " + SHIFT + S", hl.dsp.window.move({ workspace = "special:magic" }))

-- Scroll through existing workspaces with mainMod + scroll
hl.bind(mainMod .. " + mouse_down", hl.dsp.focus({ workspace = "e+1" }))
hl.bind(mainMod .. " + mouse_up",   hl.dsp.focus({ workspace = "e-1" }))

-- Move/resize windows with mainMod + LMB/RMB and dragging
hl.bind(mainMod .. " + mouse:272", hl.dsp.window.drag(),   { mouse = true })
hl.bind(mainMod .. " + mouse:273", hl.dsp.window.resize(), { mouse = true })

-- Laptop multimedia keys for volume and LCD brightness
hl.bind("XF86AudioRaiseVolume",  hl.dsp.exec_cmd("wpctl set-volume -l 1 @DEFAULT_AUDIO_SINK@ 5%+"), { locked = true, repeating = true })
hl.bind("XF86AudioLowerVolume",  hl.dsp.exec_cmd("wpctl set-volume @DEFAULT_AUDIO_SINK@ 5%-"),      { locked = true, repeating = true })
hl.bind("XF86AudioMute",         hl.dsp.exec_cmd("wpctl set-mute @DEFAULT_AUDIO_SINK@ toggle"),     { locked = true, repeating = true })
hl.bind("XF86AudioMicMute",      hl.dsp.exec_cmd("wpctl set-mute @DEFAULT_AUDIO_SOURCE@ toggle"),   { locked = true, repeating = true })
hl.bind("XF86MonBrightnessUp",   hl.dsp.exec_cmd("brightnessctl -e4 -n2 set 5%+"),                  { locked = true, repeating = true })
hl.bind("XF86MonBrightnessDown", hl.dsp.exec_cmd("brightnessctl -e4 -n2 set 5%-"),                  { locked = true, repeating = true })

-- Requires playerctl
hl.bind("XF86AudioNext",  hl.dsp.exec_cmd("playerctl next"),       { locked = true })
hl.bind("XF86AudioPause", hl.dsp.exec_cmd("playerctl play-pause"), { locked = true })
hl.bind("XF86AudioPlay",  hl.dsp.exec_cmd("playerctl play-pause"), { locked = true })
hl.bind("XF86AudioPrev",  hl.dsp.exec_cmd("playerctl previous"),   { locked = true })