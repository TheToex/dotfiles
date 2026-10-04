import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { createPoll } from "ags/time"

function getIconName(appName: string) {
  // Simple mapping, can be expanded or use Gio.AppInfo
  const a = appName.toLowerCase()
  if (a.includes("firefox")) return "firefox"
  if (a.includes("kitty")) return "utilities-terminal-symbolic"
  if (a.includes("nautilus") || a.includes("files")) return "system-file-manager-symbolic"
  if (a.includes("code")) return "code"
  return "application-x-executable"
}

export default function Dock(gdkmonitor: Gdk.Monitor) {
  const { BOTTOM } = Astal.WindowAnchor

  // Poll running clients
  const clients = createPoll([], 500, () => {
    return execAsync("hyprctl clients -j").then(out => {
      const parsed = JSON.parse(out)
      // Group by class to avoid multiple icons for same app (or keep them separate depending on preference)
      return parsed.filter((c: any) => c.class !== "")
    }).catch(() => [])
  })

  // Poll pinned apps
  const pinned = createPoll(["kitty", "firefox"], 2000, () => {
    return execAsync("cat ~/.config/ags/pinned.json").then(out => JSON.parse(out)).catch(() => ["kitty", "firefox"])
  })

  const box = <box cssName="box" halign={Gtk.Align.CENTER} spacing={6} /> as Gtk.Box

  const update = () => {
    while (box.get_first_child()) box.remove(box.get_first_child()!)

    const pins = pinned.get()
    const cls = clients.get()

    // Pinned
    pins.forEach((pin: string) => {
      const btn = new Gtk.Button({ tooltipText: `Pinned: ${pin}` })
      btn.set_child(new Gtk.Image({ iconName: getIconName(pin), pixelSize: 32 }))
      btn.connect("clicked", () => execAsync(pin).catch(() => {}))
      box.append(btn)
    })

    if (pins.length > 0 && cls.length > 0) {
      box.append(new Gtk.Label({ label: "|", cssClasses: ["separator"] }))
    }

    // Running
    cls.forEach((c: any) => {
      const btn = new Gtk.Button({ tooltipText: c.title, cssClasses: ["running-app"] })
      btn.set_child(new Gtk.Image({ iconName: getIconName(c.class), pixelSize: 32 }))
      btn.connect("clicked", () => execAsync(`hyprctl dispatch focuswindow address:${c.address}`).catch(() => {}))
      box.append(btn)
    })

    // Pin Button
    const pinBtn = new Gtk.Button({ tooltipText: "Add Pinned App", cssClasses: ["pin-button"] })
    pinBtn.set_child(new Gtk.Label({ label: "", cssClasses: ["pin-icon"] }))
    pinBtn.connect("clicked", () => {
      execAsync(`bash -c 'app=$(zenity --entry --title="Pin App" --text="Enter app command (e.g., firefox):"); if [ -n "$app" ]; then jq ". + [\\"$app\\"] | unique" ~/.config/ags/pinned.json > ~/.config/ags/pinned.tmp && mv ~/.config/ags/pinned.tmp ~/.config/ags/pinned.json; fi'`).catch(() => {})
    })
    box.append(pinBtn)
  }

  pinned.subscribe(update)
  clients.subscribe(update)
  update()

  return (
    <window
      visible
      name="dock"
      class="Dock"
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.IGNORE}
      anchor={BOTTOM}
      margin-bottom={10}
      application={app}
    >
      {box}
    </window>
  )
}
