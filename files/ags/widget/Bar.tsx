import { globalState } from "../utils"
import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { createPoll } from "ags/time"
import { notifService } from "../service/notifications"
import Tray from "gi://AstalTray"

function Workspaces() {
  const workspaces = createPoll([1, 2, 3, 4], 100, () => {
    return execAsync("hyprctl workspaces -j").then(out => {
      const parsed = JSON.parse(out)
      let ids = parsed.map((w: any) => w.id).filter((id: number) => id > 0)
      
      for (let i = 1; i <= 4; i++) {
        if (!ids.includes(i)) ids.push(i)
      }
      
      return ids.sort((a: number, b: number) => a - b)
    }).catch(() => [1, 2, 3, 4])
  })

  const active = createPoll(1, 100, () => {
    return execAsync("hyprctl activeworkspace -j").then(out => {
      return JSON.parse(out).id
    }).catch(() => 1)
  })

  const box = <box class="workspaces" valign={Gtk.Align.CENTER} halign={Gtk.Align.CENTER} /> as Gtk.Box

  let lastWssStr = "";
  
  const update = () => {
    const wss = workspaces.get()
    const act = active.get()
    const currentWssStr = wss.join(",")
    
    if (lastWssStr !== currentWssStr) {
      lastWssStr = currentWssStr;
      while (box.get_first_child()) {
        box.remove(box.get_first_child()!)
      }
      
      wss.forEach((ws: number) => {
        const btn = new Gtk.Button({
          valign: Gtk.Align.CENTER,
          halign: Gtk.Align.CENTER,
        })
        btn._ws = ws;
        const lbl = new Gtk.Label({ label: `${ws}`, valign: Gtk.Align.CENTER, halign: Gtk.Align.CENTER })
        btn.set_child(lbl)
        btn.connect("clicked", () => execAsync(`hyprctl eval "hl.dispatch(hl.dsp.focus({workspace=${ws}}))"`))
        box.append(btn)
      })
    }
    
    let child = box.get_first_child();
    while (child) {
        if (child._ws === act) {
            child.add_css_class("focused")
        } else {
            child.remove_css_class("focused")
        }
        child = child.get_next_sibling();
    }
  }

  workspaces.subscribe(update)
  active.subscribe(update)
  
  update()

  return box
}

function SysTray() {
  const tray = Tray.Tray.get_default()

  return (
    <box
      class="pill tray"
      valign={Gtk.Align.CENTER}
      halign={Gtk.Align.CENTER}
      spacing={4}
      $={(self) => {
        const update = () => {
          while (self.get_first_child()) {
            self.remove(self.get_first_child()!)
          }
          const items = tray.get_items() || []
          if (items.length === 0) {
            self.visible = false
            return
          }
          self.visible = true

          items.forEach((item: any) => {
            const btn = new Gtk.MenuButton({
              valign: Gtk.Align.CENTER,
              halign: Gtk.Align.CENTER,
              tooltipMarkup: item.tooltip_markup || item.title || "",
              hasFrame: false,
              menuModel: item.menu_model,
            })

            const img = new Gtk.Image({ pixelSize: 16 })
            if (item.gicon) {
              img.gicon = item.gicon
            } else if (item.icon_name) {
              img.icon_name = item.icon_name
            }
            btn.set_child(img)

            if (item.action_group) {
              btn.insert_action_group("dbusmenu", item.action_group)
            }

            const pop = btn.get_popover()
            if (pop) {
              pop.add_css_class("tray-menu")
              pop.set_has_arrow(false)
            }

            // Left click: activate the app (open/focus window)
            const leftGesture = new Gtk.GestureClick()
            leftGesture.set_propagation_phase(Gtk.PropagationPhase.CAPTURE)
            leftGesture.set_button(1)
            leftGesture.connect("pressed", (g: any, _n: number, x: number, y: number) => {
              g.set_state(Gtk.EventSequenceState.CLAIMED)
              item.activate(Math.round(x), Math.round(y))
            })
            btn.add_controller(leftGesture)

            // Right click: open tray menu
            const rightGesture = new Gtk.GestureClick()
            rightGesture.set_button(3)
            rightGesture.connect("pressed", () => {
              btn.popup()
            })
            btn.add_controller(rightGesture)

            // Middle click: secondary activate
            const middleGesture = new Gtk.GestureClick()
            middleGesture.set_button(2)
            middleGesture.connect("pressed", (_g: any, _n: number, x: number, y: number) => {
              item.secondary_activate(Math.round(x), Math.round(y))
            })
            btn.add_controller(middleGesture)

            self.append(btn)
          })
        }

        tray.connect("notify::items", update)
        tray.connect("item-added", update)
        tray.connect("item-removed", update)
        update()
      }}
    />
  )
}

