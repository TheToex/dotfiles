import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { notifService, NotificationItem } from "../service/notifications"
import GLib from "gi://GLib"

// ============================================================================
// POPUP POSITION & MARGIN CONFIGURATION
// تغییر فاصله نوتیفیکیشن‌ها از بالا و راست صفحه را می‌توانید از اینجا دستی تغییر دهید:
// ============================================================================
export const POPUP_CONFIG = {
  marginTop: 45,   // فاصله از بالای صفحه (پیکسل)
  marginRight: 4,//اصله از سمت راست صفحه (پیکسل)
}

function getAppIconWidget(appName: string, appIcon: string): Gtk.Widget {
  const display = Gdk.Display.get_default()
  const theme = display ? Gtk.IconTheme.get_for_display(display) : null

  // 1. Explicit file path
  if (appIcon && appIcon.startsWith("/") && GLib.file_test(appIcon, GLib.FileTest.EXISTS)) {
    const pic = Gtk.Picture.new_for_filename(appIcon)
    pic.can_shrink = true
    if ((Gtk as any).ContentFit) {
      pic.set_content_fit((Gtk as any).ContentFit.CONTAIN)
    }
    pic.set_size_request(24, 24)
    pic.set_hexpand(true)
    pic.set_vexpand(true)
    pic.set_halign(Gtk.Align.CENTER)
    pic.set_valign(Gtk.Align.CENTER)
    return pic
  }

  // 2. IconTheme by appIcon
  if (appIcon && theme && theme.has_icon(appIcon)) {
    return new Gtk.Image({
      iconName: appIcon,
      pixelSize: 24,
      hexpand: true,
      vexpand: true,
      halign: Gtk.Align.CENTER,
      valign: Gtk.Align.CENTER,
    })
  }

  // 3. Fallbacks by appName
  const lower = (appName || "").toLowerCase()
  const appMap: Record<string, string> = {
    telegram: "org.telegram.desktop",
    discord: "discord",
    spotify: "spotify",
    firefox: "firefox",
    chrome: "google-chrome",
    chromium: "chromium",
    code: "code",
    vscode: "code",
    slack: "slack",
    steam: "steam",
    vlc: "vlc",
    terminal: "utilities-terminal",
    system: "preferences-system-notifications",
    hyprconnect: "hyprconnect",
  }

  for (const [key, iconName] of Object.entries(appMap)) {
    if (lower.includes(key)) {
      if (theme && theme.has_icon(iconName)) {
        return new Gtk.Image({
          iconName,
          pixelSize: 24,
          hexpand: true,
          vexpand: true,
          halign: Gtk.Align.CENTER,
          valign: Gtk.Align.CENTER,
        })
      }
    }
  }

  // 4. Default symbolic
  if (theme && theme.has_icon("preferences-system-notifications")) {
    return new Gtk.Image({
      iconName: "preferences-system-notifications",
      pixelSize: 24,
      hexpand: true,
      vexpand: true,
      halign: Gtk.Align.CENTER,
      valign: Gtk.Align.CENTER,
    })
  }

  return new Gtk.Label({
    label: "󰂚",
    hexpand: true,
    vexpand: true,
    halign: Gtk.Align.CENTER,
    valign: Gtk.Align.CENTER,
    cssClasses: ["popup-fallback-icon"],
  })
}

