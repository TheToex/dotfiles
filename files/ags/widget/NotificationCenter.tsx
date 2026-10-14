import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createPoll } from "ags/time"
import { execAsync } from "ags/process"
import { notifService, NotificationItem } from "../service/notifications"
import { globalState } from "../utils"
import GLib from "gi://GLib"

export default function NotificationCenter(gdkmonitor: Gdk.Monitor) {
  const { TOP, BOTTOM, RIGHT } = Astal.WindowAnchor

  // Uptime poll
  const uptime = createPoll("󰔛 starting...", 30000, () =>
    execAsync("uptime -p")
      .then((u) => u.trim().replace(/^up\s+/, "󰔛 "))
      .catch(() => "󰔛 online")
  )

  // Wi-Fi poll
  const wifiState = createPoll({ enabled: true, ssid: "Checking..." }, 2000, () =>
    Promise.all([
      execAsync("nmcli radio wifi").catch(() => "disabled"),
      execAsync("nmcli -t -f ACTIVE,SSID dev wifi").catch(() => ""),
    ])
      .then(([radio, dev]) => {
        const enabled = radio.trim() === "enabled"
        if (!enabled) return { enabled: false, ssid: "Turned Off" }
        const activeLine = dev.split("\n").find((l) => l.startsWith("yes:"))
        const ssid = activeLine ? activeLine.split(":")[1] || "Connected" : "Disconnected"
        return { enabled: true, ssid }
      })
      .catch(() => ({ enabled: false, ssid: "Offline" }))
  )

  // Bluetooth poll
  const btState = createPoll({ enabled: true, device: "Checking..." }, 2000, () =>
    Promise.all([
      execAsync("bluetoothctl show").catch(() => ""),
      execAsync("bluetoothctl info").catch(() => ""),
    ])
      .then(([show, info]) => {
        const enabled = show.includes("Powered: yes")
        if (!enabled) return { enabled: false, device: "Turned Off" }
        const nameMatch = info.match(/Name: (.*)/)
        const device = nameMatch ? nameMatch[1] : "On"
        return { enabled: true, device }
      })
      .catch(() => ({ enabled: false, device: "Off" }))
  )

  // Power Profile poll
  const powerProfile = createPoll("balanced", 3000, () =>
    execAsync("powerprofilesctl get")
      .then((p) => p.trim())
      .catch(() => "balanced")
  )

  // Media Player poll
  const mediaState = createPoll(
    { active: false, title: "No media", artist: "Idle", status: "Stopped" },
    1500,
    () =>
      execAsync("playerctl metadata --format '{{title}};;;{{artist}};;;{{status}}'")
        .then((out) => {
          const parts = out.trim().split(";;;")
          if (parts.length >= 3 && parts[0]) {
            return {
              active: true,
              title: parts[0],
              artist: parts[1] || "Unknown Artist",
              status: parts[2] || "Playing",
            }
          }
          return { active: false, title: "No media playing", artist: "Idle", status: "Stopped" }
        })
        .catch(() => ({
          active: false,
          title: "No media playing",
          artist: "Idle",
          status: "Stopped",
        }))
  )

  return (
    <window
      visible={false}
      name="notification-center"
      namespace="notification-center"
      class="NotificationCenter"
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.NONE}
      layer={Astal.Layer.OVERLAY}
      anchor={TOP | BOTTOM | RIGHT}
      margin-top={47}
      margin-bottom={6}
      margin-right={6}
      application={app}
      $={(self) => {
        const ctrl = new Gtk.EventControllerKey()
        ctrl.connect("key-pressed", (_, keyval) => {
          if (keyval === 65307 || keyval === Gdk.KEY_Escape) {
            // Escape key
            self.hide()
            return true
          }
          return false
        })
        self.add_controller(ctrl)

        self.connect("notify::visible", () => {
          const bd = app.get_window("notification-center-backdrop")
          if (bd) {
            if (self.visible) bd.show()
            else bd.hide()
          }
        })
      }}
    >
      <box
        class="drawer"
        orientation={Gtk.Orientation.VERTICAL}
        widthRequest={420}
        vexpand={true}
        spacing={14}
      >
        {/* =========================================
            HEADER: USER PROFILE & ACTIONS
        ========================================= */}
        <box class="cc-header" spacing={12} valign={Gtk.Align.CENTER}>
          <box
            class="cc-avatar"
            halign={Gtk.Align.CENTER}
            valign={Gtk.Align.CENTER}
            $={(self) => {
              const pic = Gtk.Picture.new_for_filename("/home/toex/.config/ags/assets/avatar.png")
              pic.can_shrink = true
              self.append(pic)
            }}
          />
          <box orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER} hexpand={true}>
            <label
              class="cc-username"
              label="Toex"
              halign={Gtk.Align.START}
              css="font-weight: 900; font-size: 1.1em;"
            />
            <label
              class="cc-uptime"
              label={uptime}
              halign={Gtk.Align.START}
              css="font-size: 0.85em; opacity: 0.65;"
            />
          </box>
          <box spacing={6} halign={Gtk.Align.END} valign={Gtk.Align.CENTER}>
            {/* Hyprlock */}
            <button
              class="cc-header-btn"
              tooltipText="Lock Screen"
              onClicked={() => execAsync("hyprlock").catch(() => {})}
            >
              <label label="" css="font-size: 1.1em;" />
            </button>
            {/* Screenshot */}
            <button
              class="cc-header-btn"
              tooltipText="Snip Screenshot"
              onClicked={() => {
                const w = app.get_window("notification-center")
                if (w) w.hide()
                execAsync('grim -g "$(slurp)" - | wl-copy').catch(() => {})
              }}
            >
              <label label="" css="font-size: 1.1em;" />
            </button>
            {/* Close Drawer */}
            <button
              class="cc-header-btn close-btn"
              tooltipText="Close"
              onClicked={() => {
                const w = app.get_window("notification-center")
                if (w) w.hide()
              }}
            >
              <label label="󰅖" css="font-size: 1.2em;" />
            </button>
          </box>
        </box>

        {/* =========================================
            QUICK SETTINGS TOGGLES (2x2 Grid)
        ========================================= */}
        <box orientation={Gtk.Orientation.VERTICAL} spacing={8}>
          {/* Row 1: Wi-Fi & Bluetooth */}
          <box spacing={8} homogeneous={true}>
            {/* Wi-Fi Card */}
            <button
              class={wifiState((s) => (s.enabled ? "cc-toggle active" : "cc-toggle"))}
              onClicked={() => {
                execAsync("nmcli radio wifi").then((r) => {
                  const next = r.trim() === "enabled" ? "off" : "on"
                  return execAsync(`nmcli radio wifi ${next}`)
                })
              }}
            >
              <box spacing={10} valign={Gtk.Align.CENTER}>
                <label
                  label={wifiState((s) => (s.enabled ? "" : "󰤭"))}
                  class="cc-toggle-icon"
                  css="font-size: 1.35em; font-weight: 900;"
                />
                <box orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER} hexpand={true}>
                  <label
                    label="Wi-Fi"
                    class="cc-toggle-title"
                    halign={Gtk.Align.START}
                    css="font-weight: bold; font-size: 0.95em;"
                  />
                  <label
                    label={wifiState((s) => s.ssid)}
                    class="cc-toggle-sub"
                    halign={Gtk.Align.START}
                    css="font-size: 0.78em; opacity: 0.7;"
                    maxWidthChars={12}
                    ellipsize={3}
                  />
                </box>
              </box>
            </button>

            {/* Bluetooth Card */}
            <button
              class={btState((s) => (s.enabled ? "cc-toggle active" : "cc-toggle"))}
              onClicked={() => {
                execAsync("bluetoothctl show").then((show) => {
                  const powered = show.includes("Powered: yes")
                  return execAsync(`bluetoothctl power ${powered ? "off" : "on"}`)
                })
              }}
            >
              <box spacing={10} valign={Gtk.Align.CENTER}>
                <label
                  label={btState((s) => (s.enabled ? "󰂯" : "󰂲"))}
                  class="cc-toggle-icon"
                  css="font-size: 1.35em; font-weight: 900;"
                />
                <box orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER} hexpand={true}>
                  <label
                    label="Bluetooth"
                    class="cc-toggle-title"
                    halign={Gtk.Align.START}
                    css="font-weight: bold; font-size: 0.95em;"
                  />
                  <label
                    label={btState((s) => s.device)}
                    class="cc-toggle-sub"
                    halign={Gtk.Align.START}
                    css="font-size: 0.78em; opacity: 0.7;"
                    maxWidthChars={12}
                    ellipsize={3}
                  />
                </box>
              </box>
            </button>
          </box>

          {/* Row 2: DND & Power Profile */}
          <box spacing={8} homogeneous={true}>
            {/* DND Card */}
            <button
              class={notifService.dnd((dnd) => (dnd ? "cc-toggle active" : "cc-toggle"))}
              onClicked={() => notifService.toggleDnd()}
            >
              <box spacing={10} valign={Gtk.Align.CENTER}>
                <label
                  label={notifService.dnd((dnd) => (dnd ? "󰂛" : "󰂚"))}
                  class="cc-toggle-icon"
                  css="font-size: 1.35em; font-weight: 900;"
                />
                <box orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER} hexpand={true}>
                  <label
                    label="DND"
                    class="cc-toggle-title"
                    halign={Gtk.Align.START}
                    css="font-weight: bold; font-size: 0.95em;"
                  />
                  <label
                    label={notifService.dnd((dnd) => (dnd ? "Silent" : "Notifications"))}
                    class="cc-toggle-sub"
                    halign={Gtk.Align.START}
                    css="font-size: 0.78em; opacity: 0.7;"
                  />
                </box>
              </box>
            </button>

            {/* Power Profile Card */}
            <button
              class={powerProfile((p) => `cc-toggle active-${p}`)}
              onClicked={() => {
                const current = powerProfile.get()
                const next =
                  current === "power-saver"
                    ? "balanced"
                    : current === "balanced"
                    ? "performance"
                    : "power-saver"
                execAsync(`powerprofilesctl set ${next}`).catch(() => {})
              }}
            >
              <box spacing={10} valign={Gtk.Align.CENTER}>
                <label
                  label=""
                  class="cc-toggle-icon"
                  css="font-size: 1.35em; font-weight: 900;"
                />
                <box orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER} hexpand={true}>
                  <label
                    label="Profile"
                    class="cc-toggle-title"
                    halign={Gtk.Align.START}
                    css="font-weight: bold; font-size: 0.95em;"
                  />
                  <label
                    label={powerProfile((p) =>
                      p === "power-saver"
                        ? "Power Saver"
                        : p === "balanced"
                        ? "Balanced"
                        : "Performance"
                    )}
                    class="cc-toggle-sub"
                    halign={Gtk.Align.START}
                    css="font-size: 0.78em; opacity: 0.7;"
                  />
                </box>
              </box>
            </button>
          </box>
        </box>

        {/* =========================================
            SLIDERS: VOLUME & BRIGHTNESS
        ========================================= */}
        <box class="cc-sliders" orientation={Gtk.Orientation.VERTICAL} spacing={10}>
          {/* Volume Slider Card */}
          <box class="cc-slider-card" spacing={12} valign={Gtk.Align.CENTER}>
            <button
              class="cc-slider-icon-btn"
              onClicked={() => execAsync("wpctl set-mute @DEFAULT_AUDIO_SINK@ toggle").catch(() => {})}
            >
              <label
                css="font-size: 1.25em; font-weight: 900;"
                $={(lbl) => {
                  const volPoll = createPoll("󰕾", 200, () =>
                    execAsync("wpctl get-volume @DEFAULT_AUDIO_SINK@")
                      .then((out) => {
                        if (out.includes("MUTED")) return "󰝟"
                        const v = parseFloat(out.split(":")[1]) || 0
                        if (v === 0) return "󰝟"
                        if (v < 0.33) return "󰕿"
                        if (v < 0.66) return "󰖀"
                        return "󰕾"
                      })
                      .catch(() => "󰕾")
                  )
                  volPoll.subscribe(() => {
                    lbl.label = volPoll.get()
                  })
                }}
              />
            </button>

            <box hexpand={true} $={(box) => {
              const adj = new Gtk.Adjustment({ lower: 0, upper: 100, stepIncrement: 1, value: 50 })
              const scale = new Gtk.Scale({
                orientation: Gtk.Orientation.HORIZONTAL,
                adjustment: adj,
                drawValue: false,
                hexpand: true,
              })

              let updating = false
              let timeoutId = 0
              scale.connect("value-changed", () => {
                if (updating) return
                const v = Math.round(scale.get_value())
                if (timeoutId) GLib.source_remove(timeoutId)
                timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 30, () => {
                  execAsync(`wpctl set-volume @DEFAULT_AUDIO_SINK@ ${v / 100}`).catch(() => {})
                  if (v === 0) execAsync("wpctl set-mute @DEFAULT_AUDIO_SINK@ 1").catch(() => {})
                  else execAsync("wpctl set-mute @DEFAULT_AUDIO_SINK@ 0").catch(() => {})
                  timeoutId = 0
                  return false
                })
              })

              const poll = createPoll(50, 200, () =>
                execAsync("wpctl get-volume @DEFAULT_AUDIO_SINK@")
                  .then((out) => {
                    if (out.includes("MUTED")) return 0
                    const parts = out.split(":")
                    if (parts.length < 2) return 50
                    const v = parseFloat(parts[1])
                    return isNaN(v) ? 50 : Math.round(v * 100)
                  })
                  .catch(() => 50)
              )

              poll.subscribe(() => {
                if (scale.get_state_flags() & Gtk.StateFlags.ACTIVE) return
                updating = true
                adj.set_value(poll.get())
                updating = false
              })

              box.append(scale)
            }} />

            <label
              class="cc-slider-value"
              css="font-size: 0.85em; font-weight: bold; min-width: 38px;"
              $={(lbl) => {
                const poll = createPoll("50%", 200, () =>
                  execAsync("wpctl get-volume @DEFAULT_AUDIO_SINK@")
                    .then((out) => {
                      if (out.includes("MUTED")) return "Muted"
                      const parts = out.split(":")
                      const v = parseFloat(parts[1])
                      return isNaN(v) ? "50%" : `${Math.round(v * 100)}%`
                    })
                    .catch(() => "50%")
                )
                poll.subscribe(() => {
                  lbl.label = poll.get()
                })
              }}
            />
          </box>

          {/* Brightness Slider Card */}
          {(() => {
            let iconLbl: Gtk.Label | null = null
            let valLbl: Gtk.Label | null = null
            let isDragging = false
            let isRunning = false
            let pendingVal: number | null = null

            const applyBrightness = (val: number) => {
              if (isRunning) {
                pendingVal = val
                return
              }
              isRunning = true
              execAsync(`brightnessctl -q set ${val}%`)
                .catch(() => {})
                .finally(() => {
                  isRunning = false
                  if (pendingVal !== null) {
                    const next = pendingVal
                    pendingVal = null
                    applyBrightness(next)
                  }
                })
            }

            const updateVisuals = (val: number) => {
              if (valLbl) valLbl.label = `${val}%`
              if (iconLbl) {
                if (val > 66) iconLbl.label = "󰃠"
                else if (val > 33) iconLbl.label = "󰃟"
                else iconLbl.label = "󰃞"
              }
            }

            return (
              <box class="cc-slider-card" spacing={12} valign={Gtk.Align.CENTER}>
                <button class="cc-slider-icon-btn">
                  <label
                    label="󰃠"
                    css="font-size: 1.25em; font-weight: 900;"
                    $={(lbl) => {
                      iconLbl = lbl
                      execAsync("brightnessctl -m")
                        .then((out) => {
                          const val = parseInt(out.split(",")[3]) || 100
                          updateVisuals(val)
                        })
                        .catch(() => {})
                    }}
                  />
                </button>

                <box hexpand={true} $={(box) => {
                  const adj = new Gtk.Adjustment({ lower: 5, upper: 100, stepIncrement: 1, value: 100 })
                  const scale = new Gtk.Scale({
                    orientation: Gtk.Orientation.HORIZONTAL,
                    adjustment: adj,
                    drawValue: false,
                    hexpand: true,
                  })

                  const click = new Gtk.GestureClick()
                  click.connect("pressed", () => { isDragging = true })
                  click.connect("released", () => { isDragging = false })
                  scale.add_controller(click)

                  let updating = false
                  scale.connect("value-changed", () => {
                    if (updating) return
                    const v = Math.round(scale.get_value())
                    updateVisuals(v)
                    applyBrightness(v)
                  })

                  const poll = createPoll(100, 500, () =>
                    execAsync("brightnessctl -m")
                      .then((out) => {
                        const val = parseInt(out.split(",")[3])
                        return isNaN(val) ? 100 : val
                      })
                      .catch(() => 100)
                  )

                  poll.subscribe(() => {
                    if (isDragging || (scale.get_state_flags() & Gtk.StateFlags.ACTIVE)) return
                    updating = true
                    const cur = poll.get()
                    adj.set_value(cur)
                    updateVisuals(cur)
                    updating = false
                  })

                  execAsync("brightnessctl -m")
                    .then((out) => {
                      const val = parseInt(out.split(",")[3])
                      if (!isNaN(val)) {
                        updating = true
                        adj.set_value(val)
                        updateVisuals(val)
                        updating = false
                      }
                    })
                    .catch(() => {})

                  box.append(scale)
                }} />

                <label
                  class="cc-slider-value"
                  label="100%"
                  css="font-size: 0.85em; font-weight: bold; min-width: 38px;"
                  $={(lbl) => {
                    valLbl = lbl
                  }}
                />
              </box>
            )
          })()}
        </box>

        {/* =========================================
            MEDIA PLAYER CARD (MPRIS)
        ========================================= */}
        <box class="cc-media-card" spacing={12} valign={Gtk.Align.CENTER}>
          <box class="cc-media-art" halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
            <label
              label={mediaState((m) => (m.active ? "" : "󰝚"))}
              css="font-size: 1.4em; color: #cba6f7;"
            />
          </box>
          <box orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER} hexpand={true}>
            <label
              class="cc-media-title"
              label={mediaState((m) => m.title)}
              halign={Gtk.Align.START}
              css="font-weight: bold; font-size: 0.95em;"
              maxWidthChars={20}
              ellipsize={3}
            />
            <label
              class="cc-media-artist"
              label={mediaState((m) => m.artist)}
              halign={Gtk.Align.START}
              css="font-size: 0.8em; opacity: 0.7;"
              maxWidthChars={22}
              ellipsize={3}
            />
          </box>
          <box spacing={4} halign={Gtk.Align.END} valign={Gtk.Align.CENTER}>
            <button
              class="cc-media-btn"
              tooltipText="Previous"
              onClicked={() => execAsync("playerctl previous").catch(() => {})}
            >
              <label label="󰒮" css="font-size: 1.1em;" />
            </button>
            <button
              class="cc-media-btn play-btn"
              tooltipText="Play/Pause"
              onClicked={() => execAsync("playerctl play-pause").catch(() => {})}
            >
              <label
                label={mediaState((m) => (m.status === "Playing" ? "󰏤" : "󰐊"))}
                css="font-size: 1.2em;"
              />
            </button>
            <button
              class="cc-media-btn"
              tooltipText="Next"
              onClicked={() => execAsync("playerctl next").catch(() => {})}
            >
              <label label="󰒭" css="font-size: 1.1em;" />
            </button>
          </box>
        </box>

        {/* =========================================
            SEPARATOR / NOTIFICATION SECTION HEADER
        ========================================= */}
        <box class="notif-header" spacing={8} valign={Gtk.Align.CENTER} margin-top={4}>
          <label
            label="Notifications"
            class="notif-title"
            halign={Gtk.Align.START}
            css="font-size: 1.05em; font-weight: 900;"
          />
          <label
            label={notifService.notifications((ns) => (ns.length > 0 ? `${ns.length}` : ""))}
            visible={notifService.notifications((ns) => ns.length > 0)}
            class="notif-badge"
            css="font-size: 0.8em; font-weight: bold; background: #89b4fa; color: #11111b; border-radius: 99px; padding: 1px 7px;"
          />
          <box hexpand={true} />
          <button
            class="notif-clear-btn"
            visible={notifService.notifications((ns) => ns.length > 0)}
            onClicked={() => notifService.clearAll()}
          >
            <box spacing={4} valign={Gtk.Align.CENTER}>
              <label label="󰎟" css="font-size: 0.9em;" />
              <label label="Clear All" css="font-size: 0.85em; font-weight: bold;" />
            </box>
          </button>
        </box>

        {/* =========================================
            NOTIFICATION LIST (SCROLLABLE AREA)
        ========================================= */}
        <Gtk.ScrolledWindow
          class="notif-scroll"
          vexpand={true}
          hscrollbarPolicy={Gtk.PolicyType.NEVER}
        >
          <box
            class="notif-list"
            orientation={Gtk.Orientation.VERTICAL}
            spacing={8}
            $={(listBox) => {
              const render = (items: NotificationItem[]) => {
                while (listBox.get_first_child()) {
                  listBox.remove(listBox.get_first_child()!)
                }

                if (items.length === 0) {
                  const emptyBox = new Gtk.Box({
                    orientation: Gtk.Orientation.VERTICAL,
                    halign: Gtk.Align.CENTER,
                    valign: Gtk.Align.CENTER,
                    spacing: 8,
                    vexpand: true,
                    marginTop: 48,
                    marginBottom: 48,
                  })
                  const icon = new Gtk.Label({
                    label: "󰂚",
                    cssClasses: ["notif-empty-icon"],
                  })
                  const title = new Gtk.Label({
                    label: "No Notifications",
                    cssClasses: ["notif-empty-title"],
                  })
                  const sub = new Gtk.Label({
                    label: "You're all caught up!",
                    cssClasses: ["notif-empty-sub"],
                  })
                  emptyBox.append(icon)
                  emptyBox.append(title)
                  emptyBox.append(sub)
                  listBox.append(emptyBox)
                  return
                }

                items.forEach((item) => {
                  const card = new Gtk.Box({
                    orientation: Gtk.Orientation.VERTICAL,
                    spacing: 6,
                    cssClasses: ["notification-card"],
                  })
                  if (item.urgency === 2) card.add_css_class("critical")

                  // Top row
                  const topRow = new Gtk.Box({
                    orientation: Gtk.Orientation.HORIZONTAL,
                    spacing: 8,
                    valign: Gtk.Align.CENTER,
                  })

                  const appLbl = new Gtk.Label({
                    label: item.appName,
                    halign: Gtk.Align.START,
                    cssClasses: ["notif-card-app"],
                  })
                  topRow.append(appLbl)

                  const spacer = new Gtk.Box({ hexpand: true })
                  topRow.append(spacer)

                  const timeLbl = new Gtk.Label({
                    label: item.time,
                    halign: Gtk.Align.END,
                    cssClasses: ["notif-card-time"],
                  })
                  topRow.append(timeLbl)

                  const closeBtn = new Gtk.Button({
                    cssClasses: ["notif-card-close"],
                    child: new Gtk.Label({ label: "󰅖" }),
                  })
                  closeBtn.connect("clicked", () => {
                    notifService.dismiss(item.id)
                  })
                  topRow.append(closeBtn)

                  card.append(topRow)

                  // Summary
                  if (item.summary) {
                    const sumLbl = new Gtk.Label({
                      label: item.summary,
                      halign: Gtk.Align.START,
                      wrap: true,
                      xalign: 0,
                      cssClasses: ["notif-card-summary"],
                    })
                    card.append(sumLbl)
                  }

                  // Body
                  if (item.body) {
                    const bodyLbl = new Gtk.Label({
                      label: item.body,
                      halign: Gtk.Align.START,
                      wrap: true,
                      xalign: 0,
                      cssClasses: ["notif-card-body"],
                    })
                    card.append(bodyLbl)
                  }

                  listBox.append(card)
                })
              }

              notifService.notifications.subscribe(() => render(notifService.notifications()))
              render(notifService.notifications())
            }}
          />
        </Gtk.ScrolledWindow>
      </box>
    </window>
  )
}

export function NotificationCenterBackdrop(gdkmonitor: Gdk.Monitor) {
  const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor
  return (
    <window
      visible={false}
      name="notification-center-backdrop"
      namespace="notification-center-backdrop"
      class="NotificationCenterBackdrop"
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.NONE}
      layer={Astal.Layer.TOP}
      anchor={TOP | BOTTOM | LEFT | RIGHT}
      margin-top={44}
      application={app}
      $={(self) => {
        const click = new Gtk.GestureClick()
        click.connect("pressed", () => {
          const w = app.get_window("notification-center")
          if (w) w.hide()
        })
        self.add_controller(click)

        const ctrl = new Gtk.EventControllerKey()
        ctrl.connect("key-pressed", (_, keyval) => {
          if (keyval === 65307 || keyval === Gdk.KEY_Escape) {
            const w = app.get_window("notification-center")
            if (w) w.hide()
            return true
          }
          return false
        })
        self.add_controller(ctrl)
      }}
    >
      <button
        hexpand={true}
        vexpand={true}
        css="background: rgba(0, 0, 0, 0.01); border: none; outline: none; box-shadow: none;"
        onClicked={() => {
          const w = app.get_window("notification-center")
          if (w) w.hide()
        }}
      />
    </window>
  )
}

