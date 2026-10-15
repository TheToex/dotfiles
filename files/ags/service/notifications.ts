import Gio from "gi://Gio"
import GLib from "gi://GLib"
import { createState, Accessor } from "gnim"
import { execAsync } from "ags/process"

export interface NotificationAction {
  id: string
  label: string
}

export function formatActionLabel(actionId: string, rawLabel: string): string {
  const lowerId = (actionId || "").toLowerCase()
  const lowerLabel = (rawLabel || "").toLowerCase().trim()

  if (lowerId === "reply" || lowerLabel === "پاسخ" || lowerLabel === "پاسخ دادن") return "Reply"
  if (lowerId.includes("mark") || lowerId.includes("read") || lowerLabel === "دیدم" || lowerLabel === "خوانده شد") return "Mark as Read"
  if (lowerId === "open" || lowerId === "view" || lowerId === "default" || lowerLabel === "مشاهده" || lowerLabel === "باز کردن") return "Reply"
  if (lowerId === "dismiss" || lowerId === "close" || lowerLabel === "بستن") return "Mark as Read"
  if (lowerId === "mute" || lowerLabel === "بی‌صدا" || lowerLabel === "بی صدا") return "Mute"

  if (/[\u0600-\u06FF]/.test(rawLabel)) {
    if (lowerId.includes("reply")) return "Reply"
    if (lowerId.includes("read") || lowerId.includes("mark")) return "Mark as Read"
    return "Reply"
  }

  if (rawLabel && rawLabel.length > 0) {
    if (rawLabel.toLowerCase() === "open") return "Reply"
    if (rawLabel.toLowerCase() === "mark read") return "Mark as Read"
    return rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1)
  }

  return "Reply"
}

export interface NotificationItem {
  id: number
  appName: string
  appIcon: string
  summary: string
  body: string
  time: string
  urgency: number
  actions: NotificationAction[]
  image?: string
  timeout?: number
  desktopEntry?: string
}

const ifaceXml = `
<node>
  <interface name="org.freedesktop.Notifications">
    <method name="GetCapabilities">
      <arg direction="out" name="capabilities" type="as"/>
    </method>
    <method name="Notify">
      <arg direction="in" name="app_name" type="s"/>
      <arg direction="in" name="replaces_id" type="u"/>
      <arg direction="in" name="app_icon" type="s"/>
      <arg direction="in" name="summary" type="s"/>
      <arg direction="in" name="body" type="s"/>
      <arg direction="in" name="actions" type="as"/>
      <arg direction="in" name="hints" type="a{sv}"/>
      <arg direction="in" name="expire_timeout" type="i"/>
      <arg direction="out" name="id" type="u"/>
    </method>
    <method name="CloseNotification">
      <arg direction="in" name="id" type="u"/>
    </method>
    <method name="GetServerInformation">
      <arg direction="out" name="name" type="s"/>
      <arg direction="out" name="vendor" type="s"/>
      <arg direction="out" name="version" type="s"/>
      <arg direction="out" name="spec_version" type="s"/>
    </method>
    <signal name="NotificationClosed">
      <arg name="id" type="u"/>
      <arg name="reason" type="u"/>
    </signal>
    <signal name="ActionInvoked">
      <arg name="id" type="u"/>
      <arg name="action_key" type="s"/>
    </signal>
    <signal name="NotificationReplied">
      <arg name="id" type="u"/>
      <arg name="text" type="s"/>
    </signal>
  </interface>
</node>`

const [notifsState, setNotifsState] = createState<NotificationItem[]>([])
const [popupsState, setPopupsState] = createState<NotificationItem[]>([])
const [dndState, setDndState] = createState<boolean>(false)

class NotificationService {
  private static instance: NotificationService
  public notifications: Accessor<NotificationItem[]> = notifsState
  public popups: Accessor<NotificationItem[]> = popupsState
  public dnd: Accessor<boolean> = dndState
  private nextId = 1
  private connection: Gio.DBusConnection | null = null

