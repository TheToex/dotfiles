import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createPoll } from "ags/time"
import { execAsync } from "ags/process"

let cachedProfile = "balanced";
let profileButtonsUpdater: ((cur: string) => void) | null = null;

execAsync("powerprofilesctl get").then(out => {
  cachedProfile = out.trim();
  if (profileButtonsUpdater) profileButtonsUpdater(cachedProfile);
}).catch(() => {});

export default function BatteryMenu(gdkmonitor: Gdk.Monitor) {
  const { TOP, RIGHT, BOTTOM, LEFT } = Astal.WindowAnchor

  const profiles = [
    { id: "power-saver", icon: "󰾆", label: "Power Save" },
    { id: "balanced", icon: "󰾅", label: "Balanced" },
    { id: "performance", icon: "󰓅", label: "Performance" }
  ];

  return (
    <window
      visible={false}
      name="battery-menu"
      namespace="battery-menu"
      class="BatteryMenu"
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
            const w = app.get_window("battery-menu"); if(w) w.visible = false;
          }
        })
        self.add_controller(ctrl)

        self.connect("notify::visible", () => {
          if (self.visible) {
            if (profileButtonsUpdater) profileButtonsUpdater(cachedProfile);
            execAsync("powerprofilesctl get").then(out => {
              cachedProfile = out.trim();
              if (profileButtonsUpdater) profileButtonsUpdater(cachedProfile);
            }).catch(() => {});
          }
        })
      }}
    >
      <box orientation={Gtk.Orientation.VERTICAL}>
        {/* MIDDLE ROW */}
        <box orientation={Gtk.Orientation.HORIZONTAL}>
          {/* Left side padding */}
          <button 
            hexpand 
            css="background: rgba(0, 0, 0, 0.01); border: none; outline: none; box-shadow: none;" 
            onClicked={() => { const w = app.get_window("battery-menu"); if(w) w.visible = false;} }
          />

          {/* THE MENU BOX */}
          <box 
            class="box" 
            orientation={Gtk.Orientation.VERTICAL} 
            spacing={16} 
            widthRequest={380} 
            hexpand={false}
            halign={Gtk.Align.END}
            margin-top={0} 
            margin-bottom={0} 
            margin-start={0} 
            margin-end={0}
          >
            <label label="Power Profile" css="font-weight: bold; font-size: 1.1em;" halign={Gtk.Align.START} />

            <box 
              orientation={Gtk.Orientation.HORIZONTAL} 
              spacing={12} 
              homogeneous={true} 
              halign={Gtk.Align.FILL} 
              hexpand 
              margin-top={8} 
              margin-bottom={4}
              $={(box) => {
                profileButtonsUpdater = (cur: string) => {
                  let child = box.get_first_child();
                  while (child) {
                    if ((child as any).updateActive) {
                      (child as any).updateActive(cur);
                    }
                    child = child.get_next_sibling();
                  }
                };
              }}
            >
              {profiles.map(p => (
                <button 
                  class="pill"
                  hexpand={true}
                  css="padding: 8px 4px; border-radius: 16px; margin: 0;"
                  $={(btn) => {
                    const updateActive = (cur: string) => {
                      const isActive = cur === p.id;
                      if (isActive) {
                        btn.add_css_class("active");
                        btn.add_css_class("state-" + p.id); 
                      } else {
                        btn.remove_css_class("active");
                        btn.remove_css_class("state-" + p.id);
                      }
                    };
                    (btn as any).updateActive = updateActive;
                    updateActive(cachedProfile);
                  }}
                  onClicked={() => {
                    cachedProfile = p.id;
                    execAsync(`powerprofilesctl set ${p.id}`).catch(() => {})
                    if (profileButtonsUpdater) profileButtonsUpdater(p.id);
                  }}
                >
                  <label class="profile-text" label={p.label} css="font-size: 0.9em; font-weight: bold;" halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} wrap={false} />
                </button>
              ))}
            </box>

            {/* Auto Screen Sleep Toggle */}
            <box orientation={Gtk.Orientation.HORIZONTAL} valign={Gtk.Align.CENTER} margin-top={4} margin-bottom={8} margin-start={8} margin-end={8}>
              <label label="Auto Screen Sleep" css="font-weight: bold; font-size: 0.95em;" halign={Gtk.Align.START} hexpand={true} />
              <button 
                css="background: transparent; border: none; box-shadow: none; font-size: 1.8em; padding: 0; margin-right: 8px;"
                $={(btn) => {
                   const self = btn as any;
                   self.currentState = false;
                   self.updating = false;
                   
                   self.setVisualState = (on: boolean) => {
                       self.currentState = on;
                       btn.label = on ? "" : ""; // MDI toggle switch icon
                       btn.add_css_class("wifi-toggle-btn");
                       if (on) btn.add_css_class("active");
                       else btn.remove_css_class("active");
                   };

                   const update = () => {
                     if (self.updating) return; // Prevent flicker during transition
                     execAsync("pidof hypridle").then(() => {
                         self.setVisualState(true);
                     }).catch(() => {
                         self.setVisualState(false);
                     });
                   };
                   update();
                   
                   const GLib = imports.gi.GLib;
                   GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
                       update();
                       return true;
                   });
                }}
                onClicked={(btn) => {
                   const self = btn as any;
                   const turningOn = !self.currentState;
                   
                   self.updating = true;
                   self.setVisualState(turningOn);
                   
                   const GLib = imports.gi.GLib;
                   if (turningOn) {
                       execAsync("rm -f ~/.config/hypr/.hypridle-disabled").catch(() => {});
                       try {
                           imports.gi.GLib.spawn_command_line_async("hypridle");
                       } catch(e) {}
                       GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => { self.updating = false; return false; });
                   } else {
                       execAsync("touch ~/.config/hypr/.hypridle-disabled").catch(() => {});
                       execAsync("killall -9 hypridle").catch(() => {}).finally(() => {
                           GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => { self.updating = false; return false; });
                       });
                   }
                }}
              />
            </box>

          </box>

          {/* Right side padding (12px gap from edge) */}
          <button 
            widthRequest={12} 
            css="background: rgba(0, 0, 0, 0.01); border: none; outline: none; box-shadow: none; min-width: 12px;" 
            onClicked={() => { const w = app.get_window("battery-menu"); if(w) w.visible = false;} }
          />
        </box>
        
        {/* BOTTOM ROW */}
        <button 
          vexpand 
          css="background: rgba(0, 0, 0, 0.01); border: none; outline: none; box-shadow: none;" 
          onClicked={() => { const w = app.get_window("battery-menu"); if(w) w.visible = false;} }
        />
      </box>
    </window>
  )
}