function createPopupCard(item: NotificationItem, onDismissed: () => void): Gtk.Revealer {
  const revealer = new Gtk.Revealer({
    transition_type: Gtk.RevealerTransitionType.SLIDE_DOWN,
    transition_duration: 240,
    reveal_child: true,
  })

  const card = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 8,
    cssClasses: ["popup-card", "slide-in"],
  })
  card.set_cursor_from_name("pointer")

  // Timer & state management
  let isDismissing = false
  let timerSourceId = 0
  let isHovered = false
  let isReplying = false
  let preventActivation = false

  // Left-click on card activates the corresponding app
  const cardClick = new Gtk.GestureClick()
  cardClick.connect("released", () => {
    if (preventActivation || isReplying || isDismissing) {
      preventActivation = false
      return
    }
    if (cardClick.get_current_button() === Gdk.BUTTON_PRIMARY) {
      notifService.activateNotification(item.id, item.appName, item.desktopEntry)
      dismissCard()
    }
  })
  card.add_controller(cardClick)

  if (item.urgency === 2) {
    card.add_css_class("critical")
  }

  // Trigger smooth entrance animation on next frame
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 20, () => {
    card.remove_css_class("slide-in")
    return false
  })

  const cancelTimer = () => {
    if (timerSourceId) {
      GLib.source_remove(timerSourceId)
      timerSourceId = 0
    }
  }

  const dismissCard = () => {
    if (isDismissing) return
    isDismissing = true
    cancelTimer()

    if (isReplying) {
      isReplying = false
      const win = app.get_window("notification-popups") as any
      if (win && win.set_keymode) win.set_keymode(Astal.Keymode.NONE)
    }

    card.add_css_class("slide-out")

    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 220, () => {
      revealer.set_reveal_child(false)
      return false
    })

    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 460, () => {
      onDismissed()
      return false
    })
  }

  const startTimer = (delayMs: number) => {
    cancelTimer()
    timerSourceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delayMs, () => {
      timerSourceId = 0
      if (!isHovered) {
        dismissCard()
      }
      return false
    })
  }

  // Top row: App Icon, App Name, Time, Close Button
  const topRow = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 10,
    valign: Gtk.Align.CENTER,
  })

  const iconBox = new Gtk.CenterBox({
    cssClasses: ["popup-icon-box"],
    halign: Gtk.Align.CENTER,
    valign: Gtk.Align.CENTER,
    widthRequest: 38,
    heightRequest: 38,
  })
  iconBox.set_center_widget(getAppIconWidget(item.appName, item.appIcon))
  topRow.append(iconBox)

  const metaBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    valign: Gtk.Align.CENTER,
    hexpand: true,
  })

  const appLbl = new Gtk.Label({
    label: item.appName,
    halign: Gtk.Align.START,
    cssClasses: ["popup-app-name"],
  })
  metaBox.append(appLbl)

  const timeLbl = new Gtk.Label({
    label: item.time,
    halign: Gtk.Align.START,
    cssClasses: ["popup-time"],
  })
  metaBox.append(timeLbl)
  topRow.append(metaBox)

  const closeBtn = new Gtk.Button({
    cssClasses: ["popup-close-btn"],
    valign: Gtk.Align.CENTER,
    halign: Gtk.Align.CENTER,
    widthRequest: 28,
    heightRequest: 28,
    child: new Gtk.Label({
      label: "󰅖",
      halign: Gtk.Align.CENTER,
      valign: Gtk.Align.CENTER,
    }),
  })
  const closePress = new Gtk.GestureClick()
  closePress.connect("pressed", () => {
    preventActivation = true
  })
  closeBtn.add_controller(closePress)
  closeBtn.connect("clicked", () => {
    dismissCard()
  })
  topRow.append(closeBtn)

  card.append(topRow)

  // Content: Summary & Body
  const contentBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  })

  if (item.summary) {
    const sumLbl = new Gtk.Label({
      label: item.summary,
      halign: Gtk.Align.START,
      wrap: true,
      xalign: 0,
      cssClasses: ["popup-summary"],
    })
    contentBox.append(sumLbl)
  }

  if (item.body) {
    const bodyLbl = new Gtk.Label({
      label: item.body,
      halign: Gtk.Align.START,
      wrap: true,
      xalign: 0,
      cssClasses: ["popup-body"],
    })
    contentBox.append(bodyLbl)
  }

  // Image attachment (if provided by notification)
  if (item.image && GLib.file_test(item.image, GLib.FileTest.EXISTS)) {
    const imgPic = Gtk.Picture.new_for_filename(item.image)
    imgPic.can_shrink = true
    imgPic.add_css_class("popup-image")
    contentBox.append(imgPic)
  }

  card.append(contentBox)

  // Action Buttons & Inline Reply
  if (item.actions && item.actions.length > 0) {
    const sortedActions = [...item.actions].sort((a, b) => {
      if (a.label === "Reply") return 1
      if (b.label === "Reply") return -1
      return 0
    })
    const hasSingleReply = sortedActions.length === 1 && sortedActions[0].label === "Reply"

    const actionsBox = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 8,
      homogeneous: !hasSingleReply,
      hexpand: true,
      halign: hasSingleReply ? Gtk.Align.END : Gtk.Align.FILL,
      cssClasses: ["popup-actions"],
      marginTop: 6,
    })

    const replyRevealer = new Gtk.Revealer({
      transition_type: Gtk.RevealerTransitionType.SLIDE_DOWN,
      transition_duration: 180,
      reveal_child: false,
      hexpand: true,
    })

    const replyBox = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 6,
      hexpand: true,
      cssClasses: ["popup-reply-box"],
      marginTop: 4,
    })

    const replyEntry = new Gtk.Entry({
      placeholderText: "Type a reply...",
      hexpand: true,
      cssClasses: ["popup-reply-entry"],
    })

    const sendBtn = new Gtk.Button({
      cssClasses: ["popup-send-btn"],
      valign: Gtk.Align.CENTER,
      halign: Gtk.Align.CENTER,
      child: new Gtk.Label({
        label: "Send",
        halign: Gtk.Align.CENTER,
        valign: Gtk.Align.CENTER,
      }),
    })

    const doSendReply = () => {
      const text = replyEntry.get_text().trim()
      if (text.length > 0) {
        notifService.sendReply(item.id, text)
        dismissCard()
      }
    }

    replyEntry.connect("activate", () => {
      doSendReply()
    })

    sendBtn.connect("clicked", () => {
      doSendReply()
    })

    const entryKeyCtrl = new Gtk.EventControllerKey()
    entryKeyCtrl.connect("key-pressed", (_, keyval) => {
      if (keyval === 65307 || keyval === Gdk.KEY_Escape) {
        isReplying = false
        const win = app.get_window("notification-popups") as any
        if (win && win.set_keymode) win.set_keymode(Astal.Keymode.NONE)
        replyRevealer.set_reveal_child(false)
        actionsBox.show()
        startTimer(3500)
        return true
      }
      return false
    })
    replyEntry.add_controller(entryKeyCtrl)

    const replyPress = new Gtk.GestureClick()
    replyPress.connect("pressed", () => {
      preventActivation = true
    })
    replyBox.add_controller(replyPress)

    replyBox.append(replyEntry)
    replyBox.append(sendBtn)
    replyRevealer.set_child(replyBox)

    sortedActions.forEach((act) => {
      const actBtn = new Gtk.Button({
        cssClasses: ["popup-action-btn"],
        label: act.label,
        hexpand: !hasSingleReply,
      })
      const actPress = new Gtk.GestureClick()
      actPress.connect("pressed", () => {
        preventActivation = true
      })
      actBtn.add_controller(actPress)

      if (act.label === "Reply") {
        actBtn.add_css_class("primary")
        actBtn.connect("clicked", () => {
          isReplying = true
          const win = app.get_window("notification-popups") as any
          if (win && win.set_keymode) win.set_keymode(Astal.Keymode.ON_DEMAND)
          cancelTimer()
          actionsBox.hide()
          replyRevealer.set_reveal_child(true)
          GLib.timeout_add(GLib.PRIORITY_DEFAULT, 80, () => {
            replyEntry.grab_focus()
            return false
          })
        })
      } else {
        actBtn.connect("clicked", () => {
          notifService.invokeAction(item.id, act.id)
          dismissCard()
        })
      }
      actionsBox.append(actBtn)
    })

    card.append(actionsBox)
    card.append(replyRevealer)
  }

  // Hover Pause Controller
  const motion = new Gtk.EventControllerMotion()
  motion.connect("enter", () => {
    isHovered = true
    cancelTimer()
  })
  motion.connect("leave", () => {
    isHovered = false
    startTimer(3200)
  })
  card.add_controller(motion)

  // Start auto-dismiss timer
  const initialDelay = Math.max(item.timeout || 5000, 3500)
  startTimer(initialDelay)

  revealer.set_child(card)
  return revealer
}

