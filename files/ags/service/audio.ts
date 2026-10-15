import { execAsync } from "ags/process"
import GLib from "gi://GLib"
import Gio from "gi://Gio"

export interface AudioState {
  volume: number          // Real volume 0-100
  displayVolume: number   // 0 when muted, otherwise volume
  isMuted: boolean
  micVolume: number       // Real mic volume 0-100
  displayMicVolume: number // 0 when muted, otherwise micVolume
  isMicMuted: boolean
  volIcon: string
  micIcon: string
}

class AudioService {
  private volume = 50
  private lastNonZeroVolume = 50
  private isMuted = false

  private micVolume = 50
  private lastNonZeroMic = 50
  private isMicMuted = false

  private listeners: Set<(state: AudioState) => void> = new Set()
  private isSettingSink = false
  private isSettingSource = false
  private sinkDebounceTimer = 0
  private sourceDebounceTimer = 0

  constructor() {
    this.initSync()
    this.startEventListener()
  }

  private initSync() {
    try {
      const [res, out] = GLib.spawn_command_line_sync("wpctl get-volume @DEFAULT_AUDIO_SINK@")
      if (res && out) {
        const str = new TextDecoder().decode(out)
        this.isMuted = str.includes("MUTED")
        const parts = str.split(":")
        if (parts.length >= 2) {
          const v = Math.round(parseFloat(parts[1]) * 100)
          if (!isNaN(v)) {
            this.volume = v
            if (v > 0) this.lastNonZeroVolume = v
          }
        }
      }
    } catch (_) {}

    try {
      const [rMute, outMute] = GLib.spawn_command_line_sync("pactl get-source-mute @DEFAULT_SOURCE@")
      if (rMute && outMute) {
        const mStr = new TextDecoder().decode(outMute)
        this.isMicMuted = mStr.toLowerCase().includes("yes")
      }
      const [rVol, outVol] = GLib.spawn_command_line_sync("pactl get-source-volume @DEFAULT_SOURCE@")
      if (rVol && outVol) {
        const vStr = new TextDecoder().decode(outVol)
        const match = vStr.match(/(\d+)%/)
        if (match) {
          const v = parseInt(match[1])
          if (!isNaN(v)) {
            this.micVolume = v
            if (v > 0) this.lastNonZeroMic = v
          }
        }
      } else {
        const [rWp, outWp] = GLib.spawn_command_line_sync("wpctl get-volume @DEFAULT_AUDIO_SOURCE@")
        if (rWp && outWp) {
          const str = new TextDecoder().decode(outWp)
          this.isMicMuted = str.includes("MUTED")
          const parts = str.split(":")
          if (parts.length >= 2) {
            const v = Math.round(parseFloat(parts[1]) * 100)
            if (!isNaN(v)) {
              this.micVolume = v
              if (v > 0) this.lastNonZeroMic = v
            }
          }
        }
      }
    } catch (_) {}
  }

  private getVolIcon(vol: number, muted: boolean): string {
    if (muted || vol === 0) return "󰖁"
    if (vol < 33) return "󰕿"
    if (vol < 66) return "󰖀"
    return "󰕾"
  }

  private getMicIcon(muted: boolean): string {
    return muted ? "󰍭" : "󰍬"
  }

  public getState(): AudioState {
    return {
      volume: this.volume,
      displayVolume: this.isMuted ? 0 : this.volume,
      isMuted: this.isMuted,
      micVolume: this.micVolume,
      displayMicVolume: this.isMicMuted ? 0 : this.micVolume,
      isMicMuted: this.isMicMuted,
      volIcon: this.getVolIcon(this.volume, this.isMuted),
      micIcon: this.getMicIcon(this.isMicMuted),
    }
  }

  public getVolume(): number {
    return this.volume
  }

  public getDisplayVolume(): number {
    return this.isMuted ? 0 : this.volume
  }

  public isSinkMuted(): boolean {
    return this.isMuted
  }

  public getMicVolume(): number {
    return this.micVolume
  }

