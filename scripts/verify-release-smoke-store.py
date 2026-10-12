#!/usr/bin/env python3
"""Read-only disk proof after the release product's observed process exit.

This host script is never bundled. It cannot create/repair rows or write files.
"""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import sqlite3
import stat
import uuid


def require(condition, message):
    if not condition:
        raise ValueError(message)


def ordinary(path, directory=False):
    info = path.lstat()
    require(not stat.S_ISLNK(info.st_mode), f"Symlink rejected: {path}")
    require(not getattr(info, "st_file_attributes", 0) & 0x400, f"Reparse point rejected: {path}")
    require(stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode),
            f"Unexpected file type: {path}")
    if not directory:
        require(info.st_nlink == 1, f"Unowned hard links rejected: {path}")
    return info


def decode(value):
    require(isinstance(value, list) and len(value) in (1, 2), "Malformed stored codec value")
    tag = value[0]
    if tag in ("null", "undef"):
        require(len(value) == 1, "Malformed empty codec value")
        return None
    require(len(value) == 2, "Missing codec payload")
    payload = value[1]
    if tag in ("str", "date"):
        require(isinstance(payload, str), "Malformed codec string")
        return payload
    if tag == "bool":
        require(isinstance(payload, bool), "Malformed codec boolean")
        return payload
    if tag == "num":
        require(isinstance(payload, (int, float)) and not isinstance(payload, bool) and math.isfinite(payload),
                "Expected finite numeric codec value")
        return payload
    if tag == "obj":
        require(isinstance(payload, list), "Malformed codec object")
        result = {}
        for entry in payload:
            require(isinstance(entry, list) and len(entry) == 2 and isinstance(entry[0], str), "Malformed codec entry")
            require(entry[0] not in result, "Duplicate codec key")
            result[entry[0]] = decode(entry[1])
        return result
    if tag == "arr":
        require(isinstance(payload, list), "Malformed codec array")
        return [decode(item) for item in payload]
    if tag == "binary":
        require(isinstance(payload, dict), "Malformed binary reference")
        return payload
    raise ValueError(f"Unsupported smoke codec tag: {tag}")


def decode_stored_key(value):
    # Rust full_product_store::protocol::WireText stores exactly four lowercase
    # hex digits per UTF-16 unit in SQL. IPC text and tagged payload strings are
    # separate representations; never treat a raw row_key as plaintext.
    require(isinstance(value, str) and len(value) % 4 == 0
            and all(character in "0123456789abcdef" for character in value),
            "Malformed stored UTF-16 identity")
    return bytes.fromhex(value).decode("utf-16-be", errors="surrogatepass")


def records(connection, table):
    return [(decode_stored_key(key), decode(json.loads(payload))) for key, payload in connection.execute(
        "SELECT row_key,payload FROM product_records WHERE table_name=?", (table,))]


