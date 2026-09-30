"""Render C reviewed final files into disjoint concrete commit groups; never stage/commit."""
from pathlib import Path
import json, subprocess, hashlib
root=Path.cwd();task=Path(__file__).resolve().parents[1]
latest={}
for unit in ("C01","C02","C03","C04","C05","C06"):
 p=task/"reviews"/(unit+"-check-snapshot.json")
 if not p.exists():raise SystemExit("Missing independent unit review: "+unit)
 d=json.loads(p.read_text())
 if d.get("status")!="PASS":raise SystemExit("Unaccepted unit: "+unit)
 for f,h in d["after"].items():latest[f]={"unit":unit,"sha256":h}
finalpath=task/"reviews/C-final-check-snapshot.json"
if not finalpath.exists():raise SystemExit("Final independent full-scope check required")
final=json.loads(finalpath.read_text())
if final.get("status")!="PASS":raise SystemExit("Final independent PASS required")
for f,u in final.get("unitUpdates",{}).items():
 if f not in latest:raise SystemExit("Unreviewed final attribution")
 latest[f]={"unit":u["unit"],"sha256":u["sha256"]}
for f,review in latest.items():
 if hashlib.sha256((root/f).read_bytes()).hexdigest()!=review["sha256"]:raise SystemExit("Changed after independent review: "+f)
dirty=set()
for args in (["git","diff","HEAD","--name-only","-z"],["git","ls-files","--others","--exclude-standard","-z"]):dirty.update(p for p in subprocess.check_output(args,text=True).split("\0") if p)
dirty.update(str((task/name).relative_to(root)) for name in ("commit-plan.json","commit-plan.md"))
product_dirty={f for f in dirty if f.startswith(("src/","tests/")) or f in ("scripts/c01-browser-regression.mjs","scripts/c02-browser-regression.mjs")}
if set(final.get("after",{}))!=product_dirty:raise SystemExit("Final review scope differs from product changes")
for f in product_dirty:
 if final["after"][f]!=latest[f]["sha256"]:raise SystemExit("Final review hash differs: "+f)
groups=[
 ("fix: 区分当前生成成果和历史调用来源",{"C01"},[".trellis/spec/frontend/agent-task-wrapup.md"]),
 ("fix: 保持音乐参数与音频导入成果一致",{"C02","C04"},[".trellis/spec/frontend/audio-music.md"]),
 ("fix: 校验项目关系和媒体写入边界",{"C03","C05"},[".trellis/spec/frontend/state-management.md",".trellis/spec/frontend/production-contracts.md",".trellis/spec/frontend/asset-output-foundation.md"]),
 ("fix: 在读取时限制服务响应大小",{"C06"},[".trellis/spec/frontend/ai-connectors.md"]),
]
commits=[];assigned=set()
for message,units,specs in groups:
 files={f for f,r in latest.items() if r["unit"] in units and f in dirty}|{f for f in specs if f in dirty}
 if assigned&files:raise SystemExit("Overlapping file groups")
 assigned|=files
 commits.append({"message":message,"units":sorted(units),"files":sorted(files)})
remaining=dirty-assigned
prefixes=(".trellis/tasks/09-30-src-remediation-c/",".trellis/tasks/09-30-src-remediation-b/",".trellis/tasks/09-30-src-quality-remediation/")
unknown=sorted(f for f in remaining if not f.startswith(prefixes))
commits.append({"message":"chore: 记录源码整改C验证与后续关口","files":sorted(remaining-set(unknown))})
plan={"status":"awaiting-concrete-user-confirmation","baseRevision":subprocess.check_output(["git","rev-parse","HEAD"],text=True).strip(),"commits":commits,"unrecognizedDirtyFiles":unknown,"reviewedFiles":latest,"approval":None}
(task/"commit-plan.json").write_text(json.dumps(plan,ensure_ascii=False,indent=2)+"\n")
lines=["# C concrete commit plan","","No stage/commit/push by this tool. Wait for human approval after final complete gate and full review.",""]
for n,c in enumerate(commits,1):
 lines += [str(n)+". "+c["message"],"",str(len(c["files"]))+" files:",""]+["- "+f for f in c["files"]]+[""]
lines += ["Unrecognized dirty files:",""]+unknown
(task/"commit-plan.md").write_text("\n".join(lines)+"\n")
print(json.dumps({"commits":[{"message":c["message"],"files":len(c["files"])} for c in commits],"unknown":unknown},ensure_ascii=False))