  public getDisplayMicVolume(): number {
    return this.isMicMuted ? 0 : this.micVolume
  }

  public isSourceMuted(): boolean {
    return this.isMicMuted
  }

  public subscribe(fn: (state: AudioState) => void): () => void {
    this.listeners.add(fn)
    fn(this.getState())
    return () => this.listeners.delete(fn)
  }

  public notify() {
    const s = this.getState()
    this.listeners.forEach((fn) => {
      try {
        fn(s)
      } catch (_) {}
    })
  }

  public sync() {
    this.syncSink()
    this.syncSource()
  }

  public syncSink() {
    if (this.isSettingSink) return
    execAsync("wpctl get-volume @DEFAULT_AUDIO_SINK@")
      .then((out) => {
        if (this.isSettingSink) return
        const muted = out.includes("MUTED")
        const parts = out.split(":")
        if (parts.length >= 2) {
          const v = Math.round(parseFloat(parts[1]) * 100)
          if (!isNaN(v)) {
            this.volume = v
            if (v > 0) this.lastNonZeroVolume = v
          }
        }
        this.isMuted = muted
        this.notify()
      })
      .catch(() => {})
  }

  public syncSource() {
    if (this.isSettingSource) return
    Promise.all([
      execAsync("pactl get-source-mute @DEFAULT_SOURCE@").catch(() => ""),
      execAsync("pactl get-source-volume @DEFAULT_SOURCE@").catch(() => ""),
    ])
      .then(([muteOut, volOut]) => {
        if (this.isSettingSource) return
        if (muteOut) {
          this.isMicMuted = muteOut.toLowerCase().includes("yes")
        }
        if (volOut) {
          const m = volOut.match(/(\d+)%/)
          if (m) {
            const v = parseInt(m[1])
            if (!isNaN(v)) {
              this.micVolume = v
              if (v > 0) this.lastNonZeroMic = v
            }
          }
        }
        this.notify()
      })
      .catch(() => {
        execAsync("wpctl get-volume @DEFAULT_AUDIO_SOURCE@")
          .then((out) => {
            if (this.isSettingSource) return
            const muted = out.includes("MUTED")
            const parts = out.split(":")
            if (parts.length >= 2) {
              const v = Math.round(parseFloat(parts[1]) * 100)
              if (!isNaN(v)) {
                this.micVolume = v
                if (v > 0) this.lastNonZeroMic = v
              }
            }
            this.isMicMuted = muted
            this.notify()
          })
          .catch(() => {})
      })
  }