def verify(workspace, expected):
    workspace = Path(workspace)
    require(workspace.is_absolute(), "Workspace must be absolute")
    ordinary(workspace, True)
    ordinary(workspace / ".local", True)
    database = workspace / ".local" / "state.sqlite"
    ordinary(database)
    require(expected["fixtureBytes"] > 262144, "Fixture must exercise multiple binary chunks")
    require(not os.path.lexists(expected["sourcePath"]), "Original import source still exists")
    # Process exit must checkpoint and close SQLite. immutable=1 then guarantees
    # the verifier cannot create SQLite sidecars or modify the candidate store.
    for suffix in ("-wal", "-journal"):
        sidecar = Path(str(database) + suffix)
        require(not sidecar.exists() or sidecar.stat().st_size == 0,
                "Uncheckpointed SQLite after process exit")
    with sqlite3.connect(database.as_uri() + "?mode=ro&immutable=1", uri=True) as connection:
        connection.execute("PRAGMA query_only=ON")
        require(connection.execute("PRAGMA quick_check").fetchall() == [("ok",)], "SQLite integrity failed")
        owners = connection.execute("SELECT id,schema,change_sequence FROM product_workspace").fetchall()
        require(len(owners) == 1 and owners[0][1] == 1 and owners[0][2] > 0, "Missing committed workspace owner")
        workspace_id = owners[0][0]
        projects = [(key, row) for key, row in records(connection, "projects")
                    if row.get("name") == expected["projectName"]]
        require(len(projects) == 1 and projects[0][0] == projects[0][1]["id"], "Expected one persisted UI project")
        materials = [(key, row) for key, row in records(connection, "libraryMaterials")
                     if row.get("name") == expected["fixtureFilename"]]
        require(len(materials) == 1, "Expected one imported UI material")
        material_key, material = materials[0]
        require(material_key == material["id"] and material["revision"] == 1
                and material["kind"] == "document" and material["scope"] == {"kind": "global"},
                "Unexpected material identity/revision/scope")
        versions = [(key, row) for key, row in records(connection, "materialVersions")
                    if row.get("materialId") == material_key]
        require(len(versions) == 1 and versions[0][1]["revision"] == 1, "Missing committed material version")
        version_key, version = versions[0]
        require(version_key == version["id"], "Version key mismatch")
        payload = version["payload"]
        require(payload["type"] == "file" and payload["filename"] == expected["fixtureFilename"]
                and payload["mimeType"] == "text/plain", "Wrong stored file payload")
        reference = payload["blob"]
        require(set(reference) == {"version", "workspaceId", "binaryId", "byteLength", "contentHash", "mimeType"},
                "Unexpected managed binary reference fields")
        binary_id = reference["binaryId"]
        require(str(uuid.UUID(binary_id)) == binary_id, "Noncanonical binary ID")
        require(reference["version"] == 1 and reference["workspaceId"] == workspace_id
                and reference["byteLength"] == expected["fixtureBytes"]
                and reference["contentHash"] == expected["fixtureSha256"]
                and reference["mimeType"] == "text/plain", "Managed reference does not match exact import")
        committed = connection.execute(
            "SELECT byte_length,mime_type,content_hash,operation_id FROM product_binaries WHERE binary_id=?",
            (binary_id,)).fetchall()
        require(len(committed) == 1 and committed[0][:3] == (
            expected["fixtureBytes"], "text/plain", expected["fixtureSha256"]), "Missing committed binary authority")
        operation_id = committed[0][3]
        require(connection.execute("SELECT status FROM product_operations WHERE operation_id=?", (operation_id,)).fetchall()
                == [("committed",)], "Binary was not committed with a product operation")
        require(connection.execute("SELECT count(*) FROM product_binary_intents").fetchone()[0] == 0,
                "Incomplete binary intent remains")
        asset = workspace / "assets" / ("id-" + binary_id.encode("utf-8").hex())
        ordinary(asset.parent, True)
        before = ordinary(asset)
        content = asset.read_bytes()
        after = ordinary(asset)
        require((before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns)
                == (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns), "Asset changed while verifying")
        require(len(content) == expected["fixtureBytes"] and hashlib.sha256(content).hexdigest() == expected["fixtureSha256"],
                "Owned binary bytes differ from original fixture")
        require(expected["previewMarker"].encode("utf-8") in content[:16000], "Preview marker missing from owned bytes")
        return {"schema": 1, "status": "passed", "workspaceId": workspace_id, "schemaVersion": owners[0][1],
                "projectId": projects[0][0], "materialId": material_key, "versionId": version_key,
                "binaryId": binary_id, "byteLength": len(content), "sha256": hashlib.sha256(content).hexdigest(),
                "operationId": operation_id, "originalSourceAbsent": True,
                "claim": "Read-only SQLite and owned-file proof after observed process exit; no power-loss claim."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", required=True)
    parser.add_argument("--expectation", required=True)
    args = parser.parse_args()
    print(json.dumps(verify(args.workspace, json.loads(Path(args.expectation).read_text(encoding="utf-8"))), sort_keys=True))


if __name__ == "__main__":
    main()
