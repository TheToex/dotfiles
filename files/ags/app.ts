import app from "ags/gtk4/app"
import GLib from "gi://GLib"
import style from "./style.scss"
import Bar from "./widget/Bar"
import Dock from "./widget/Dock"
import AppLauncher from "./widget/Launcher"
import NotificationCenter, { NotificationCenterBackdrop, triggerClearAll, triggerDismissFirst } from "./widget/NotificationCenter"
import NotificationPopups from "./widget/NotificationPopups"
import AudioMenu from "./widget/AudioMenu"
import WifiMenu from "./widget/WifiMenu"
import BluetoothMenu from "./widget/BluetoothMenu"
import PowerMenu from "./widget/PowerMenu"
import BatteryMenu from "./widget/BatteryMenu"
import DateMenu from "./widget/DateMenu"

// Suppress internal GDK frame timing throttling & missing gnome theme warnings
const _textDecoder = new TextDecoder()
GLib.log_set_writer_func((logLevel, fields: any) => {
  let msg = ""
  if (fields && fields.MESSAGE) {
    try {
      msg = _textDecoder.decode(fields.MESSAGE)
    } catch (_) {}
  }
  if (
    msg.includes("gdkframetimings") ||
    msg.includes("GDK_FRAME_PREPARING") ||
    msg.includes("gdk_frame_timings_throttling_hint") ||
    msg.includes("/org/gnome/theme/gtk.css")
  ) {
    return GLib.LogWriterOutput.HANDLED
  }
  return GLib.LogWriterOutput.UNHANDLED
})

app.start({
  css: style,
  requestHandler(argv, res) {
    const req = argv.join(" ")
    if (req.includes("toggle-notification-center") || req.includes("toggle-nc")) {
      const win = app.get_window("notification-center")
      if (win) {
        if (win.visible) win.hide()
        else win.show()
        res("toggled")
        return
      }
    }
    if (req.includes("clear-notifs")) {
      triggerClearAll()
      res("cleared")
      return
    }
    if (req.includes("dismiss-first-notif")) {
      triggerDismissFirst()
      res("dismissed-first")
      return
    }
    if (req.startsWith("toggle ")) {
      const name = req.replace("toggle ", "").trim()
      const win = app.get_window(name)
      if (win) {
        if (win.visible) win.hide()
        else win.show()
        res("toggled " + name)
        return
      }
    }
    res("ok")
  },
  main() {
    app.get_monitors().map(monitor => {
      AudioMenu(monitor)
      WifiMenu(monitor)
      BluetoothMenu(monitor)
      PowerMenu(monitor)
      BatteryMenu(monitor)
      DateMenu(monitor)
      NotificationCenterBackdrop(monitor)
      NotificationCenter(monitor)
      NotificationPopups(monitor)
      Bar(monitor)
      // Dock(monitor)
      AppLauncher(monitor)
    })
  },
})
