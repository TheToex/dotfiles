-- ۱. قوانین پیش‌فرض و کاربردی (جلوگیری از باگ‌های رایج)
hl.window_rule({
    name  = "suppress-maximize-events",
    match = { class = ".*" },
    suppress_event = "maximize",
})

hl.window_rule({
    name  = "fix-xwayland-drags",
    match = {
        class      = "^$",
        title      = "^$",
        xwayland   = true,
        float      = true,
        fullscreen = false,
        pin        = false,
    },
    no_focus = true,
})

-- ۲. قوانین شخصی شما

-- firefox
hl.window_rule({
    name  = "firefox-rules",
    match = { class = "firefox" },
    opacity = "1.0 override 1.0 override",
})

-- thunar
hl.window_rule({
    name  = "thunar-rules",
    match = { class = "thunar" },
    border_size = 5,
    float = true,
    center = true,
    size = "1000 700",
})

-- telegram
hl.window_rule({
    name  = "telegram-rules",
    match = { class = "org%.telegram%.desktop" }, -- در Lua بهتر است نقطه‌ها را با % اسکیپ کنیم یا به عنوان استرینگ رگولار بفرستیم
    float = true,
    center = true,
    size = "1300 700",
    opacity = "1.0 override 1.0 override",
})

-- v2rayN
hl.window_rule({
    name  = "v2ray-rules",
    match = { class = "v2rayN" },
    float = true,
    center = true,
    size = "1000 600",
})

-- blueman
hl.window_rule({
    name  = "blueman-rules",
    match = { class = "blueman%-manager" }, -- اسکیپ کردن خط تیره
    border_size = 5,
    float = true,
    center = true,
    size = "1000 700",
})

-- pavucontrol
hl.window_rule({
    name  = "pavucontrol-rules",
    match = { class = "org%.pulseaudio%.pavucontrol" },
    border_size = 5,
    float = true,
    center = true,
    size = "1000 700",
})

-- mpv
hl.window_rule({
    name  = "mpv-rules",
    match = { class = "mpv" },
    float = true,
    center = true,
    size = "1080 720",
    opacity = "1.0 override 1.0 override",
})