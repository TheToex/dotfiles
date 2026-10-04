import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createPoll } from "ags/time"
import { execAsync } from "ags/process"

export default function AudioMenu(gdkmonitor: Gdk.Monitor) {
  const { TOP, RIGHT, BOTTOM, LEFT } = Astal.WindowAnchor

  return (
    <window
      visible={false}
      name="audio-menu"
      class="AudioMenu"
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
            const w = app.get_window("audio-menu"); if(w) w.visible = false;
          }
        })
        self.add_controller(ctrl)
      }}
    >
      <box orientation={Gtk.Orientation.VERTICAL}>

        {/* MIDDLE ROW: Contains the menu and side padding */}
        <box orientation={Gtk.Orientation.HORIZONTAL}>
          
          {/* Left side padding */}
          <button 
            hexpand 
            css="background: rgba(0, 0, 0, 0.01); border: none; outline: none; box-shadow: none;" 
            onClicked={() => { const w = app.get_window("audio-menu"); if(w) w.visible = false;} }
          />

          {/* THE MENU BOX */}
          <box 
            class="box" 
            orientation={Gtk.Orientation.VERTICAL} 
            spacing={16} 
            widthRequest={340} 
            hexpand={false}
            halign={Gtk.Align.END}
            margin-top={0} 
            margin-bottom={0} 
            margin-start={0} 
            margin-end={0}
          >
            {/* Header */}
            <box orientation={Gtk.Orientation.HORIZONTAL}>
              <label label="Volume" css="font-weight: bold; font-size: 1.1em;" halign={Gtk.Align.START} hexpand />
              <button 
                css="background: transparent; border: none; box-shadow: none; padding: 0; margin-right: 12px;" 
                onClicked={() => {
                  execAsync("pavucontrol").catch(() => {})
                  const w = app.get_window("audio-menu"); if(w) w.visible = false;
                }}
              >
                <label label="" css="font-size: 1.2em;" />
              </button>
            </box>

            {/* Speaker Row */}
            <box spacing={12} valign={Gtk.Align.CENTER}>
              <button class="pill" onClicked={() => execAsync("wpctl set-mute @DEFAULT_AUDIO_SINK@ toggle").catch(() => {})}>
                <label 
                  css="font-size: 1.4em;" 
                  $={(lbl) => {
                    const volPoll = createPoll("󰕾", 100, () => 
                      execAsync("wpctl get-volume @DEFAULT_AUDIO_SINK@").then(out => {
                        if (out.includes("MUTED")) return "󰖁"
                        const v = parseFloat(out.split(":")[1]) * 100
                        if (v === 0) return "󰖁"
                        if (v < 33) return "󰕿"
                        if (v < 66) return "󰖀"
                        return "󰕾"
                      }).catch(() => "󰕾")
                    )
                    volPoll.subscribe(() => lbl.set_label(volPoll.get()))
                    lbl.set_label(volPoll.get())
                  }} 
                />
              </button>
              <box hexpand $={(box) => {
                const adj = new Gtk.Adjustment({ lower: 0, upper: 100, stepIncrement: 1, value: 50 })
                const scale = new Gtk.Scale({ orientation: Gtk.Orientation.HORIZONTAL, adjustment: adj, drawValue: false, hexpand: true })
                
                let updating = false
                let timeoutId = 0;
                scale.connect("value-changed", () => {
                  if (updating) return
                  const v = Math.round(scale.get_value())
                  
                  const GLib = imports.gi.GLib;
                  if (timeoutId) GLib.source_remove(timeoutId);
                  timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 30, () => {
                      execAsync(`wpctl set-volume @DEFAULT_AUDIO_SINK@ ${v / 100}`).catch(() => {})
                      if (v === 0) execAsync(`wpctl set-mute @DEFAULT_AUDIO_SINK@ 1`).catch(() => {})
                      else execAsync(`wpctl set-mute @DEFAULT_AUDIO_SINK@ 0`).catch(() => {})
                      timeoutId = 0;
                      return false;
                  });
                })

                const volPoll = createPoll(50, 100, () => 
                  execAsync("wpctl get-volume @DEFAULT_AUDIO_SINK@").then(out => {
                    if (out.includes("MUTED")) return 0
                    return parseFloat(out.split(":")[1]) * 100
                  }).catch(() => 50)
                )

                volPoll.subscribe(() => {
                  const Gtk = imports.gi.Gtk;
                  if (scale.get_state_flags() & Gtk.StateFlags.ACTIVE) return;
                  updating = true
                  adj.set_value(volPoll.get())
                  updating = false
                })

                box.append(scale)
              }} />
            </box>

            {/* Microphone Row */}
            <box spacing={12} valign={Gtk.Align.CENTER}>
              <button class="pill" onClicked={() => execAsync("wpctl set-mute @DEFAULT_AUDIO_SOURCE@ toggle").catch(() => {})}>
                <label 
                  css="font-size: 1.4em;" 
                  $={(lbl) => {
                    const micPoll = createPoll("󰍬", 100, () => 
                      execAsync("wpctl get-volume @DEFAULT_AUDIO_SOURCE@").then(out => {
                        return out.includes("MUTED") ? "󰍭" : "󰍬"
                      }).catch(() => "󰍬")
                    )
                    micPoll.subscribe(() => lbl.set_label(micPoll.get()))
                    lbl.set_label(micPoll.get())
                  }} 
                />
              </button>
              <box hexpand $={(box) => {
                const adj = new Gtk.Adjustment({ lower: 0, upper: 100, stepIncrement: 1, value: 50 })
                const scale = new Gtk.Scale({ orientation: Gtk.Orientation.HORIZONTAL, adjustment: adj, drawValue: false, hexpand: true })
                
                let updating = false
                scale.connect("value-changed", () => {
                  if (updating) return
                  const v = Math.round(scale.get_value())
                  execAsync(`wpctl set-volume @DEFAULT_AUDIO_SOURCE@ ${v / 100}`).catch(() => {})
                  if (v === 0) execAsync(`wpctl set-mute @DEFAULT_AUDIO_SOURCE@ 1`).catch(() => {})
                  else execAsync(`wpctl set-mute @DEFAULT_AUDIO_SOURCE@ 0`).catch(() => {})
                })

                const micPoll = createPoll(50, 100, () => 
                  execAsync("wpctl get-volume @DEFAULT_AUDIO_SOURCE@").then(out => {
                    if (out.includes("MUTED")) return 0
                    return parseFloat(out.split(":")[1]) * 100
                  }).catch(() => 50)
                )

                micPoll.subscribe(() => {
                  updating = true
                  adj.set_value(micPoll.get())
                  updating = false
                })

                box.append(scale)
              }} />
            </box>
          </box>

          {/* Right side padding (12px gap from edge) */}
          <button 
            widthRequest={12} 
            css="background: rgba(0, 0, 0, 0.01); border: none; outline: none; box-shadow: none; min-width: 12px;" 
            onClicked={() => { const w = app.get_window("audio-menu"); if(w) w.visible = false;} }
          />

        </box>

        {/* BOTTOM ROW: Covers everything below the menu */}
        <button 
          vexpand 
          css="background: rgba(0, 0, 0, 0.01); border: none; outline: none; box-shadow: none;" 
          onClicked={() => { const w = app.get_window("audio-menu"); if(w) w.visible = false;} }
        />

      </box>
    </window>
  )
}
