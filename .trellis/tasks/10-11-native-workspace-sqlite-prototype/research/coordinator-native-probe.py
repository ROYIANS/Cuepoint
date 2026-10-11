"""Independent coordinator probe of the real feature-gated storage executable.

All mutations stay in a newly reserved ignored acceptance fixture. This script
does not implement storage and cannot stand in for packaged WebView acceptance.
"""
import hashlib
import json
import os
from pathlib import Path
import selectors
import signal
import subprocess
import time
import uuid

REPO = Path(__file__).resolve().parents[4]
EVIDENCE = Path(__file__).resolve().parent
BINARY = REPO / "desktop/tauri/.tools/target/release/workspace_probe"
BASE = REPO / "desktop/tauri/.acceptance" / ("coordinator-a-" + str(uuid.uuid4()))
BASE.mkdir(parents=True, exist_ok=False)
EVENTS = []
PROCESSES = []


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def line(process, timeout=15):
    with selectors.DefaultSelector() as selector:
        selector.register(process.stdout, selectors.EVENT_READ)
        assert selector.select(timeout), "native JSON response timed out"
    raw = process.stdout.readline()
    assert raw, "native process ended before its response"
    return json.loads(raw)


def launch(mode, root, *extra):
    index = len(PROCESSES)
    stderr = open(BASE / ("process-%d.stderr.log" % index), "wb")
    process = subprocess.Popen(
        [str(BINARY), mode, str(root), *map(str, extra)],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=stderr,
        text=True, bufsize=1,
    )
    PROCESSES.append((process, stderr))
    assert line(process) == {"ok": True, "ready": True}
    EVENTS.append({"event": "started", "mode": mode, "pid": process.pid})
    return process


def request(process, body, success=True):
    process.stdin.write(json.dumps(body, ensure_ascii=False) + "\n")
    process.stdin.flush()
    response = line(process)
    EVENTS.append({"request": body["op"], "response": response})
    assert response["ok"] is success, response
    return response.get("value", response.get("error"))


def close(process):
    assert request(process, {"op": "close"}) == {"closed": True}
    process.stdin.close()
    assert process.wait(timeout=5) == 0


def reject_start(mode, root, *extra):
    start = time.monotonic()
    result = subprocess.run(
        [str(BINARY), mode, str(root), *map(str, extra)],
        input="", text=True, capture_output=True, timeout=5,
    )
    elapsed = time.monotonic() - start
    EVENTS.append({"event": "rejected-start", "mode": mode,
                   "exitCode": result.returncode, "elapsedSec": elapsed,
                   "stdout": result.stdout, "stderr": result.stderr})
    assert result.returncode != 0
    return elapsed


