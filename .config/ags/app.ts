import app from "ags/gtk4/app"
import style from "./style.scss"
import Bar from "./widget/Bar"
import Dock from "./widget/Dock"
import AppLauncher from "./widget/Launcher"
import NotificationCenter from "./widget/NotificationCenter"
import AudioMenu from "./widget/AudioMenu"
import WifiMenu from "./widget/WifiMenu"
import BluetoothMenu from "./widget/BluetoothMenu"
import PowerMenu from "./widget/PowerMenu"
import BatteryMenu from "./widget/BatteryMenu"

app.start({
  css: style,
  main() {
    app.get_monitors().map(monitor => {
      AudioMenu(monitor)
      WifiMenu(monitor)
      BluetoothMenu(monitor)
      PowerMenu(monitor)
      BatteryMenu(monitor)
      Bar(monitor)
      // Dock(monitor)
      AppLauncher(monitor)
      NotificationCenter(monitor)
    })
  },
})