  private constructor() {
    this.registerDBus()
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService()
    }
    return NotificationService.instance
  }

  private registerDBus() {
    try {
      const nodeInfo = Gio.DBusNodeInfo.new_for_xml(ifaceXml)
      const ifaceInfo = nodeInfo.interfaces[0]

      Gio.bus_own_name(
        Gio.BusType.SESSION,
        "org.freedesktop.Notifications",
        Gio.BusNameOwnerFlags.REPLACE,
        (conn: Gio.DBusConnection) => {
          this.connection = conn
          conn.register_object(
            "/org/freedesktop/Notifications",
            ifaceInfo,
            (
              _connection: Gio.DBusConnection,
              _sender: string,
              _objectPath: string,
              _interfaceName: string,
              methodName: string,
              parameters: GLib.Variant,
              invocation: Gio.DBusMethodInvocation
            ) => {
              this.handleMethod(methodName, parameters, invocation)
            },
            null,
            null
          )
        },
        () => {
          console.log("[NotificationService] Registered org.freedesktop.Notifications")
        },
        () => {
          console.warn("[NotificationService] Lost DBus name org.freedesktop.Notifications")
        }
      )
    } catch (e) {
      console.error("[NotificationService] DBus init error:", e)
    }
  }

  private handleMethod(
    methodName: string,
    parameters: GLib.Variant,
    invocation: Gio.DBusMethodInvocation
  ) {
    if (methodName === "GetCapabilities") {
      invocation.return_value(
        new GLib.Variant("(as)", [["body", "body-markup", "actions", "inline-reply", "icon-static"]])
      )
    } else if (methodName === "GetServerInformation") {
      invocation.return_value(
        new GLib.Variant("(ssss)", ["AGS Notification Center", "AGS", "1.0", "1.2"])
      )
    } else if (methodName === "Notify") {
      try {
        const unpacked = parameters.deep_unpack() as any[]
        const appName = (unpacked[0] || "Application").toString()
        const replacesId = Number(unpacked[1]) || 0
        const appIcon = (unpacked[2] || "").toString()
        const summary = (unpacked[3] || "").toString()
        const body = (unpacked[4] || "").toString()
        const rawActions = (unpacked[5] || []) as any[]
        const rawList: { id: string; rawLabel: string }[] = []
        for (let i = 0; i < rawActions.length; i += 2) {
          const actionId = (rawActions[i] || "").toString()
          const actionLabel = (rawActions[i + 1] || "").toString()
          if (actionId) {
            rawList.push({ id: actionId, rawLabel: actionLabel })
          }
        }

        const lowerApp = appName.toLowerCase()
        const isMessenger =
          lowerApp.includes("telegram") ||
          lowerApp.includes("discord") ||
          lowerApp.includes("signal") ||
          lowerApp.includes("slack") ||
          lowerApp.includes("element") ||
          lowerApp.includes("whatsapp")

        // 1. Separate "default" (body click) from button actions if other actions exist
        const nonDefault = rawList.filter((a) => a.id.toLowerCase() !== "default")
        const candidates = nonDefault.length > 0 ? nonDefault : rawList

        const actions: NotificationAction[] = []
        const seen = new Set<string>()

        for (const cand of candidates) {
          const formatted = formatActionLabel(cand.id, cand.rawLabel)
          if (!seen.has(formatted)) {
            seen.add(formatted)
            actions.push({ id: cand.id, label: formatted })
          }
        }

        const hasReply = actions.some((a) => a.label === "Reply")
        const hasMarkRead = actions.some((a) => a.label === "Mark as Read")

        if (isMessenger || hasReply) {
          if (!hasReply) {
            const rawReply = rawList.find((a) => a.id.toLowerCase().includes("reply"))
            actions.unshift({ id: rawReply ? rawReply.id : "inline-reply", label: "Reply" })
            seen.add("Reply")
          }
          if (!hasMarkRead) {
            const rawMark = rawList.find(
              (a) => a.id.toLowerCase().includes("mark") || a.id.toLowerCase().includes("read")
            )
            actions.push({ id: rawMark ? rawMark.id : "mark_read", label: "Mark as Read" })
            seen.add("Mark as Read")
          }
        }

        const hints = (unpacked[6] || {}) as Record<string, any>
        let image: string | undefined = undefined
        let desktopEntry: string | undefined = undefined
        if (hints) {
          if (hints["image-path"]) image = hints["image-path"].toString()
          else if (hints["image_path"]) image = hints["image_path"].toString()
          if (hints["desktop-entry"]) desktopEntry = hints["desktop-entry"].toString()
          else if (hints["desktop_entry"]) desktopEntry = hints["desktop_entry"].toString()
        }

        const expireTimeout = Number(unpacked[7]) || 5000

        const id = replacesId > 0 ? replacesId : this.nextId++
        const now = GLib.DateTime.new_now_local()
        const timeStr = now ? now.format("%H:%M") || "" : ""

        let urgency = 1
        if (hints && hints.urgency) {
          urgency = Number(hints.urgency.unpack ? hints.urgency.unpack() : hints.urgency) || 1
        }

        const item: NotificationItem = {
          id,
          appName: appName || "Notification",
          appIcon,
          summary: summary || "Notice",
          body,
          time: timeStr,
          urgency,
          actions,
          image,
          timeout: expireTimeout > 0 ? expireTimeout : 5000,
          desktopEntry,
        }

        const current = notifsState().filter((n) => n.id !== id)
        setNotifsState([item, ...current])

        if (!dndState()) {
          const curPopups = popupsState().filter((n) => n.id !== id)
          setPopupsState([item, ...curPopups].slice(0, 3))
        }

        invocation.return_value(new GLib.Variant("(u)", [id]))
      } catch (err) {
        console.error("[NotificationService] Notify error:", err)
        invocation.return_value(new GLib.Variant("(u)", [this.nextId++]))
      }
    } else if (methodName === "CloseNotification") {
      try {
        const unpacked = parameters.deep_unpack() as any[]
        const id = Number(unpacked[0]) || 0
        this.dismiss(id)
        invocation.return_value(null)
      } catch {
        invocation.return_value(null)
      }
    }
  }

  public sendReply(id: number, text: string) {
    if (this.connection) {
      try {
        this.connection.emit_signal(
          null,
          "/org/freedesktop/Notifications",
          "org.freedesktop.Notifications",
          "NotificationReplied",
          new GLib.Variant("(us)", [id, text])
        )
      } catch (err) {
        console.error("[NotificationService] NotificationReplied error:", err)
      }
      try {
        this.connection.emit_signal(
          null,
          "/org/freedesktop/Notifications",
          "org.freedesktop.Notifications",
          "ActionInvoked",
          new GLib.Variant("(us)", [id, "inline-reply"])
        )
      } catch {
        // ignore
      }
    }
  }

  public dismissPopup(id: number) {
    setPopupsState(popupsState().filter((p) => p.id !== id))
  }

  public invokeAction(id: number, actionKey: string) {
    if (this.connection) {
      try {
        this.connection.emit_signal(
          null,
          "/org/freedesktop/Notifications",
          "org.freedesktop.Notifications",
          "ActionInvoked",
          new GLib.Variant("(us)", [id, actionKey])
        )
      } catch (err) {
        console.error("[NotificationService] ActionInvoked error:", err)
      }
    }
  }

  public dismiss(id: number) {
    this.dismissPopup(id)
    const list = notifsState().filter((n) => n.id !== id)
    setNotifsState(list)
    if (this.connection) {
      try {
        this.connection.emit_signal(
          null,
          "/org/freedesktop/Notifications",
          "org.freedesktop.Notifications",
          "NotificationClosed",
          new GLib.Variant("(uu)", [id, 2])
        )
      } catch {
        // ignore
      }
    }
  }

  public activateNotification(id: number, appName: string, desktopEntry?: string) {
    this.invokeAction(id, "default")
    activateNotificationApp(appName, undefined, desktopEntry)
  }

  public clearAll() {
    setPopupsState([])
    setNotifsState([])
  }

  public toggleDnd() {
    setDndState(!dndState())
  }
}

