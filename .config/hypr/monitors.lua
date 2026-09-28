-- See https://wiki.hyprland.org/Configuring/Monitors/

-- ۱. تنظیمات مانیتور اصلی لپ‌تاپ
hl.monitor({
    output   = "eDP-1",         -- معمولاً اسم مانیتور لپ‌تاپ این است (با دستور hyprctl monitors چک کنید)
    mode     = "1920x1080@60",  -- رزولوشن و رفرش‌ریت
    position = "0x0",           -- موقعیت (مختصات شروع)
    scale    = 1,               -- اسکیل تصویر
})

-- ۲. تنظیمات خودکار برای مانیتورهای خارجی (HDMI, DisplayPort و غیره)
hl.monitor({
    output   = "",              -- خالی بودن یعنی اعمال روی تمام مانیتورهای دیگر
    mode     = "preferred",     -- بهترین رزولوشن خودکار
    position = "auto",          -- جایگذاری خودکار در کنار مانیتور اصلی
    scale    = "auto",          -- اسکیل خودکار
})