"""Operate only the isolated packaged product via its accessibility tree.

Compile mac-product-smoke.swift to /tmp/cuepoint-shared-mac-smoke first.
Commands: PID inspect | press ROLE NAME [INDEX] | fill NAME TEXT [INDEX]
          PID key CODE | snapshot NAME | wait TEXT
"""
import json
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parent / "mac-product-smoke"
ROOT.mkdir(exist_ok=True)
HELPER = "/tmp/cuepoint-shared-mac-smoke"
pid, command, *args = sys.argv[1:]


def call(*values):
    return subprocess.check_output([HELPER, pid, *values], text=True)


def tree():
    return json.loads(call("dump"))


def control(role, name, index=0):
    matches = [r for r in tree() if r.get("AXRole") == role and
               name in (r.get("AXTitle"), r.get("AXDescription"), r.get("AXPlaceholderValue"))]
    if len(matches) <= index:
        raise RuntimeError(f"Missing {role} {name!r} at {index}")
    return matches[index]["path"]


if command == "inspect":
    for row in tree():
        if row.get("AXRole") in {"AXButton", "AXLink", "AXTextField", "AXTextArea", "AXHeading", "AXPopUpButton", "AXComboBox"}:
            print(json.dumps(row, ensure_ascii=False))
elif command == "press":
    call("press", control(args[0], args[1], int(args[2]) if len(args) > 2 else 0))
elif command == "fill":
    rows = tree()
    matches = [row for row in rows if row.get("AXRole") in {"AXTextField", "AXTextArea"} and
               args[0] in (row.get("AXTitle"), row.get("AXDescription"), row.get("AXPlaceholderValue"))]
    call("fill", matches[int(args[2]) if len(args) > 2 else 0]["path"], args[1])
elif command == "key":
    call("key", args[0])
elif command == "snapshot":
    (ROOT / f"{args[0]}-ax.json").write_text(json.dumps(tree(), ensure_ascii=False, indent=2) + "\n")
    windows = json.loads(call("windows"))
    window = next(row for row in windows if row["kCGWindowLayer"] == 0)
    subprocess.run(["/usr/sbin/screencapture", "-x", "-l", str(window["kCGWindowNumber"]), str(ROOT / f"{args[0]}.png")], check=True)
elif command == "wait":
    deadline = time.monotonic() + 12
    while True:
        if any(args[0] in str(row.get("AXValue", "")) or args[0] in str(row.get("AXTitle", "")) for row in tree()):
            break
        if time.monotonic() >= deadline:
            raise RuntimeError(f"Text did not appear: {args[0]}")
        time.sleep(0.2)
else:
    raise RuntimeError("Unknown command")

with (ROOT / "operations.jsonl").open("a") as output:
    output.write(json.dumps({"pid": pid, "command": command, "arguments": args, "status": "passed"}, ensure_ascii=False) + "\n")