export function activateNotificationApp(appName: string, _appIcon?: string, desktopEntry?: string) {
  const lower = (appName || "").toLowerCase()
  const map: Record<string, string> = {
    telegram: "org.telegram.desktop",
    discord: "discord",
    spotify: "spotify",
    firefox: "firefox",
    chrome: "google-chrome",
    chromium: "chromium",
    code: "code",
    vscode: "code",
    slack: "slack",
    steam: "steam",
    vlc: "vlc",
    kitty: "kitty",
    terminal: "kitty",
  }

  let target = desktopEntry || ""
  if (!target) {
    for (const [k, v] of Object.entries(map)) {
      if (lower.includes(k)) {
        target = v
        break
      }
    }
  }
  if (!target && appName) {
    target = appName.toLowerCase().replace(/\s+/g, "")
  }

  // Derive keyword to focus existing window via regex in Hyprland
  let searchKey = ""
  if (lower.includes("telegram")) searchKey = "telegram"
  else if (lower.includes("discord")) searchKey = "discord"
  else if (lower.includes("code") || lower.includes("visual studio")) searchKey = "code"
  else if (lower.includes("firefox")) searchKey = "firefox"
  else if (lower.includes("spotify")) searchKey = "spotify"
  else if (lower.includes("chrome")) searchKey = "chrome"
  else if (lower.includes("kitty") || lower.includes("terminal")) searchKey = "kitty"
  else if (target) searchKey = target.replace(/\.desktop$/, "").split(".").pop() || target
  else if (appName) searchKey = appName.toLowerCase().replace(/[^a-z0-9]/g, "")

  if (searchKey) {
    // 1. Focus existing window in Hyprland with case-insensitive regex
    execAsync(`hyprctl dispatch 'hl.dsp.focus({ window = "class:(?i).*${searchKey}.*" })'`).catch(() => {})
  }

  if (target) {
    // 2. Also try gtk-launch (which activates DBus SingleMainWindow or starts the app)
    execAsync(`gtk-launch ${target}`).catch(() => {})
  }
}

export const notifService = NotificationService.getInstance()


