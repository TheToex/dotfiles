import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createPoll, interval } from "ags/time"
import { execAsync } from "ags/process"
import { createState } from "ags"
import { notifService, NotificationItem } from "../service/notifications"
import { audioService } from "../service/audio"
import { globalState } from "../utils"
import GLib from "gi://GLib"

let activeClearAll: (() => void) | null = null
let activeDismissFirst: (() => void) | null = null

export function triggerClearAll() {
  if (activeClearAll) activeClearAll()
  else notifService.clearAll()
}

export function triggerDismissFirst() {
  if (activeDismissFirst) activeDismissFirst()
}

export default function NotificationCenter(gdkmonitor: Gdk.Monitor) {
  const { TOP, BOTTOM, RIGHT } = Astal.WindowAnchor

  // Uptime poll
  const uptime = createPoll("󰔛 starting...", 30000, () => {
    const win = app.get_window("notification-center")
    if (!win || !win.visible) return "󰔛 online"
    return execAsync("uptime -p")
      .then((u) => u.trim().replace(/^up\s+/, "󰔛 "))
      .catch(() => "󰔛 online")
  })

  // Wi-Fi state & refresh
  const [wifiState, setWifiState] = createState({ enabled: true, ssid: "Checking..." })
  const refreshWifi = (force = false) => {
    const win = app.get_window("notification-center")
    if (!force && (!win || !win.visible)) return
    Promise.all([
      execAsync("nmcli radio wifi").catch(() => "disabled"),
      execAsync("nmcli -t -f ACTIVE,SSID dev wifi").catch(() => ""),
    ])
      .then(([radio, dev]) => {
        const enabled = radio.trim() === "enabled"
        if (!enabled) {
          setWifiState({ enabled: false, ssid: "Turned Off" })
          return
        }
        const activeLine = dev.split("\n").find((l) => l.startsWith("yes:"))
        const ssid = activeLine ? activeLine.split(":")[1] || "Connected" : "Disconnected"
        setWifiState({ enabled: true, ssid })
      })
      .catch(() => setWifiState({ enabled: false, ssid: "Offline" }))
  }
  interval(8000, () => refreshWifi(false))

  // Bluetooth state & refresh
  const [btState, setBtState] = createState({ enabled: true, device: "Checking..." })
  const refreshBt = (force = false) => {
    const win = app.get_window("notification-center")
    if (!force && (!win || !win.visible)) return
    Promise.all([
      execAsync("bluetoothctl show").catch(() => ""),
      execAsync("bluetoothctl info").catch(() => ""),
    ])
      .then(([show, info]) => {
        const enabled = show.includes("Powered: yes")
        if (!enabled) {
          setBtState({ enabled: false, device: "Turned Off" })
          return
        }
        const nameMatch = info.match(/Name: (.*)/)
        const device = nameMatch ? nameMatch[1] : "On"
        setBtState({ enabled: true, device })
      })
      .catch(() => setBtState({ enabled: false, device: "Off" }))
  }
  interval(8000, () => refreshBt(false))

  // Power Profile state & refresh
  const [powerProfile, setPowerProfile] = createState("balanced")
  const refreshPower = (force = false) => {
    const win = app.get_window("notification-center")
    if (!force && (!win || !win.visible)) return
    execAsync("powerprofilesctl get")
      .then((p) => setPowerProfile(p.trim()))
      .catch(() => {})
  }
  interval(10000, () => refreshPower(false))

  // Media Player state & refresh
  const [mediaState, setMediaState] = createState({
    active: false,
    title: "No media playing",
    artist: "Idle",
    status: "Stopped",
  })
  const refreshMedia = (force = false) => {
    const win = app.get_window("notification-center")
    if (!force && (!win || !win.visible)) return
    execAsync("playerctl metadata --format '{{title}};;;{{artist}};;;{{status}}'")
      .then((out) => {
        const parts = out.trim().split(";;;")
        if (parts.length >= 3 && parts[0]) {
          setMediaState({
            active: true,
            title: parts[0],
            artist: parts[1] || "Unknown Artist",
            status: parts[2] || "Playing",
          })
          return
        }
        setMediaState({ active: false, title: "No media playing", artist: "Idle", status: "Stopped" })
      })
      .catch(() => {
        setMediaState({
          active: false,
          title: "No media playing",
          artist: "Idle",
          status: "Stopped",
        })
      })
  }
  interval(3000, () => refreshMedia(false))

  let clearAllAnimated: (() => void) | null = null

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
          if (self.visible) {
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
              refreshWifi(true)
              refreshBt(true)
              refreshPower(true)
              refreshMedia(true)
              audioService.sync()
              return false
            })
          } else {
            const win = self as any
            if (win && win.set_keymode) win.set_keymode(Astal.Keymode.NONE)
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
                const cur = wifiState.peek()
                const nextEnabled = !cur.enabled
                setWifiState({
                  enabled: nextEnabled,
                  ssid: nextEnabled ? (cur.ssid === "Turned Off" ? "Connecting..." : cur.ssid) : "Turned Off",
                })
                execAsync(`nmcli radio wifi ${nextEnabled ? "on" : "off"}`)
                  .then(() => setTimeout(refreshWifi, 800))
                  .catch(() => refreshWifi())
              }}
            >
              <box spacing={10} valign={Gtk.Align.CENTER}>
                <label
                  label={wifiState((s) => (s.enabled ? "" : "󰤭"))}
                  class="cc-toggle-icon"
                  halign={Gtk.Align.CENTER}
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
                const cur = btState.peek()
                const nextPowered = !cur.enabled
                setBtState({
                  enabled: nextPowered,
                  device: nextPowered ? (cur.device === "Turned Off" ? "On" : cur.device) : "Turned Off",
                })
                execAsync(`bluetoothctl power ${nextPowered ? "on" : "off"}`)
                  .then(() => setTimeout(refreshBt, 600))
                  .catch(() => refreshBt())
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
                const current = powerProfile.peek()
                const next =
                  current === "power-saver"
                    ? "balanced"
                    : current === "balanced"
                    ? "performance"
                    : "power-saver"
                setPowerProfile(next)
                execAsync(`powerprofilesctl set ${next}`)
                  .then(() => setTimeout(refreshPower, 400))
                  .catch(() => refreshPower())
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
          {(() => {
            let iconLbl: Gtk.Label | null = null
            let valLbl: Gtk.Label | null = null
            let scaleAdj: Gtk.Adjustment | null = null
            let scaleWidget: Gtk.Scale | null = null
            let updatingFromService = false

            const syncUI = (s = audioService.getState()) => {
              if (valLbl) {
                valLbl.label = s.isMuted ? "Muted" : `${s.volume}%`
              }
              if (iconLbl) {
                iconLbl.label = s.volIcon
              }
              if (scaleAdj && scaleWidget) {
                const target = s.displayVolume
                if (Math.round(scaleWidget.get_value()) !== target) {
                  updatingFromService = true
                  scaleWidget.set_value(target)
                  scaleAdj.set_value(target)
                  updatingFromService = false
                }
              }
            }

            return (
              <box class="cc-slider-card" spacing={12} valign={Gtk.Align.CENTER}>
                <button
                  class="cc-slider-icon-btn"
                  onClicked={() => {
                    audioService.toggleMute()
                  }}
                >
                  <label
                    label={audioService.getState().volIcon}
                    css="font-size: 1.25em; font-weight: 900;"
                    $={(lbl) => {
                      iconLbl = lbl
                    }}
                  />
                </button>

                <box hexpand={true} $={(box) => {
                  const initialVal = audioService.getDisplayVolume()
                  const adj = new Gtk.Adjustment({ lower: 0, upper: 100, stepIncrement: 1, value: initialVal })
                  scaleAdj = adj

                  const scale = new Gtk.Scale({
                    orientation: Gtk.Orientation.HORIZONTAL,
                    adjustment: adj,
                    drawValue: false,
                    hexpand: true,
                  })
                  scaleWidget = scale

                  scale.connect("value-changed", () => {
                    if (updatingFromService) return
                    const v = Math.round(scale.get_value())
                    audioService.setVolume(v)
                    if (valLbl) valLbl.label = v === 0 ? "Muted" : `${v}%`
                    if (iconLbl) iconLbl.label = v === 0 ? "󰖁" : (v < 33 ? "󰕿" : (v < 66 ? "󰖀" : "󰕾"))
                  })

                  audioService.subscribe((s) => {
                    syncUI(s)
                  })

                  box.append(scale)
                }} />

                <label
                  class="cc-slider-value"
                  label={audioService.getState().isMuted ? "Muted" : `${audioService.getState().volume}%`}
                  css="font-size: 0.85em; font-weight: bold; min-width: 38px;"
                  $={(lbl) => {
                    valLbl = lbl
                  }}
                />
              </box>
            )
          })()}

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
                      const win = app.get_window("notification-center")
                      if (win && win.visible) {
                        execAsync("brightnessctl -m")
                          .then((out) => {
                            const val = parseInt(out.split(",")[3]) || 100
                            updateVisuals(val)
                          })
                          .catch(() => {})
                      }
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

                  const poll = createPoll(100, 1500, () => {
                    const win = app.get_window("notification-center")
                    if (!win || !win.visible) return Math.round(adj.get_value())
                    return execAsync("brightnessctl -m")
                      .then((out) => {
                        const val = parseInt(out.split(",")[3])
                        return isNaN(val) ? 100 : val
                      })
                      .catch(() => 100)
                  })

                  poll.subscribe(() => {
                    if (isDragging || (scale.get_state_flags() & Gtk.StateFlags.ACTIVE)) return
                    updating = true
                    const cur = poll.get()
                    adj.set_value(cur)
                    updateVisuals(cur)
                    updating = false
                  })

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
        <box class="cc-media-card" spacing={12} valign={Gtk.Align.CENTER} vexpand={false}>
          <button
            class="cc-media-art"
            focusable={false}
            canFocus={false}
            hexpand={false}
            vexpand={false}
            halign={Gtk.Align.CENTER}
            valign={Gtk.Align.CENTER}
            widthRequest={38}
            heightRequest={38}
          >
            <label
              label={mediaState((m) => (m.active ? "" : "󰝚"))}
              halign={Gtk.Align.CENTER}
              valign={Gtk.Align.CENTER}
              hexpand={false}
              vexpand={false}
            />
          </button>
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
              onClicked={() => {
                execAsync("playerctl previous")
                  .then(() => {
                    setTimeout(refreshMedia, 40)
                    setTimeout(refreshMedia, 180)
                  })
                  .catch(() => {})
              }}
            >
              <label label="󰒮" css="font-size: 1.1em;" />
            </button>
            <button
              class="cc-media-btn play-btn"
              tooltipText="Play/Pause"
              onClicked={() => {
                const cur = mediaState.peek()
                const nextStatus = cur.status === "Playing" ? "Paused" : "Playing"
                setMediaState({ ...cur, status: nextStatus })
                execAsync("playerctl play-pause")
                  .then(() => {
                    setTimeout(refreshMedia, 50)
                    setTimeout(refreshMedia, 220)
                  })
                  .catch(() => refreshMedia())
              }}
            >
              <label
                label={mediaState((m) => (m.status === "Playing" ? "󰏤" : "󰐊"))}
                css="font-size: 1.2em;"
              />
            </button>
            <button
              class="cc-media-btn"
              tooltipText="Next"
              onClicked={() => {
                execAsync("playerctl next")
                  .then(() => {
                    setTimeout(refreshMedia, 40)
                    setTimeout(refreshMedia, 180)
                  })
                  .catch(() => {})
              }}
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
            onClicked={() => {
              if (clearAllAnimated) clearAllAnimated()
              else notifService.clearAll()
            }}
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
              type DismissFn = (isBatch?: boolean) => void
              const cardDismissers = new Map<number, DismissFn>()
              let isClearing = false

              clearAllAnimated = () => {
                if (isClearing) return
                isClearing = true

                const entries = Array.from(cardDismissers.entries())
                if (entries.length === 0) {
                  isClearing = false
                  notifService.clearAll()
                  return
                }

                // Stagger dismissals by 70ms each
                entries.forEach(([id, dismissFn], idx) => {
                  GLib.timeout_add(GLib.PRIORITY_DEFAULT, idx * 70, () => {
                    dismissFn(true)
                    return false
                  })
                })

                // Once all animations finish, clear store once
                const totalDelay = (entries.length - 1) * 70 + 320
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, totalDelay, () => {
                  isClearing = false
                  notifService.clearAll()
                  return false
                })
              }

              activeClearAll = clearAllAnimated
              activeDismissFirst = () => {
                const first = cardDismissers.values().next().value
                if (first) first(false)
              }

              const render = (items: NotificationItem[]) => {
                if (isClearing) return

                cardDismissers.clear()

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
                  const revealer = new Gtk.Revealer({
                    transition_type: Gtk.RevealerTransitionType.SLIDE_UP,
                    transition_duration: 220,
                    reveal_child: true,
                  })

                  const card = new Gtk.Box({
                    orientation: Gtk.Orientation.VERTICAL,
                    spacing: 6,
                    cssClasses: ["notification-card"],
                  })
                  card.set_cursor_from_name("pointer")

                  let isDismissed = false
                  let isReplying = false
                  let preventActivation = false

                  // Left-click on card activates the corresponding app
                  const cardClick = new Gtk.GestureClick()
                  cardClick.connect("released", () => {
                    if (preventActivation || isReplying || isDismissed) {
                      preventActivation = false
                      return
                    }
                    if (cardClick.get_current_button() === Gdk.BUTTON_PRIMARY) {
                      notifService.activateNotification(item.id, item.appName, item.desktopEntry)
                      const w = app.get_window("notification-center")
                      if (w) w.hide()
                    }
                  })
                  card.add_controller(cardClick)

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
                  const closePress = new Gtk.GestureClick()
                  closePress.connect("pressed", () => {
                    preventActivation = true
                  })
                  closeBtn.add_controller(closePress)

                  const dismissThisCard: DismissFn = (isBatch = false) => {
                    if (isDismissed) return
                    isDismissed = true

                    card.add_css_class("dismissing")

                    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 90, () => {
                      revealer.set_reveal_child(false)
                      return false
                    })

                    if (!isBatch) {
                      GLib.timeout_add(GLib.PRIORITY_DEFAULT, 290, () => {
                        notifService.dismiss(item.id)
                        return false
                      })
                    }
                  }

                  cardDismissers.set(item.id, dismissThisCard)

                  closeBtn.connect("clicked", () => {
                    dismissThisCard(false)
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

                  // Image attachment
                  if (item.image && GLib.file_test(item.image, GLib.FileTest.EXISTS)) {
                    const imgPic = Gtk.Picture.new_for_filename(item.image)
                    imgPic.can_shrink = true
                    imgPic.add_css_class("notif-card-image")
                    card.append(imgPic)
                  }

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
                      cssClasses: ["notif-card-actions"],
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
                      cssClasses: ["notif-card-reply-box"],
                      marginTop: 4,
                    })

                    const replyEntry = new Gtk.Entry({
                      placeholderText: "Type a reply...",
                      hexpand: true,
                      cssClasses: ["notif-card-reply-entry"],
                    })

                    const sendBtn = new Gtk.Button({
                      cssClasses: ["notif-card-send-btn"],
                      valign: Gtk.Align.CENTER,
                      halign: Gtk.Align.CENTER,
                      child: new Gtk.Label({
                        label: "Send",
                        halign: Gtk.Align.CENTER,
                        valign: Gtk.Align.CENTER,
                      }),
                    })

                    const doSend = () => {
                      const text = replyEntry.get_text().trim()
                      if (text.length > 0) {
                        notifService.sendReply(item.id, text)
                        dismissThisCard(false)
                        const w = app.get_window("notification-center") as any
                        if (w && w.set_keymode) w.set_keymode(Astal.Keymode.NONE)
                      }
                    }

                    replyEntry.connect("activate", doSend)
                    sendBtn.connect("clicked", doSend)

                    const entryKeyCtrl = new Gtk.EventControllerKey()
                    entryKeyCtrl.connect("key-pressed", (_, keyval) => {
                      if (keyval === 65307 || keyval === Gdk.KEY_Escape) {
                        isReplying = false
                        replyRevealer.set_reveal_child(false)
                        actionsBox.show()
                        const w = app.get_window("notification-center") as any
                        if (w && w.set_keymode) w.set_keymode(Astal.Keymode.NONE)
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
                        cssClasses: ["notif-card-action-btn"],
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
                          const w = app.get_window("notification-center") as any
                          if (w && w.set_keymode) w.set_keymode(Astal.Keymode.ON_DEMAND)
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
                          dismissThisCard(false)
                        })
                      }
                      actionsBox.append(actBtn)
                    })

                    card.append(actionsBox)
                    card.append(replyRevealer)
                  }

                  revealer.set_child(card)
                  listBox.append(revealer)
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
      margin-top={46}
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

