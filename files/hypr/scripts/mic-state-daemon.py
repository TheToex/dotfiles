#!/usr/bin/env python3
import subprocess
import os
import sys

STATE_FILE = os.path.expanduser("~/.config/hypr/.mic_state")

def check_and_save():
    try:
        out = subprocess.check_output(["wpctl", "get-volume", "@DEFAULT_AUDIO_SOURCE@"], text=True)
        state = "muted" if "MUTED" in out else "unmuted"
        with open(STATE_FILE, "w") as f:
            f.write(state + "\n")
    except Exception:
        pass

def main():
    check_and_save()
    try:
        proc = subprocess.Popen(["pactl", "subscribe"], stdout=subprocess.PIPE, text=True, bufsize=1)
        for line in proc.stdout:
            if "source" in line:
                check_and_save()
    except Exception:
        sys.exit(1)

if __name__ == "__main__":
    main()

