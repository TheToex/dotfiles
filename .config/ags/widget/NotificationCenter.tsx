import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { Variable } from "ags/gobject"

// In a real environment with AstalNotifd:
// import AstalNotifd from "gi://AstalNotifd"
// const notifd = AstalNotifd.get_default()

const MOCK_NOTIFS = [
    { id: 1, app: "System", summary: "Welcome to AGS", body: "Your new shell is ready to use!" },
    { id: 2, app: "Update", summary: "System Updates Available", body: "Run pacman -Syu to update." },
]

export default function NotificationCenter(gdkmonitor: Gdk.Monitor) {
  const { TOP, RIGHT } = Astal.WindowAnchor
  
  return (
    <window
      visible={false}
      name="notification-center"
      class="NotificationCenter"
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.ON_DEMAND}
      anchor={TOP | RIGHT}
      margin-top={60}
      margin-right={10}
      application={app}
    >
      <box class="box" orientation={Gtk.Orientation.VERTICAL} widthRequest={350} heightRequest={500}>
        <box spacing={10} halign={Gtk.Align.CENTER} margin-bottom={15}>
          <label label="Notifications" css="font-size: 1.2em; font-weight: bold;" />
        </box>
        
        <Gtk.ScrolledWindow vexpand>
          <box orientation={Gtk.Orientation.VERTICAL}>
            {/* When using AstalNotifd, map over notifd.notifications */}
            {MOCK_NOTIFS.map(n => (
              <box class="notification-item" orientation={Gtk.Orientation.VERTICAL}>
                <box>
                    <label label={n.app} css="font-size: 0.8em; opacity: 0.7;" />
                </box>
                <label class="title" label={n.summary} halign={Gtk.Align.START} wrap />
                <label class="body" label={n.body} halign={Gtk.Align.START} wrap />
              </box>
            ))}
          </box>
        </Gtk.ScrolledWindow>
      </box>
    </window>
  )
}
