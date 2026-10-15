import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { execAsync } from "ags/process"
import GLib from "gi://GLib"

interface BluetoothDevice {
  mac: string
  name: string
  connected: boolean
}

let cachedDevices: BluetoothDevice[] = []
let cachedBtPower = false
let updateBtPowerVisual: ((on: boolean) => void) | null = null
let renderDevicesRef: ((devs: BluetoothDevice[]) => void) | null = null

const queryDevices = (): Promise<BluetoothDevice[]> => {
  return Promise.all([
    execAsync("bluetoothctl devices").catch(() => ""),
    execAsync("bluetoothctl devices Connected").catch(() => "")
  ]).then(([allOut, connectedOut]) => {
    const connectedMacs = new Set(
      connectedOut.split("\n")
        .filter(l => l.startsWith("Device "))
        .map(l => l.split(" ")[1])
    )
    
    const devices: BluetoothDevice[] = []
    allOut.split("\n").forEach(line => {
      if (!line.startsWith("Device ")) return
      const parts = line.split(" ")
      const mac = parts[1]
      const name = parts.slice(2).join(" ")
      devices.push({ mac, name, connected: connectedMacs.has(mac) })
    })
    
    cachedDevices = devices.sort((a, b) => (a.connected === b.connected ? 0 : a.connected ? -1 : 1))
    if (renderDevicesRef) renderDevicesRef(cachedDevices)
    return cachedDevices
  })
}

// Pre-fetch immediately on startup
queryDevices().catch(() => {})
execAsync("bluetoothctl show").then(out => {
  cachedBtPower = out.includes("Powered: yes")
  if (updateBtPowerVisual) updateBtPowerVisual(cachedBtPower)
}).catch(() => {})

export default function BluetoothMenu(gdkmonitor: Gdk.Monitor) {
  const { TOP, RIGHT, BOTTOM, LEFT } = Astal.WindowAnchor

  return (
    <window
      visible={false}
      name="bluetooth-menu"
      namespace="bluetooth-menu"
      class="BluetoothMenu"
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
            self.visible = false;
            return true;
          }
          return false;
        })
        self.add_controller(ctrl)

        self.connect("notify::visible", () => {
          if (self.visible) {
            if (updateBtPowerVisual) updateBtPowerVisual(cachedBtPower)
            if (renderDevicesRef && cachedDevices.length > 0) {
              renderDevicesRef(cachedDevices)
            }
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
            onClicked={() => { const w = app.get_window("bluetooth-menu"); if(w) w.visible = false;} }
          />

          <box 
            class="box" 
            orientation={Gtk.Orientation.VERTICAL} 
            spacing={20} 
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
              <label label="Bluetooth Devices" css="font-weight: bold; font-size: 1.1em;" halign={Gtk.Align.START} hexpand={true} />
              <button 
                css="background: transparent; border: none; box-shadow: none; font-size: 1.8em; padding: 0; margin-right: 12px;"
                $={(btn) => {
                   let currentState = cachedBtPower;
                   
                   const setVisualState = (on: boolean) => {
                       currentState = on;
                       btn.label = on ? "" : "";
                       btn.add_css_class("wifi-toggle-btn");
                       if (on) btn.add_css_class("active");
                       else btn.remove_css_class("active");
                   };
                   updateBtPowerVisual = setVisualState;
                   setVisualState(cachedBtPower);

                   const update = () => {
                     execAsync("bluetoothctl show").then(out => {
                         const on = out.includes("Powered: yes");
                         cachedBtPower = on;
                         setVisualState(on);
                     }).catch(() => {});
                   };
                   update();
                   
                   btn.connect("clicked", () => {
                       const turningOn = !currentState;
                       setVisualState(turningOn);
                       execAsync("bluetoothctl power " + (turningOn ? "on" : "off")).catch(() => {
                           update();
                       });
                   });
                   
                   GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
                       const win = app.get_window("bluetooth-menu");
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
                  let fetchDevices: (force?: boolean) => void;
                  
                  const renderDevices = (devices: BluetoothDevice[]) => {
                    while (box.get_first_child()) box.remove(box.get_first_child()!)
                    
                    if (devices.length === 0) {
                      const empty = new Gtk.Label({ label: "No devices found" })
                      empty.add_css_class("wifi-empty-lbl")
                      box.append(empty)
                      return
                    }

                    devices.forEach(d => {
                      const row = new Gtk.Box({ spacing: 12, valign: Gtk.Align.CENTER })
                      
                      const iconLbl = new Gtk.Label({ label: d.connected ? "󰂯" : "󰂲" })
                      iconLbl.add_css_class("wifi-icon-lbl")
                      row.append(iconLbl)

                      const nameLbl = new Gtk.Label({ label: d.name, hexpand: true, halign: Gtk.Align.START })
                      row.append(nameLbl)

                      if (d.connected) {
                        const btn = new Gtk.Button({ cssClasses: ["pill", "wifi-active-btn"] })
                        btn.connect("clicked", () => {
                          execAsync(`bluetoothctl disconnect ${d.mac}`).then(() => fetchDevices()).catch(e => print(e))
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
                          execAsync(`bluetoothctl connect ${d.mac}`).then(() => fetchDevices()).catch(e => print(e))
                        })
                        const lbl = new Gtk.Label({ label: "Connect" })
                        lbl.add_css_class("wifi-connect-lbl")
                        btn.set_child(lbl)
                        row.append(btn)
                      }

                      box.append(row)
                    })
                  }

                  renderDevicesRef = renderDevices;

                  // Render cached devices immediately (0ms delay)
                  if (cachedDevices.length > 0) {
                    renderDevices(cachedDevices)
                  }

                  fetchDevices = (force = false) => {
                    const win = app.get_window("bluetooth-menu")
                    if (!force && (!win || !win.visible)) return

                    queryDevices().then(devs => {
                      renderDevices(devs)
                    }).catch(e => print(e))
                  }

                  // Poll only when menu is open
                  setInterval(() => fetchDevices(false), 4000)

                  const win = app.get_window("bluetooth-menu")
                  if (win) {
                    win.connect("notify::visible", () => {
                      if (win.visible) {
                        if (cachedDevices.length > 0) {
                          renderDevices(cachedDevices)
                        }
                        fetchDevices(true)
                      }
                    })
                  }
                }}
              />
            </Gtk.ScrolledWindow>
          </box>

          <button 
            widthRequest={12} 
            css="background: rgba(0, 0, 0, 0.01); border: none; outline: none; box-shadow: none; min-width: 12px;" 
            onClicked={() => { const w = app.get_window("bluetooth-menu"); if(w) w.visible = false; }} 
          />
        </box>

        {/* BOTTOM ROW */}
        <button 
          vexpand 
          css="background: rgba(0, 0, 0, 0.01); border: none; outline: none; box-shadow: none;" 
          onClicked={() => { const w = app.get_window("bluetooth-menu"); if(w) w.visible = false; }} 
        />
      </box>
    </window>
  )
}
