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
      namespace="audio-menu"
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
        <box orientation={Gtk.Orientation.HORIZONTAL} valign={Gtk.Align.START} vexpand={false}>
          
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
            vexpand={false}
            valign={Gtk.Align.START}
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
                focusable={false}
                canFocus={false}
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
              <button 
                class="audio-icon-btn" 
                focusable={false}
                canFocus={false}
                hexpand={false}
                vexpand={false}
                valign={Gtk.Align.CENTER}
                halign={Gtk.Align.CENTER}
                widthRequest={38}
                heightRequest={38}
                onClicked={() => execAsync("wpctl set-mute @DEFAULT_AUDIO_SINK@ toggle").catch(() => {})}
              >
                <label 
                  css="font-size: 1.3em;" 
                  halign={Gtk.Align.CENTER}
                  valign={Gtk.Align.CENTER}
                  hexpand={false}
                  vexpand={false}
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
                    const parts = out.split(":")
                    if (parts.length < 2) return 50
                    const v = parseFloat(parts[1])
                    return isNaN(v) ? 50 : v * 100
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
              <button 
                class="audio-icon-btn" 
                focusable={false}
                canFocus={false}
                hexpand={false}
                vexpand={false}
                valign={Gtk.Align.CENTER}
                halign={Gtk.Align.CENTER}
                widthRequest={38}
                heightRequest={38}
                onClicked={() => {
                  execAsync("pactl set-source-mute @DEFAULT_SOURCE@ toggle")
                    .catch(() => execAsync("wpctl set-mute @DEFAULT_AUDIO_SOURCE@ toggle"))
                    .catch(() => {})
                }}
              >
                <label 
                  css="font-size: 1.3em;"
                  halign={Gtk.Align.CENTER}
                  valign={Gtk.Align.CENTER}
                  hexpand={false}
                  vexpand={false}
                  $={(lbl) => {
                    const micPoll = createPoll("󰍬", 100, () => 
                      execAsync("pactl get-source-mute @DEFAULT_SOURCE@").then(out => {
                        return out.toLowerCase().includes("yes") ? "󰍭" : "󰍬"
                      }).catch(() => 
                        execAsync("wpctl get-volume @DEFAULT_AUDIO_SOURCE@").then(out => {
                          return out.includes("MUTED") ? "󰍭" : "󰍬"
                        }).catch(() => "󰍬")
                      )
                    )
                    const updateMicVisual = () => {
                      const icon = micPoll.get()
                      lbl.set_label(icon)
                      if (icon === "󰍭") {
                        lbl.add_css_class("muted")
                      } else {
                        lbl.remove_css_class("muted")
                      }
                    }
                    micPoll.subscribe(updateMicVisual)
                    updateMicVisual()
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
                  execAsync(`pactl set-source-volume @DEFAULT_SOURCE@ ${v}%`)
                    .catch(() => execAsync(`wpctl set-volume @DEFAULT_AUDIO_SOURCE@ ${v / 100}`))
                    .catch(() => {})
                  if (v === 0) {
                    execAsync("pactl set-source-mute @DEFAULT_SOURCE@ 1")
                      .catch(() => execAsync("wpctl set-mute @DEFAULT_AUDIO_SOURCE@ 1"))
                      .catch(() => {})
                  } else {
                    execAsync("pactl set-source-mute @DEFAULT_SOURCE@ 0")
                      .catch(() => execAsync("wpctl set-mute @DEFAULT_AUDIO_SOURCE@ 0"))
                      .catch(() => {})
                  }
                })

                const micPoll = createPoll(50, 100, () => 
                  execAsync("pactl get-source-mute @DEFAULT_SOURCE@").then(muteOut => {
                    if (muteOut.toLowerCase().includes("yes")) return 0
                    return execAsync("pactl get-source-volume @DEFAULT_SOURCE@").then(volOut => {
                      const match = volOut.match(/(\d+)%/)
                      return match ? parseInt(match[1]) : 50
                    })
                  }).catch(() => 
                    execAsync("wpctl get-volume @DEFAULT_AUDIO_SOURCE@").then(out => {
                      if (out.includes("MUTED")) return 0
                      const parts = out.split(":")
                      if (parts.length < 2) return 50
                      const v = parseFloat(parts[1])
                      return isNaN(v) ? 50 : v * 100
                    }).catch(() => 50)
                  )
                )

                micPoll.subscribe(() => {
                  const Gtk = imports.gi.Gtk
                  if (scale.get_state_flags() & Gtk.StateFlags.ACTIVE) return
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
