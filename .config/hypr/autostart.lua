-- تابع کمکی برای اجرای پس‌زمینه (برای تمیزی کدها)
local function exec(cmd)
    os.execute(cmd .. " &")
end

-- گوش دادن به رویداد استارت هایپرلند
hl.on("hyprland.start", function()
    exec("awww-daemon")
    exec("awww clear-cache")
    exec("nm-applet")
    exec("blueman-applet")
    
    -- اجرای احراز هویت KDE PolicyKit
    exec("/usr/lib/polkit-kde-authentication-agent-1")
    
    -- اجرای برنامه قفل صفحه و خواب (idle)
    exec("hypridle")
    
    -- اجرای اسکریپت اعمال تم (در پس‌زمینه)
    exec("~/.config/hypr/themes/current/apply.sh")

    -- خاموش کردن تاچ‌پد در استارتاپ 
    -- از تابع مستقیم Lua برای تغییر دستگاه استفاده می‌کنیم
    hl.device({
        name = "syna2ba6:00-06cb:ce2d-touchpad",
        enabled = false
    })
end)