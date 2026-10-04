-- تابع کمکی برای اجرای پس‌زمینه (برای تمیزی کدها)
local function exec(cmd)
    os.execute(cmd .. " &")
end

-- گوش دادن به رویداد استارت هایپرلند
hl.on("hyprland.start", function()
    exec("awww-daemon")
    exec("awww clear-cache")
    exec("ags run")
    exec("awww img --transition-type grow --transition-duration 1 --transition-fps 60 ~/.config/hypr/themes/purple/wall.jpg")
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
end)