import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { audioService } from "../service/audio"

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

        self.connect("notify::visible", () => {
          if (self.visible) {
            audioService.sync()
          }
        })
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
                onClicked={() => {
                  audioService.toggleMute()
                }}
              >
                <label 
                  css="font-size: 1.3em;" 
                  halign={Gtk.Align.CENTER}
                  valign={Gtk.Align.CENTER}
                  hexpand={false}
                  vexpand={false}
                  label={audioService.getState().volIcon}
                  $={(lbl) => {
                    audioService.subscribe((s) => {
                      lbl.set_label(s.volIcon)
                    })
                  }} 
                />
              </button>
              <box hexpand $={(box) => {
                const adj = new Gtk.Adjustment({ lower: 0, upper: 100, stepIncrement: 1, value: audioService.getDisplayVolume() })
                const scale = new Gtk.Scale({ orientation: Gtk.Orientation.HORIZONTAL, adjustment: adj, drawValue: false, hexpand: true })
                
                let updating = false

                scale.connect("value-changed", () => {
                  if (updating) return
                  const v = Math.round(scale.get_value())
                  audioService.setVolume(v)
                })

                audioService.subscribe((s) => {
                  const target = s.displayVolume
                  if (Math.round(scale.get_value()) !== target) {
                    updating = true
                    scale.set_value(target)
                    adj.set_value(target)
                    updating = false
                  }
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
                  audioService.toggleMicMute()
                }}
              >
                <label 
                  css="font-size: 1.3em;"
                  halign={Gtk.Align.CENTER}
                  valign={Gtk.Align.CENTER}
                  hexpand={false}
                  vexpand={false}
                  label={audioService.getState().micIcon}
                  $={(lbl) => {
                    if (audioService.isSourceMuted()) lbl.add_css_class("muted")
                    audioService.subscribe((s) => {
                      lbl.set_label(s.micIcon)
                      if (s.isMicMuted) lbl.add_css_class("muted")
                      else lbl.remove_css_class("muted")
                    })
                  }} 
                />
              </button>
              <box hexpand $={(box) => {
                const adj = new Gtk.Adjustment({ lower: 0, upper: 100, stepIncrement: 1, value: audioService.getDisplayMicVolume() })
                const scale = new Gtk.Scale({ orientation: Gtk.Orientation.HORIZONTAL, adjustment: adj, drawValue: false, hexpand: true })
                
                let updating = false

                scale.connect("value-changed", () => {
                  if (updating) return
                  const v = Math.round(scale.get_value())
                  audioService.setMicVolume(v)
                })

                audioService.subscribe((s) => {
                  const target = s.displayMicVolume
                  if (Math.round(scale.get_value()) !== target) {
                    updating = true
                    scale.set_value(target)
                    adj.set_value(target)
                    updating = false
                  }
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