export default function NotificationPopups(gdkmonitor: Gdk.Monitor) {
  const { TOP, RIGHT } = Astal.WindowAnchor

  return (
    <window
      visible={notifService.popups((ps) => ps.length > 0)}
      name="notification-popups"
      namespace="notification-popups"
      class="NotificationPopups"
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.NONE}
      layer={Astal.Layer.OVERLAY}
      anchor={TOP | RIGHT}
      margin-top={POPUP_CONFIG.marginTop}
      margin-right={POPUP_CONFIG.marginRight}
      application={app}
    >
      <box
        class="notification-popups-container"
        orientation={Gtk.Orientation.VERTICAL}
        spacing={10}
        $={(container) => {
          const activeMap = new Map<number, Gtk.Revealer>()

          const syncPopups = (items: NotificationItem[]) => {
            const currentIds = new Set(items.map((i) => i.id))

            // Remove cards that are no longer in items
            for (const [id, rev] of activeMap.entries()) {
              if (!currentIds.has(id)) {
                activeMap.delete(id)
                if (rev.get_parent() === container) {
                  container.remove(rev)
                }
              }
            }

            // Add new cards in order
            items.forEach((item) => {
              if (!activeMap.has(item.id)) {
                const rev = createPopupCard(item, () => {
                  activeMap.delete(item.id)
                  if (rev.get_parent() === container) {
                    container.remove(rev)
                  }
                  notifService.dismissPopup(item.id)
                })
                activeMap.set(item.id, rev)
                container.prepend(rev)
              }
            })
          }

          notifService.popups.subscribe(() => {
            syncPopups(notifService.popups())
          })
          syncPopups(notifService.popups())
        }}
      />
    </window>
  )
}

