import Gio from "gi://Gio"
import GLib from "gi://GLib"
import { createState, Accessor } from "gnim"

export interface NotificationItem {
  id: number
  appName: string
  appIcon: string
  summary: string
  body: string
  time: string
  urgency: number
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
  </interface>
</node>`

const [notifsState, setNotifsState] = createState<NotificationItem[]>([])
const [dndState, setDndState] = createState<boolean>(false)

class NotificationService {
  private static instance: NotificationService
  public notifications: Accessor<NotificationItem[]> = notifsState
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
        new GLib.Variant("(as)", [["body", "body-markup", "actions", "icon-static"]])
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
        const hints = (unpacked[6] || {}) as Record<string, any>

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
        }

        const current = notifsState().filter((n) => n.id !== id)
        setNotifsState([item, ...current])

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

  public dismiss(id: number) {
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

  public clearAll() {
    setNotifsState([])
  }

  public toggleDnd() {
    setDndState(!dndState())
  }
}

export const notifService = NotificationService.getInstance()