  public setVolume(val: number) {
    val = Math.max(0, Math.min(100, Math.round(val)))
    this.isSettingSink = true
    this.volume = val
    if (val > 0) {
      this.lastNonZeroVolume = val
      this.isMuted = false
    } else {
      this.isMuted = true
    }
    this.notify()

    if (this.sinkDebounceTimer) {
      GLib.source_remove(this.sinkDebounceTimer)
      this.sinkDebounceTimer = 0
    }
    this.sinkDebounceTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 25, () => {
      this.sinkDebounceTimer = 0
      execAsync(`wpctl set-volume @DEFAULT_AUDIO_SINK@ ${val / 100}`)
        .then(() => {
          if (val === 0) return execAsync("wpctl set-mute @DEFAULT_AUDIO_SINK@ 1")
          else return execAsync("wpctl set-mute @DEFAULT_AUDIO_SINK@ 0")
        })
        .catch(() => {})
        .finally(() => {
          GLib.timeout_add(GLib.PRIORITY_DEFAULT, 80, () => {
            this.isSettingSink = false
            return false
          })
        })
      return false
    })
  }

  public toggleMute() {
    this.isSettingSink = true
    const newMuted = !this.isMuted
    this.isMuted = newMuted
    if (!newMuted && this.volume === 0) {
      this.volume = this.lastNonZeroVolume > 0 ? this.lastNonZeroVolume : 50
    }
    this.notify()

    execAsync(`wpctl set-mute @DEFAULT_AUDIO_SINK@ ${newMuted ? 1 : 0}`)
      .then(() => {
        if (!newMuted) {
          return execAsync(`wpctl set-volume @DEFAULT_AUDIO_SINK@ ${this.volume / 100}`)
        }
      })
      .catch(() => {})
      .finally(() => {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 80, () => {
          this.isSettingSink = false
          return false
        })
      })
  }

  public setMicVolume(val: number) {
    val = Math.max(0, Math.min(100, Math.round(val)))
    this.isSettingSource = true
    this.micVolume = val
    if (val > 0) {
      this.lastNonZeroMic = val
      this.isMicMuted = false
    } else {
      this.isMicMuted = true
    }
    this.notify()

    if (this.sourceDebounceTimer) {
      GLib.source_remove(this.sourceDebounceTimer)
      this.sourceDebounceTimer = 0
    }
    this.sourceDebounceTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 25, () => {
      this.sourceDebounceTimer = 0
      execAsync(`pactl set-source-volume @DEFAULT_SOURCE@ ${val}%`)
        .catch(() => execAsync(`wpctl set-volume @DEFAULT_AUDIO_SOURCE@ ${val / 100}`))
        .then(() => {
          if (val === 0) {
            execAsync("pactl set-source-mute @DEFAULT_SOURCE@ 1").catch(() => {})
            execAsync(`bash -c "echo 'muted' > ~/.config/hypr/.mic_state"`).catch(() => {})
          } else {
            execAsync("pactl set-source-mute @DEFAULT_SOURCE@ 0").catch(() => {})
            execAsync(`bash -c "echo 'unmuted' > ~/.config/hypr/.mic_state"`).catch(() => {})
          }
        })
        .finally(() => {
          GLib.timeout_add(GLib.PRIORITY_DEFAULT, 80, () => {
            this.isSettingSource = false
            return false
          })
        })
      return false
    })
  }

  public toggleMicMute() {
    this.isSettingSource = true
    const newMuted = !this.isMicMuted
    this.isMicMuted = newMuted
    if (!newMuted && this.micVolume === 0) {
      this.micVolume = this.lastNonZeroMic > 0 ? this.lastNonZeroMic : 50
    }
    this.notify()

    const stateStr = newMuted ? "muted" : "unmuted"
    execAsync(`bash -c "echo '${stateStr}' > ~/.config/hypr/.mic_state"`).catch(() => {})

    execAsync(`pactl set-source-mute @DEFAULT_SOURCE@ ${newMuted ? 1 : 0}`)
      .catch(() => execAsync(`wpctl set-mute @DEFAULT_AUDIO_SOURCE@ ${newMuted ? 1 : 0}`))
      .then(() => {
        if (!newMuted) {
          return execAsync(`pactl set-source-volume @DEFAULT_SOURCE@ ${this.micVolume}%`)
            .catch(() => execAsync(`wpctl set-volume @DEFAULT_AUDIO_SOURCE@ ${this.micVolume / 100}`))
        }
      })
      .catch(() => {})
      .finally(() => {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 80, () => {
          this.isSettingSource = false
          return false
        })
      })
  }

  private startEventListener() {
    try {
      const proc = new Gio.Subprocess({
        argv: ["pactl", "subscribe"],
        flags: Gio.SubprocessFlags.STDOUT_PIPE,
      })
      proc.init(null)
      const pipe = proc.get_stdout_pipe()
      if (!pipe) return
      const stdout = new Gio.DataInputStream({ base_stream: pipe })

      const readNext = () => {
        stdout.read_line_async(GLib.PRIORITY_DEFAULT, null, (_, res) => {
          try {
            const [line] = stdout.read_line_finish_utf8(res)
            if (line !== null) {
              if (line.includes("'change' on sink")) {
                this.syncSink()
              } else if (line.includes("'change' on source")) {
                this.syncSource()
              }
              readNext()
            } else {
              GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
                this.startEventListener()
                return false
              })
            }
          } catch (_) {
            GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
              this.startEventListener()
              return false
            })
          }
        })
      }
      readNext()
    } catch (_) {}
  }
}

export const audioService = new AudioService()
