import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createPoll } from "ags/time"
import { execAsync } from "ags/process"
import GLib from "gi://GLib"

interface WifiNetwork {
  ssid: string;
  signal: number;
  security: string;
  active: boolean;
}

let cachedWifiNetworks: WifiNetwork[] = []
let renderNetworksRef: ((networks: WifiNetwork[]) => void) | null = null
let updateToggleRef: (() => void) | null = null

const parseWifiOutput = (out: string): WifiNetwork[] => {
  const networks: WifiNetwork[] = []
  const seen = new Set<string>()
  out.split("\n").forEach(line => {
    if (!line.trim()) return
    const parts = line.split(":")
    let ssid = parts[0]
    let signal = parseInt(parts[1])
    let active = parts[3] === "yes"
    
    if (parts.length > 4) {
       active = parts[parts.length - 1] === "yes"
       signal = parseInt(parts[parts.length - 3])
       ssid = parts.slice(0, parts.length - 3).join(":")
    }

    if (!ssid || seen.has(ssid)) return
    seen.add(ssid)
    networks.push({ ssid, signal: isNaN(signal) ? 50 : signal, security: "", active })
  })
  
  return networks.sort((a, b) => {
    if (a.active) return -1
    if (b.active) return 1
    return b.signal - a.signal
  })
}

const queryWifiNetworks = (rescan = false): Promise<WifiNetwork[]> => {
  return execAsync(`nmcli -t -f SSID,SIGNAL,SECURITY,ACTIVE dev wifi list --rescan ${rescan ? "yes" : "no"}`)
    .then(out => {
      cachedWifiNetworks = parseWifiOutput(out)
      return cachedWifiNetworks
    })
    .catch(() => cachedWifiNetworks)
}

// Pre-fetch synchronously on module load for instant 0ms availability
try {
  const [res, out] = GLib.spawn_command_line_sync("nmcli -t -f SSID,SIGNAL,SECURITY,ACTIVE dev wifi list --rescan no")
  if (res && out) {
    cachedWifiNetworks = parseWifiOutput(new TextDecoder().decode(out))
  }
} catch (_) {}

const getWifiIcon = (signal: number) => {
  return ""
}

