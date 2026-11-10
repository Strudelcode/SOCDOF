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
    for pid in descendants(proc.pid):
        try:
            with open(f"/proc/{pid}/comm", encoding="utf-8") as handle:
                comm = handle.read().strip()
        except OSError:
            continue
        if comm.startswith("socdof"):
            print(pid)
            sys.exit(0)
    time.sleep(1)

print("no socdof-desktop process found", file=sys.stderr)
sys.exit(1)
