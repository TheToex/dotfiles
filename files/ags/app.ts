import app from "ags/gtk4/app"
import style from "./style.scss"
import Bar from "./widget/Bar"
import Dock from "./widget/Dock"
import AppLauncher from "./widget/Launcher"
import NotificationCenter, { NotificationCenterBackdrop } from "./widget/NotificationCenter"
import AudioMenu from "./widget/AudioMenu"
import WifiMenu from "./widget/WifiMenu"
import BluetoothMenu from "./widget/BluetoothMenu"
import PowerMenu from "./widget/PowerMenu"
import BatteryMenu from "./widget/BatteryMenu"
import DateMenu from "./widget/DateMenu"

app.start({
  css: style,
  requestHandler(argv, res) {
    const req = argv.join(" ")
    if (req.includes("toggle-notification-center") || req.includes("toggle-nc")) {
      const win = app.get_window("notification-center")
      if (win) {
        win.visible = !win.visible
        res("toggled")
        return
      }
    }
    if (req.startsWith("toggle ")) {
      const name = req.replace("toggle ", "").trim()
      const win = app.get_window(name)
      if (win) {
        win.visible = !win.visible
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
      Bar(monitor)
      // Dock(monitor)
      AppLauncher(monitor)
    })
  },
})