function SysInfo() {
  const volIcon = createPoll("󰕾", 100, () => 
    execAsync("wpctl get-volume @DEFAULT_AUDIO_SINK@").then(out => {
      if (out.includes("MUTED")) return "󰖁"
      const v = parseFloat(out.split(":")[1]) * 100
      if (v === 0) return "󰖁"
      if (v < 33) return "󰕿"
      if (v < 66) return "󰖀"
      return "󰕾"
    }).catch(() => "󰕾")
  )

  const battery = createPoll("100%", 5000, () => 
    execAsync("cat /sys/class/power_supply/BAT0/capacity").then(c => c.trim() + "%").catch(() => "100%")
  )

  const wifiIcon = createPoll("", 1000, () => {
    return execAsync("nmcli radio wifi").then(radio => {
        if (radio.trim() !== "enabled") return "󰤭"; // Empty dot, no slash
        
        return execAsync("nmcli -t -f ACTIVE,SIGNAL dev wifi").then(out => {
            const activeLine = out.split("\n").find(line => line.startsWith("yes:"));
            if (!activeLine) return "󰤭";
            return "";
        }).catch(() => "󰤭");
    }).catch(() => "󰤭");
  })

  const btIcon = createPoll("󰂯", 2000, () => {
    return execAsync("bluetoothctl show").then(out => {
        if (out.includes("Powered: yes")) return "󰂯";
        return "󰂲";
    }).catch(() => "󰂲");
  });

  return (
    <box class="sysinfo" halign={Gtk.Align.END} valign={Gtk.Align.CENTER} spacing={8}>
      <SysTray />

      {/* Unified Quicksettings Pill: Bluetooth, Wifi, Audio */}
      <box class="pill quicksettings" valign={Gtk.Align.CENTER} spacing={2}>
        {/* Bluetooth Button */}
        <button 
          valign={Gtk.Align.CENTER} 
          onClicked={() => {
            const win = app.get_window("bluetooth-menu")
            if (win && win.visible) {
              win.hide();
            } else {
              const w = app.get_window("wifi-menu"); if(w) w.hide(); const bt = app.get_window("bluetooth-menu"); if(bt) bt.hide();
              const a = app.get_window("audio-menu"); if(a) a.hide();
              const p = app.get_window("power-menu"); if(p) p.hide();
              const b = app.get_window("battery-menu"); if(b) b.hide();
              const nc = app.get_window("notification-center"); if(nc) nc.hide();
              if(win) win.show();
            }
          }}
          $={(btn) => {
            const win = app.get_window("bluetooth-menu")
            if (win) {
              win.connect("notify::visible", () => {
                if (win.visible) {
                  btn.add_css_class("active")
                } else {
                  btn.remove_css_class("active")
                  globalState.lastHide["bluetooth-menu"] = Date.now()
                }
              })
            }
          }}
        >
          <label label={btIcon} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} css="font-size: 1.25em; font-weight: 900;" />
        </button>

        {/* Wifi Button */}
        <button 
          valign={Gtk.Align.CENTER} 
          onClicked={() => {
            const win = app.get_window("wifi-menu")
            if (win && win.visible) {
              win.hide();
            } else {
              const a = app.get_window("audio-menu"); if(a) a.hide();
              const p = app.get_window("power-menu"); if(p) p.hide();
              const b = app.get_window("battery-menu"); if(b) b.hide();
              const bt = app.get_window("bluetooth-menu"); if(bt) bt.hide();
              const nc = app.get_window("notification-center"); if(nc) nc.hide();
              if(win) win.show();
            }
          }}
          $={(btn) => {
            const win = app.get_window("wifi-menu")
            if (win) {
              win.connect("notify::visible", () => {
                if (win.visible) {
                  btn.add_css_class("active")
                } else {
                  btn.remove_css_class("active")
                  globalState.lastHide["wifi-menu"] = Date.now()
                }
              })
            }
          }}
        >
          <label label={wifiIcon} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} css="font-size: 1.15em; font-weight: 900; margin-right: 5px;" />
        </button>

        {/* Audio Button */}
        <button 
          valign={Gtk.Align.CENTER} 
          onClicked={() => {
            const win = app.get_window("audio-menu")
            if (win && win.visible) {
              win.hide();
            } else {
              const w = app.get_window("wifi-menu"); if(w) w.hide(); const bt = app.get_window("bluetooth-menu"); if(bt) bt.hide();
              const p = app.get_window("power-menu"); if(p) p.hide();
              const b = app.get_window("battery-menu"); if(b) b.hide();
              const nc = app.get_window("notification-center"); if(nc) nc.hide();
              if(win) win.show();
            }
          }}
          $={(btn) => {
            const win = app.get_window("audio-menu")
            if (win) {
              win.connect("notify::visible", () => {
                if (win.visible) {
                  btn.add_css_class("active")
                } else {
                  btn.remove_css_class("active")
                  globalState.lastHide["audio-menu"] = Date.now()
                }
              })
            }
          }}
        >
          <label label={volIcon} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} css="font-size: 1.15em;" />
        </button>
      </box>

      {/* Bell / Notification Center Button */}
      <button 
        class="pill notif-bell" 
        valign={Gtk.Align.CENTER}
        onClicked={() => {
          const win = app.get_window("notification-center")
          if (win && win.visible) {
            win.hide()
          } else {
            const w = app.get_window("wifi-menu"); if(w) w.hide();
            const bt = app.get_window("bluetooth-menu"); if(bt) bt.hide();
            const a = app.get_window("audio-menu"); if(a) a.hide();
            const p = app.get_window("power-menu"); if(p) p.hide();
            const b = app.get_window("battery-menu"); if(b) b.hide();
            const d = app.get_window("date-menu"); if(d) d.hide();
            if (win) win.show()
          }
        }}
        $={(btn) => {
          let hasNewUnread = false
          let lastKnownNotifIds = new Set(notifService.notifications().map((n: any) => n.id))

          const win = app.get_window("notification-center")
          if (win) {
            win.connect("notify::visible", () => {
              if (win.visible) {
                btn.add_css_class("active")
                hasNewUnread = false
                btn.remove_css_class("has-unread")
              } else {
                btn.remove_css_class("active")
                globalState.lastHide["notification-center"] = Date.now()
              }
            })
          }

          const updateUnread = () => {
            const notifs = notifService.notifications()
            const currentIds = new Set(notifs.map((n: any) => n.id))

            let arrivedNew = false
            for (const id of currentIds) {
              if (!lastKnownNotifIds.has(id)) {
                arrivedNew = true
                break
              }
            }
            lastKnownNotifIds = currentIds

            const w = app.get_window("notification-center")
            if (arrivedNew) {
              if (!w || !w.visible) {
                hasNewUnread = true
              }
            }
            if (notifs.length === 0) {
              hasNewUnread = false
            }

            if (hasNewUnread && (!w || !w.visible)) {
              btn.add_css_class("has-unread")
            } else {
              btn.remove_css_class("has-unread")
            }
          }

          notifService.notifications.subscribe(updateUnread)
          updateUnread()
        }}
      >
        <label label="󰂚" halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} class="notif-bell-icon" />
      </button>

      {/* Battery */}
      <button 
        valign={Gtk.Align.CENTER}
        onClicked={() => {
          const win = app.get_window("battery-menu")
          if (win && win.visible) {
            win.hide();
          } else {
            const w = app.get_window("wifi-menu"); if(w) w.hide(); const bt = app.get_window("bluetooth-menu"); if(bt) bt.hide();
            const a = app.get_window("audio-menu"); if(a) a.hide();
            const p = app.get_window("power-menu"); if(p) p.hide();
            const nc = app.get_window("notification-center"); if(nc) nc.hide();
            if(win) win.show();
          }
        }}
        $={(btn) => {
           const win = app.get_window("battery-menu")
           if (win) {
             win.connect("notify::visible", () => {
               if (win.visible) {
                 btn.add_css_class("active")
               } else {
                 btn.remove_css_class("active")
                 globalState.lastHide["battery-menu"] = Date.now()
               }
             })
           }

           const box = new Gtk.Box({ valign: Gtk.Align.CENTER, halign: Gtk.Align.CENTER, spacing: 4 });
           const lblPercent = new Gtk.Label({ label: "100%" });
           const lblIcon = new Gtk.Label({ label: "", cssClasses: ["battery-icon"] });
           
           box.append(lblPercent);
           box.append(lblIcon);
           btn.set_child(box);
           
           // Initial fetch & poll
           const update = () => {
               Promise.all([
                 execAsync("cat /sys/class/power_supply/BAT0/capacity").catch(() => "100"),
                 execAsync("cat /sys/class/power_supply/BAT0/status").catch(() => "Unknown")
               ]).then(([cap, stat]) => {
                 const p = parseInt(cap.trim());
                 const c = stat.trim() === "Charging";
                 
                 lblPercent.label = p + "%";
                 lblIcon.label = c ? "" : "";
                 
                 let cls = "pill battery-pill";
                 if (c) cls += " charging";
                 else if (p <= 20) cls += " low";
                 
                 if (btn.has_css_class("active")) cls += " active";
                 
                 btn.css_classes = cls.split(" ");
               });
           };
           update();
           const GLib = imports.gi.GLib;
           GLib.timeout_add(GLib.PRIORITY_DEFAULT, 5000, () => {
               update();
               return true;
           });
        }}
      />

      {/* Power */}
      <button 
        class="power-pill" 
        valign={Gtk.Align.CENTER}
        onClicked={() => {
          const win = app.get_window("power-menu")
          if (win && win.visible) {
            win.hide();
          } else {
            const w = app.get_window("wifi-menu"); if(w) w.hide(); const bt = app.get_window("bluetooth-menu"); if(bt) bt.hide();
            const a = app.get_window("audio-menu"); if(a) a.hide();
            const b = app.get_window("battery-menu"); if(b) b.hide();
            const nc = app.get_window("notification-center"); if(nc) nc.hide();
            if(win) win.show();
          }
        }}
        $={(btn) => {
          const win = app.get_window("power-menu")
          if (win) {
            win.connect("notify::visible", () => {
              if (win.visible) {
                btn.add_css_class("active")
              } else {
                btn.remove_css_class("active")
                globalState.lastHide["power-menu"] = Date.now()
              }
            })
          }
        }}
      >
        <box valign={Gtk.Align.CENTER} halign={Gtk.Align.CENTER} hexpand={true}>
          <image iconName="system-shutdown-symbolic" pixelSize={16} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} />
        </box>
      </button>

    </box>
  )
}

