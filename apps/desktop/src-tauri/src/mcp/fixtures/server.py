"""Deterministic stdio peer; protocol fixture only, never product dispatch."""
import json
import subprocess
import sys

mode = sys.argv[1]
if mode == "tree":
    child = subprocess.Popen(["/bin/sleep", "30"])
    print(child.pid, flush=True)
    child.wait()
    sys.exit(0)

for line in sys.stdin:
    request = json.loads(line)
    method = request.get("method")
    if "id" not in request:
        continue
    if method == "server/discover":
        if mode == "legacy":
            print(json.dumps({"jsonrpc": "2.0", "id": request["id"], "error": {"code": -32601, "message": "unsupported"}}), flush=True)
            continue
        result = {"resultType": "complete", "supportedVersions": ["2026-07-28"], "capabilities": {"tools": {}, "resources": {}}, "ttlMs": 0, "cacheScope": "private"}
    elif method == "initialize":
        result = {"protocolVersion": "2025-11-25", "capabilities": {"tools": {}, "resources": {}}, "serverInfo": {"name": "fixture", "version": "1"}}
    elif method == "tools/list":
        result = {"resultType": "complete", "tools": [{"name": "counter", "inputSchema": {"type": "object"}}]}
    elif method == "tools/call":
        if mode == "oversized":
            sys.stdout.write("x" * (1024*1024+1))
            sys.stdout.flush()
            continue
        result = {"resultType": "complete", "content": [{"type": "text", "text": "one"}]}
    elif method == "resources/list":
        result = {"resultType": "complete", "resources": [{"uri": "fixture://note", "name": "note"}]}
    elif method == "resources/read":
        result = {"resultType": "complete", "contents": [{"uri": "fixture://note", "text": "fixture note"}]}
    else:
        continue
    print(json.dumps({"jsonrpc": "2.0", "id": request["id"], "result": result}), flush=True)
