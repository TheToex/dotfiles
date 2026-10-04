import { globalState } from "../utils"
import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { createPoll } from "ags/time"
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

      {/* Bluetooth Menu Button */}
      <button 
        class="pill" 
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
        <box valign={Gtk.Align.CENTER} halign={Gtk.Align.CENTER} hexpand={true}>
          <label label={btIcon} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} css="font-size: 1.4em; font-weight: 900;" />
        </box>
      </button>

      {/* Wifi Menu Button */}
      <button 
        class="pill" 
        valign={Gtk.Align.CENTER} 
        onClicked={() => {
          const win = app.get_window("wifi-menu")
          if (win && win.visible) {
            win.hide();
          } else {
            const a = app.get_window("audio-menu"); if(a) a.hide();
            const p = app.get_window("power-menu"); if(p) p.hide();
            const b = app.get_window("battery-menu"); if(b) b.hide();
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
        <box valign={Gtk.Align.CENTER} halign={Gtk.Align.CENTER} hexpand={true}>
          <label label={wifiIcon} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} css="font-size: 1.1em; font-weight: 900; margin-right: 6px;" />
        </box>
      </button>
      
      {/* Audio Menu Button */}
      <button 
        class="pill" 
        valign={Gtk.Align.CENTER} 
        onClicked={() => {
          const win = app.get_window("audio-menu")
          if (win && win.visible) {
            win.hide();
          } else {
            const w = app.get_window("wifi-menu"); if(w) w.hide(); const bt = app.get_window("bluetooth-menu"); if(bt) bt.hide();
            const p = app.get_window("power-menu"); if(p) p.hide();
            const b = app.get_window("battery-menu"); if(b) b.hide();
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
        <box valign={Gtk.Align.CENTER} halign={Gtk.Align.CENTER} hexpand={true}>
          <label label={volIcon} css="font-size: 1.2em;" />
        </box>
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
          <button class="pill" valign={Gtk.Align.CENTER}>
            <label class="clock" label={time} />
          </button>
        </box>
        
        <SysInfo $type="end" />
      </centerbox>
    </window>
  )
}