def run():
    source = BASE / "selected-source.bin"
    source.write_bytes(bytes(range(256)) * 3073)
    original_hash = digest(source)
    root = BASE / "workspace"
    worker = launch("create", root)
    request(worker, {"op": "saveProject", "project": {"id": "项目/Case", "title": "原生验收"}})
    for asset_id, kind, owner in [("take-A", "media", "项目/Case"), ("take-a", "output", "项目/Case"), ("声音", "media", "studio")]:
        timing = None if owner == "studio" else {"id": "clip-" + asset_id, "projectId": owner,
                  "assetId": asset_id, "startSec": 1.25, "durationSec": 3}
        request(worker, {"op": "import", "source": str(source), "asset_id": asset_id,
                        "project_id": owner, "kind": kind, "display_name": "same.bin",
                        "mime_type": "application/octet-stream", "timing": timing})
    state = request(worker, {"op": "state"})["value"]
    assert len(state["assets"]) == 3 and len(state["references"]) == 2
    assert len({a["reference"]["relativePath"] for a in state["assets"]}) == 3
    source.write_bytes(b"external modification")
    source.unlink()
    assert all(digest(root / a["reference"]["relativePath"]) == original_hash for a in state["assets"])
    EVENTS.append({"event": "source-independent", "originalSha256": original_hash})
    backup = BASE / "backup"
    request(worker, {"op": "backup", "destination": str(backup)})
    assert not (backup / "writer.sqlite").exists()
    restored = BASE / "restored"
    copy = launch("restore", restored, backup)
    assert request(copy, {"op": "state"})["value"] == state
    assert all(digest(restored / a["reference"]["relativePath"]) == original_hash for a in state["assets"])
    close(copy)
    empty = BASE / "existing-empty"
    empty.mkdir()
    populated = BASE / "existing-populated"
    populated.mkdir()
    sentinel = populated / "keep.bin"
    sentinel.write_bytes(b"existing destination must survive")
    sentinel_hash = digest(sentinel)
    reject_start("restore", empty, backup)
    reject_start("restore", populated, backup)
    assert not list(empty.iterdir()) and digest(sentinel) == sentinel_hash
    assert reject_start("open", root) < 3
    close(worker)
    worker = launch("open", root)
    assert request(worker, {"op": "state"})["value"] == state
    missing, corrupt = state["assets"][:2]
    (root / missing["reference"]["relativePath"]).unlink()
    (root / corrupt["reference"]["relativePath"]).write_bytes(b"corrupt")
    availability = request(worker, {"op": "availability"})["value"]
    actual = {item["assetId"]: item["status"] for item in availability}
    assert actual[missing["id"]] == "missing" and actual[corrupt["id"]] == "corrupt"
    assert request(worker, {"op": "state"})["value"] == state
    request(worker, {"op": "backup", "destination": str(BASE / "incomplete-backup")}, False)
    assert not (BASE / "incomplete-backup/backup.complete.json").exists()
    close(worker)
    # A real native process pauses at the actual transaction boundary, then dies.
    source.write_bytes(bytes(range(256)) * 2051)
    preserved_hash = digest(source)
    unknown = root / "staging/unknown.keep"
    unknown.write_bytes(b"unrelated local bytes")
    marker = BASE / "precommit.marker"
    process = launch("open", root, "--pause", "precommit", "--marker", marker,
                     "--release", BASE / "release")
    process.stdin.write(json.dumps({"op": "import", "source": str(source), "asset_id": "killed-import",
                "project_id": "项目/Case", "kind": "media", "display_name": "kill.bin",
                "mime_type": "application/octet-stream", "timing": None}, ensure_ascii=False) + "\n")
    process.stdin.flush()
    deadline = time.monotonic() + 15
    while not marker.exists():
        assert process.poll() is None and time.monotonic() < deadline, "precommit hook not reached"
        time.sleep(0.005)
    os.kill(process.pid, signal.SIGKILL)
    assert process.wait(timeout=5) == -signal.SIGKILL
    EVENTS.append({"event": "genuine-sigkill", "point": "precommit", "pid": process.pid, "exitCode": -signal.SIGKILL})
    for _ in range(2):
        worker = launch("open", root)
        assert request(worker, {"op": "state"})["value"] == state
        close(worker)
    assert digest(source) == preserved_hash and unknown.read_bytes() == b"unrelated local bytes"
    EVENTS.append({"event": "recovery-idempotent", "sourceSha256": preserved_hash,
                   "unknownFilePreserved": True, "logicalStateUnchanged": True})
    return {"passed": True, "workspaceId": state["workspaceId"], "sqliteVersion": state["sqliteVersion"]}


result = {"passed": False}
try:
    result = run()
except BaseException as error:
    result["failure"] = repr(error)
    raise
finally:
    for process, stderr in PROCESSES:
        if process.poll() is None:
            process.kill()
            process.wait(timeout=5)
        stderr.close()
    result.update({"binarySha256": digest(BINARY) if BINARY.exists() else None,
                   "disposableRoot": str(BASE), "events": EVENTS,
                   "scope": "native CLI coordinator probe; no packaged compatibility claim"})
    encoded = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    (EVIDENCE / (BASE.name + "-probe.json")).write_text(encoded)
    (EVIDENCE / "coordinator-native-probe.json").write_text(encoded)
    print(json.dumps({key: value for key, value in result.items() if key != "events"}, ensure_ascii=False))