export default function Bar(gdkmonitor: Gdk.Monitor) {
  const time = createPoll("", 1000, "date '+%H:%M'")
  const { TOP, LEFT, RIGHT } = Astal.WindowAnchor

  return (
    <window
      visible
      name="bar"
      class="Bar"
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      anchor={TOP | LEFT | RIGHT}
      application={app}
    >
      <centerbox cssName="centerbox" valign={Gtk.Align.CENTER}>
        <box $type="start" hexpand halign={Gtk.Align.START} valign={Gtk.Align.CENTER} spacing={10}>
          <box class="pill logo-workspaces" valign={Gtk.Align.CENTER} spacing={6}>
            <button onClicked={() => app.toggle_window("launcher")} class="arch-logo" valign={Gtk.Align.CENTER}>
              <label label="" css="font-size: 1.15em; color: #89b4fa;" valign={Gtk.Align.CENTER} />
            </button>
            <Workspaces />
          </box>
        </box>
        
        <box $type="center" valign={Gtk.Align.CENTER}>
          <button 
            class="pill" 
            valign={Gtk.Align.CENTER}
            onClicked={() => {
              const win = app.get_window("date-menu")
              if (win && win.visible) {
                win.hide()
              } else {
                const w = app.get_window("wifi-menu"); if (w) w.hide()
                const bt = app.get_window("bluetooth-menu"); if (bt) bt.hide()
                const a = app.get_window("audio-menu"); if (a) a.hide()
                const p = app.get_window("power-menu"); if (p) p.hide()
                const b = app.get_window("battery-menu"); if (b) b.hide()
                const nc = app.get_window("notification-center"); if (nc) nc.hide()
                if (win) win.show()
              }
            }}
            $={(btn) => {
              const win = app.get_window("date-menu")
              if (win) {
                win.connect("notify::visible", () => {
                  if (win.visible) {
                    btn.add_css_class("active")
                  } else {
                    btn.remove_css_class("active")
                    globalState.lastHide["date-menu"] = Date.now()
                  }
                })
              }
            }}
          >
            <label class="clock" label={time} />
          </button>
        </box>
        
        <SysInfo $type="end" />
      </centerbox>
    </window>
  )
}
