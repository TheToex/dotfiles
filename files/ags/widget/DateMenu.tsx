import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createPoll } from "ags/time"

export default function DateMenu(gdkmonitor: Gdk.Monitor) {
  const { TOP, RIGHT, BOTTOM, LEFT } = Astal.WindowAnchor

  const time = createPoll("", 1000, "date '+%H:%M'")
  const fullDate = createPoll("", 1000, "date '+%A, %d %B %Y'")

  return (
    <window
      visible={false}
      name="date-menu"
      namespace="date-menu"
      class="DateMenu"
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
            const w = app.get_window("date-menu")
            if (w) w.visible = false
          }
        })
        self.add_controller(ctrl)
      }}
    >
      <box orientation={Gtk.Orientation.VERTICAL}>
        {/* MIDDLE ROW: Centered under the middle clock */}
        <box orientation={Gtk.Orientation.HORIZONTAL}>
          {/* Left spacing button (click outside to close) */}
          <button 
            hexpand 
            css="background: rgba(0, 0, 0, 0.01); border: none; outline: none; box-shadow: none;" 
            onClicked={() => { const w = app.get_window("date-menu"); if (w) w.visible = false; }} 
          />

          {/* THE MENU BOX */}
          <box 
            class="box" 
            orientation={Gtk.Orientation.VERTICAL} 
            spacing={12} 
            widthRequest={320} 
            hexpand={false}
            halign={Gtk.Align.CENTER}
            margin-top={0} 
            margin-bottom={0} 
            margin-start={0} 
            margin-end={0}
          >
            {/* Header: Large Time and Full Date */}
            <box orientation={Gtk.Orientation.VERTICAL} spacing={4} halign={Gtk.Align.CENTER}>
              <label label={time} css="font-size: 2.4em; font-weight: 900; color: #cdd6f4;" />
              <label label={fullDate} css="font-size: 1.05em; font-weight: bold; color: #cba6f7;" />
            </box>

            <box css="min-height: 1px; background: rgba(203, 166, 247, 0.25); margin: 4px 8px;" />

            {/* GTK Calendar Widget */}
            <box 
              halign={Gtk.Align.CENTER} 
              valign={Gtk.Align.CENTER} 
              $={(box) => {
                const cal = new Gtk.Calendar({
                  showHeading: true,
                  showDayNames: true,
                  showWeekNumbers: false,
                })
                box.append(cal)
              }} 
            />
          </box>

          {/* Right spacing button (click outside to close) */}
          <button 
            hexpand 
            css="background: rgba(0, 0, 0, 0.01); border: none; outline: none; box-shadow: none;" 
            onClicked={() => { const w = app.get_window("date-menu"); if (w) w.visible = false; }} 
          />
        </box>

        {/* BOTTOM ROW (click outside to close) */}
        <button 
          vexpand 
          css="background: rgba(0, 0, 0, 0.01); border: none; outline: none; box-shadow: none;" 
          onClicked={() => { const w = app.get_window("date-menu"); if (w) w.visible = false; }} 
        />
      </box>
    </window>
  )
}

