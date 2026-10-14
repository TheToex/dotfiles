-- تابع کمکی برای اجرای پس‌زمینه (برای تمیزی کدها)
local function exec(cmd)
    os.execute(cmd .. " &")
end

-- گوش دادن به رویداد استارت هایپرلند
hl.on("hyprland.start", function()
    exec("awww-daemon")
    exec("awww clear-cache")
    exec("ags run")
    exec("awww img --transition-type grow --transition-duration 1 --transition-fps 60 ~/.config/hypr/themes/neoprland/wall.png")
    --exec("nm-applet")
    --exec("blueman-applet")
    
    -- اجرای احراز هویت KDE PolicyKit
    exec("/usr/lib/polkit-kde-authentication-agent-1")
    
    -- اجرای برنامه قفل صفحه و خواب (idle)
    exec("hypridle")
    
    -- اجرای اسکریپت اعمال تم (در پس‌زمینه)
    -- exec("~/.config/hypr/themes/current/apply.sh")

    -- بازیابی وضعیت ذخیره‌شده تاچ‌پد
    local tp_enabled = true
    local f = io.open(os.getenv("HOME") .. "/.config/hypr/.touchpad_state", "r")
    if f then
        local content = f:read("*a")
        f:close()
        if content:match("false") then
            tp_enabled = false
        end
    else
        -- اگر فایلی نبود پیش‌فرض خاموش باشد (مثل رفتار قبلی شما) یا روشن
        -- ما اینجا فرض می‌کنیم پیش‌فرض می‌خواهید روشن باشد، اما برای حفظ رفتار قبلی می‌توانید false بگذارید.
        -- اما بهتر است فایل ساخته شود
        tp_enabled = false 
    end

    hl.device({
        name = "syna2ba6:00-06cb:ce2d-touchpad",
        enabled = tp_enabled
    })

    -- بازیابی وضعیت ذخیره‌شده میکروفون
    exec("bash -c 'for i in {1..10}; do if wpctl get-volume @DEFAULT_AUDIO_SOURCE@ >/dev/null 2>&1; then if [ \"$(cat ~/.config/hypr/.mic_state 2>/dev/null)\" = \"muted\" ]; then wpctl set-mute @DEFAULT_AUDIO_SOURCE@ 1; else wpctl set-mute @DEFAULT_AUDIO_SOURCE@ 0; fi; break; fi; sleep 0.5; done' &")
end)