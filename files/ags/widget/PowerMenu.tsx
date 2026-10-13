import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { execAsync } from "ags/process"

export default function PowerMenu(gdkmonitor: Gdk.Monitor) {
  const { TOP, RIGHT, BOTTOM, LEFT } = Astal.WindowAnchor

  const actions = [
    { name: "Shut Down", icon: "⏻", cmd: "systemctl poweroff", color: "#f38ba8" },
    { name: "Restart", icon: "", cmd: "systemctl reboot", color: "#fab387" },
    { name: "Sleep", icon: "󰤄", cmd: "systemctl suspend", color: "#89b4fa" },
    { name: "Hibernate", icon: "󰒲", cmd: "systemctl hibernate", color: "#cba6f7" },
    { name: "Log Out", icon: "󰍃", cmd: "hyprctl eval \"hl.dispatch(hl.dsp.exit())\"", color: "#a6e3a1" }
  ]

  return (
    <window
      visible={false}
      name="power-menu"
      class="PowerMenu"
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
            const w = app.get_window("power-menu"); if(w) w.visible = false;
          }
        })
        self.add_controller(ctrl)
      }}
    >
      <box orientation={Gtk.Orientation.VERTICAL}>

        {/* MIDDLE ROW */}
        <box orientation={Gtk.Orientation.HORIZONTAL}>
          
          <button 
            hexpand 
            css="background: rgba(0, 0, 0, 0.01); border: none; outline: none; box-shadow: none;" 
            onClicked={() => { const w = app.get_window("power-menu"); if(w) w.visible = false;} }
          />

          <box 
            class="box" css="margin-right: 7px;" 
            orientation={Gtk.Orientation.VERTICAL} 
            spacing={8} 
            widthRequest={200} 
            hexpand={false}
            halign={Gtk.Align.END}
            margin-top={0} 
            margin-bottom={0} 
            margin-start={0} 
            margin-end={0}
          >
            {actions.map(action => (
              <button 
                class="pill" 
                onClicked={() => {
                  const w = app.get_window("power-menu"); if(w) w.visible = false;
                  execAsync(action.cmd).catch(print)
                }}
                $={(btn) => {
                  const ctrl = new Gtk.EventControllerMotion()
                  ctrl.connect("enter", () => btn.add_css_class("active"))
                  ctrl.connect("leave", () => btn.remove_css_class("active"))
                  btn.add_controller(ctrl)
                }}
              >
                <box spacing={12} valign={Gtk.Align.CENTER}>
                  <label label={action.icon} css={`color: ${action.color}; font-size: 1.5em;`} />
                  <label label={action.name} css="font-weight: bold;" />
                </box>
              </button>
            ))}
          </box>
        </box>

        {/* BOTTOM ROW */}
        <button 
          vexpand 
          css="background: rgba(0, 0, 0, 0.01); border: none; outline: none; box-shadow: none;" 
          onClicked={() => { const w = app.get_window("power-menu"); if(w) w.visible = false;} }
        />
      </box>
    </window>
  )
}
