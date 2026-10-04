import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { execAsync } from "ags/process"
// @ts-ignore
import Gio from "gi://Gio"
// @ts-ignore
import GLib from "gi://GLib"

const USAGE_FILE = GLib.get_home_dir() + "/.config/ags/app_usage.json";
let appUsage: Record<string, number> = {};

try {
    const [ok, contents] = GLib.file_get_contents(USAGE_FILE);
    if (ok) {
        appUsage = JSON.parse(new TextDecoder().decode(contents));
    }
} catch (e) {}

function recordUsage(id: string) {
    if (!id) return;
    appUsage[id] = (appUsage[id] || 0) + 1;
    try {
        GLib.file_set_contents(USAGE_FILE, new TextEncoder().encode(JSON.stringify(appUsage)));
    } catch (e) {}
}

let allApps: any[] = []
try {
    allApps = Gio.AppInfo.get_all().filter((a: any) => a.should_show())
} catch (e) {
    allApps = []
}

export default function Launcher(gdkmonitor: Gdk.Monitor) {
  const { TOP, RIGHT, BOTTOM, LEFT } = Astal.WindowAnchor
  
  let searchEntry: Gtk.Entry | null = null;
  let appsScroll: Gtk.ScrolledWindow | null = null;
  const appsList = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, hexpand: true })
  
  let selectedIndex = 0;
  let currentButtons: Gtk.Button[] = [];
  let currentActions: (() => void)[] = [];

  function updateSelection() {
      currentButtons.forEach((btn, i) => {
          if (i === selectedIndex) {
              btn.add_css_class("selected")
              // Scroll to keep selected item in view
              if (appsScroll) {
                  const adj = appsScroll.get_vadjustment()
                  
                  let btnTop = 0;
                  let btnHeight = 40; // safe fallback
                  
                  try {
                      // Try to get exact allocation first
                      const alloc = btn.get_allocation();
                      btnTop = alloc.y;
                      btnHeight = alloc.height;
                  } catch (e) {
                      // Fallback: sum up preceding heights
                      btnTop = 0;
                      for (let j = 0; j < i; j++) {
                          btnTop += currentButtons[j].get_height() || 40;
                      }
                      btnHeight = btn.get_height() || 40;
                  }

                  const btnBottom = btnTop + btnHeight;
                  const scrollTop = adj.get_value();
                  const scrollBottom = scrollTop + adj.get_page_size();
                  
                  // Add a small 4px padding so it's not strictly on the edge
                  if (btnBottom > scrollBottom - 4) {
                      adj.set_value(btnBottom - adj.get_page_size() + 4)
                  } else if (btnTop < scrollTop + 4) {
                      adj.set_value(btnTop - 4)
                  }
              }
          } else {
              btn.remove_css_class("selected")
          }
      })
  }

  function updateAppList(query: string) {
      while (appsList.get_first_child()) {
          appsList.remove(appsList.get_first_child()!)
      }
      currentButtons = [];
      currentActions = [];

      const filtered = allApps
        .filter(a => a.get_name().toLowerCase().includes(query))
        .sort((a, b) => {
            const idA = a.get_id() || "";
            const idB = b.get_id() || "";
            const countA = appUsage[idA] || 0;
            const countB = appUsage[idB] || 0;
            
            if (countA !== countB) {
                return countB - countA;
            }
            return a.get_name().localeCompare(b.get_name());
        })

      if (filtered.length === 0) {
          appsList.append(
              new Gtk.Label({ label: "No apps found.", margin_top: 20, margin_bottom: 20 })
          )
          return
      }

      for (const appInfo of filtered) {
          const btn = new Gtk.Button({ halign: Gtk.Align.FILL, hexpand: true })
          const launchApp = () => {
              const id = appInfo.get_id()
              if (id) {
                  recordUsage(id)
                  execAsync(`gtk-launch ${id}`).catch(() => {
                     execAsync(appInfo.get_executable() || "").catch(() => {})
                  })
              } else {
                  execAsync(appInfo.get_executable() || "").catch(() => {})
              }
              const w = app.get_window("launcher"); if(w) w.visible = false;
          }
          btn.connect("clicked", launchApp)
          currentActions.push(launchApp)
          
          const box = new Gtk.Box({ spacing: 10 })
          const iconName = appInfo.get_icon() ? appInfo.get_icon().to_string() : "application-x-executable"
          const img = new Gtk.Image({ iconName: iconName, pixelSize: 24 })
          const lbl = new Gtk.Label({ label: appInfo.get_name() })
          
          box.append(img)
          box.append(lbl)
          btn.set_child(box)
          
          appsList.append(btn)
          currentButtons.push(btn)
      }
      
      selectedIndex = 0;
      updateSelection();
  }

  // Initialize empty
  updateAppList("")

  return (
    <window
      visible={false}
      name="launcher"
      class="Launcher"
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.EXCLUSIVE}
      anchor={TOP | RIGHT | BOTTOM | LEFT}
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
            if (self.visible && searchEntry) {
                searchEntry.text = ""
                searchEntry.grab_focus()
            }
        })
      }}
    >
      <box orientation={Gtk.Orientation.VERTICAL}>
        {/* TOP ROW */}
        <button 
          vexpand 
          css="background: rgba(0, 0, 0, 0.01); border: none; outline: none; box-shadow: none;" 
          onClicked={() => { const w = app.get_window("launcher"); if(w) w.visible = false;} }
        />
        
        {/* MIDDLE ROW */}
        <box orientation={Gtk.Orientation.HORIZONTAL}>
          <button 
            hexpand 
            css="background: rgba(0, 0, 0, 0.01); border: none; outline: none; box-shadow: none;" 
            onClicked={() => { const w = app.get_window("launcher"); if(w) w.visible = false;} }
          />
          
          <box class="box" orientation={Gtk.Orientation.VERTICAL} widthRequest={400} heightRequest={280} hexpand={false}>
            <entry 
              placeholderText="Search apps..." 
              onChanged={(self) => updateAppList(self.text.toLowerCase())}
              onActivate={() => {
                  if (currentActions[selectedIndex]) {
                      currentActions[selectedIndex]();
                  }
              }}
              $={(self) => {
                searchEntry = self;
                
                const ctrl = new Gtk.EventControllerKey()
                ctrl.connect("key-pressed", (_, keyval) => {
                  if (keyval === 65364) { // Down Arrow
                    selectedIndex = Math.min(selectedIndex + 1, currentButtons.length - 1)
                    updateSelection()
                    return true 
                  }
                  if (keyval === 65362) { // Up Arrow
                    selectedIndex = Math.max(selectedIndex - 1, 0)
                    updateSelection()
                    return true 
                  }
                  
                  return false
                })
                self.add_controller(ctrl)
              }}
            />
            <Gtk.ScrolledWindow vexpand $={(self) => appsScroll = self}>
              <box hexpand={true} $={box => box.append(appsList)} />
            </Gtk.ScrolledWindow>
          </box>

          <button 
            hexpand 
            css="background: rgba(0, 0, 0, 0.01); border: none; outline: none; box-shadow: none;" 
            onClicked={() => { const w = app.get_window("launcher"); if(w) w.visible = false;} }
          />
        </box>

        {/* BOTTOM ROW */}
        <button 
          vexpand 
          css="background: rgba(0, 0, 0, 0.01); border: none; outline: none; box-shadow: none;" 
          onClicked={() => { const w = app.get_window("launcher"); if(w) w.visible = false;} }
        />
      </box>
    </window>
  )
}
