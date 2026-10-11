"""Read-only assertions for the isolated, real packaged product UI smoke.

Run after the UI flow; this script never seeds or mutates the workspace.
The application identifier deliberately differs from the developer's normal app.
"""
import hashlib
import json
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parent
WORKSPACE = Path.home() / "Library/Application Support/dev.cuepoint.shared-ui-review.20261011/workspace"
PROJECT = "7c2cafc3-64d0-408e-8b27-49eace351997"
EPISODE = "b714827e-cc92-4cba-8461-54ae4ace92a8"
SHOT = "68ec137d-2317-41c2-b0cf-7ed964bf4dea"

with sqlite3.connect(f"file:{WORKSPACE / 'metadata.sqlite'}?mode=ro", uri=True) as connection:
    connection.row_factory = sqlite3.Row
    rows = {
        table: [dict(row) for row in connection.execute(f"SELECT * FROM {table}")]
        for table in ["projects", "video_projects", "episodes", "beats", "shots", "assets"]
    }

project = next(row for row in rows["projects"] if row["id"] == PROJECT)
video = next(row for row in rows["video_projects"] if row["project_id"] == PROJECT)
episode = next(row for row in rows["episodes"] if row["id"] == EPISODE)
shot = next(row for row in rows["shots"] if row["id"] == SHOT)
assert project["title"] == "共享原生界面验收"
assert video["mode"] == "series" and video["aspect_preset"] == "9:16"
assert (video["output_width"], video["output_height"]) == (1080, 1920)
assert video["brief"] == "同一套产品界面，SQLite 保存本机工作区。"
assert video["logline"] == "创作者在原生工作区完成同一部作品。"
assert video["shot_default_duration"] == 2.25 and video["shot_auto_increment"] == 0
assert episode["title"] == "开场" and episode["logline"] == "创作者打开原生工作区。"
assert episode["script"] == "清晨，创作者打开工作区。他写下故事，并逐个制作镜头。"
assert episode["shot_filter_statuses"] == "ready"
assert len([row for row in rows["episodes"] if row["project_id"] == PROJECT]) == 2
assert rows["beats"][0]["title"] == "清晨" and rows["beats"][0]["time_of_day"] == "日"
assert shot["content"] == "中景：创作者打开工作区。" and shot["notes"] == "本机验收"
assert shot["duration_sec"] == 3.5 and shot["status"] == "ready"
assert len(rows["shots"]) == 7
assert sorted(row["item_order"] for row in rows["shots"]) == list(range(7))
assert all(row["duration_sec"] == 2.25 for row in rows["shots"] if row["id"] != SHOT)

assert len(rows["assets"]) == 1
asset = rows["assets"][0]
managed = (WORKSPACE / asset["relative_path"]).resolve()
assert managed.is_relative_to(WORKSPACE.resolve())
assert managed.is_file() and managed.stat().st_size == asset["byte_length"] == 13718
source = Path("desktop/tauri/src-tauri/icons/128x128.png").resolve()
assert managed != source
digest = hashlib.sha256(managed.read_bytes()).hexdigest()
assert digest == asset["content_hash"] == hashlib.sha256(source.read_bytes()).hexdigest()
assert json.loads((WORKSPACE / "workspace.ready.json").read_text())["schema"] == 4

output = {
    "status": "passed",
    "sqliteConnection": "read-only",
    "workspaceIdentifier": "dev.cuepoint.shared-ui-review.20261011",
    "rows": rows,
    "managedCopy": {"relativePath": asset["relative_path"], "sha256": digest,
                    "byteLength": asset["byte_length"], "distinctFromSource": True},
}
(ROOT / "mac-product-smoke/final-sqlite.json").write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
print("Actual UI-created SQLite rows and managed file copy: all assertions passed")
