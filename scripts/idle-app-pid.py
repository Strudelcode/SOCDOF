"""Starts SOCDOF under dbus-run-session and prints the desktop process id for idle sampling."""
import os
import subprocess
import sys
import time

log = open("artifacts/idle.log", "wb")
proc = subprocess.Popen(
    ["dbus-run-session", "--", os.environ["APP_BIN"]],
    stdout=log,
    stderr=log,
    env=os.environ.copy(),
)


def descendants(root: int) -> list[int]:
    children: dict[int, list[int]] = {}
    for name in os.listdir("/proc"):
        if not name.isdigit():
            continue
        try:
            with open(f"/proc/{name}/stat", encoding="utf-8") as handle:
                fields = handle.read().rsplit(")", 1)[1].split()
            children.setdefault(int(fields[1]), []).append(int(name))
        except (OSError, IndexError, ValueError):
            continue
    found: list[int] = []
    stack = [root]
    while stack:
        for child in children.get(stack.pop(), []):
            found.append(child)
            stack.append(child)
    return found


for _ in range(60):
    # dbus-run-session may exec the target in-place, making proc.pid itself the desktop process.
    # Include the root process as well as descendants so both launch modes are detected.
    for pid in [proc.pid, *descendants(proc.pid)]:
        try:
            with open(f"/proc/{pid}/comm", encoding="utf-8") as handle:
                comm = handle.read().strip()
        except OSError:
            continue
        if comm.startswith("socdof"):
            print(pid)
            sys.exit(0)
    time.sleep(1)

if proc.poll() is not None:
    log.close()
    try:
        with open("artifacts/idle.log", "r", encoding="utf-8", errors="replace") as handle:
            tail = handle.read()[-6000:]
        print(f"SOCDOF exited during startup (code {proc.returncode}):\\n{tail}", file=sys.stderr)
    except OSError:
        print(f"SOCDOF exited during startup (code {proc.returncode})", file=sys.stderr)
else:
    print("no SOCDOF desktop process found after 60 seconds", file=sys.stderr)
sys.exit(1)