export default function WifiMenu(gdkmonitor: Gdk.Monitor) {
  const { TOP, RIGHT, BOTTOM, LEFT } = Astal.WindowAnchor

  return (
    <window
      visible={false}
      name="wifi-menu"
      namespace="wifi-menu"
      class="WifiMenu"
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.NONE}
      anchor={TOP | RIGHT | BOTTOM | LEFT}
      margin-top={35}
      application={app}
      $={(self) => {
        const ctrl = new Gtk.EventControllerKey()
        ctrl.connect("key-pressed", (_, keyval) => {
          if (keyval === 65307) { // Escape
            self.visible = false
            return true
          }
          return false
        })
        self.add_controller(ctrl)

        self.connect("notify::visible", () => {
          if (self.visible) {
            if (updateToggleRef) updateToggleRef()
            if (renderNetworksRef && cachedWifiNetworks.length > 0) {
              renderNetworksRef(cachedWifiNetworks)
            }
            queryWifiNetworks(false).then(networks => {
              if (renderNetworksRef) renderNetworksRef(networks)
            }).catch(() => {})

            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1500, () => {
              if (self.visible) {
                execAsync("nmcli dev wifi rescan")
                  .then(() => queryWifiNetworks(false))
                  .then(networks => {
                    if (self.visible && renderNetworksRef) renderNetworksRef(networks)
                  })
                  .catch(() => {})
              }
              return false
            })
          }
        })
      }}
    >
      <box orientation={Gtk.Orientation.VERTICAL}>

        {/* MIDDLE ROW */}
        <box orientation={Gtk.Orientation.HORIZONTAL}>
          
          <button 
            hexpand 
            css="background: rgba(0, 0, 0, 0.01); border: none; outline: none; box-shadow: none;" 
            onClicked={() => { const w = app.get_window("wifi-menu"); if(w) w.visible = false; }} 
          />

          {/* THE MENU BOX */}
          <box 
            class="box" 
            orientation={Gtk.Orientation.VERTICAL} 
            spacing={8} 
            widthRequest={320} 
            hexpand={false}
            halign={Gtk.Align.END}
            margin-top={0} 
            margin-bottom={0} 
            margin-start={0} 
            margin-end={0}
          >
            {/* Header */}
            <box orientation={Gtk.Orientation.HORIZONTAL} valign={Gtk.Align.CENTER}>
              <label label="Wi-Fi Networks" css="font-weight: bold; font-size: 1.1em;" halign={Gtk.Align.START} hexpand={true} />
              <button 
                css="background: transparent; border: none; box-shadow: none; font-size: 1.8em; padding: 0; margin-right: 12px;"
                $={(btn) => {
                   let currentState = false;
                   
                   const setVisualState = (on) => {
                       currentState = on;
                       btn.label = on ? "" : "";
                       btn.add_css_class("wifi-toggle-btn");
                       if (on) btn.add_css_class("active");
                       else btn.remove_css_class("active");
                   };

                   const update = () => {
                     execAsync("nmcli radio wifi").then(out => {
                         const on = out.trim() === "enabled";
                         setVisualState(on);
                     }).catch(() => {});
                   };
                   update();
                   updateToggleRef = update;
                   
                   btn.connect("clicked", () => {
                       // Optimistic UI update (instant)
                       const turningOn = !currentState;
                       setVisualState(turningOn);
                       
                       // Background execution
                       execAsync("nmcli radio wifi " + (turningOn ? "on" : "off")).catch(() => {
                           // Revert if failed
                           update();
                       });
                   });
                   
                   // Background poll to stay in sync
                   GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
                       const win = app.get_window("wifi-menu");
                       if (win && win.visible) {
                           update();
                       }
                       return true;
                   });
                }}
              />
            </box>

            <Gtk.ScrolledWindow vexpand={false} heightRequest={280}>
              <box 
                orientation={Gtk.Orientation.VERTICAL} 
                spacing={12}
                $={(box) => {
                  let fetchWifi: () => void;
                  
                  const renderNetworks = (networks: WifiNetwork[]) => {
                    while (box.get_first_child()) box.remove(box.get_first_child()!)
                    
                    if (networks.length === 0) {
                      const empty = new Gtk.Label({ label: "No networks found" })
                      empty.add_css_class("wifi-empty-lbl")
                      box.append(empty)
                      return
                    }

                    networks.forEach(n => {
                      const row = new Gtk.Box({ spacing: 12, valign: Gtk.Align.CENTER })
                      
                      const iconLbl = new Gtk.Label({ label: getWifiIcon(n.signal) })
                      iconLbl.add_css_class("wifi-icon-lbl")
                      row.append(iconLbl)

                      const nameLbl = new Gtk.Label({ label: n.ssid, hexpand: true, halign: Gtk.Align.START })
                      row.append(nameLbl)

                      if (n.active) {
                        const btn = new Gtk.Button({ cssClasses: ["pill", "wifi-active-btn"] })
                        btn.connect("clicked", () => {
                          execAsync(`nmcli connection down "${n.ssid}"`).then(() => fetchWifi()).catch(e => print(e))
                        })
                        
                        const lbl = new Gtk.Label({ label: "Connected" })
                        lbl.add_css_class("wifi-connected-lbl")
                        btn.set_child(lbl)
                  
                        const ctrl = new Gtk.EventControllerMotion()
                        ctrl.connect("enter", () => {
                          lbl.label = "Disconnect"
                          lbl.remove_css_class("wifi-connected-lbl")
                          lbl.add_css_class("wifi-disconnect-lbl")
                        })
                        ctrl.connect("leave", () => {
                          lbl.label = "Connected"
                          lbl.remove_css_class("wifi-disconnect-lbl")
                          lbl.add_css_class("wifi-connected-lbl")
                        })
                        btn.add_controller(ctrl)
                        
                        row.append(btn)
                      } else {
                        const btn = new Gtk.Button({ cssClasses: ["pill"] })
                        btn.connect("clicked", () => {
                          execAsync(`nmcli dev wifi connect "${n.ssid}"`).then(() => fetchWifi()).catch(e => print(e))
                        })
                        const lbl = new Gtk.Label({ label: "Connect" })
                        lbl.add_css_class("wifi-connect-lbl")
                        btn.set_child(lbl)
                        row.append(btn)
                      }

                      box.append(row)
                    })
                  }

                  renderNetworksRef = renderNetworks

                  // Render cached networks immediately (0ms delay)
                  if (cachedWifiNetworks.length > 0) {
                    renderNetworks(cachedWifiNetworks)
                  }

                  fetchWifi = (force = false) => {
                    const win = app.get_window("wifi-menu")
                    if (!force && (!win || !win.visible)) return

                    queryWifiNetworks(false).then(networks => {
                      renderNetworks(networks)
                    }).catch(e => print(e))
                  }

                  // Poll every 5 seconds only if menu is open
                  GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
                    const win = app.get_window("wifi-menu")
                    if (win && win.visible) {
                      fetchWifi(false)
                    }
                    return true
                  })
                }}
              />
            </Gtk.ScrolledWindow>

          </box>

          <button 
            widthRequest={12} 
            css="background: rgba(0, 0, 0, 0.01); border: none; outline: none; box-shadow: none; min-width: 12px;" 
            onClicked={() => { const w = app.get_window("wifi-menu"); if(w) w.visible = false; }} 
          />

        </box>

        {/* BOTTOM ROW */}
        <button 
          vexpand 
          css="background: rgba(0, 0, 0, 0.01); border: none; outline: none; box-shadow: none;" 
          onClicked={() => { const w = app.get_window("wifi-menu"); if(w) w.visible = false; }} 
        />

      </box>
    </window>
  )
}
