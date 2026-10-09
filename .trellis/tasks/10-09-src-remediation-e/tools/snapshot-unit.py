#!/usr/bin/env python3
"""Capture exact root source/test/runner changes versus a unit's frozen entry."""
from pathlib import Path
import hashlib,json,sys
unit=sys.argv[1]
if len(unit)!=3 or not unit.startswith('E') or not unit[1:].isdigit():raise SystemExit('Supply E unit')
task=Path(__file__).resolve().parents[1]
repo=task.parents[2]
entry=json.loads((task/'research'/f'{unit}-entry.json').read_text())
current={str(p.relative_to(repo)):hashlib.sha256(p.read_bytes()).hexdigest() for folder in ('src','tests','scripts') for p in (repo/folder).rglob('*') if p.is_file() and 'vendor' not in p.parts}
before=entry['hashes']
changed=sorted(f for f in set(before)|set(current) if before.get(f)!=current.get(f))
output={'unit':unit,'baselineRevision':entry['baselineRevision'],'purpose':'Review input inventory only; not independent acceptance','changedFiles':changed,'before':{f:before.get(f) for f in changed},'after':{f:current.get(f) for f in changed},'entrySnapshot':str((task/'research'/f'{unit}-entry.json').relative_to(repo)),'sourceFileCount':sum(f.startswith('src/') for f in current),'testRunnerFileCount':sum(not f.startswith('src/') for f in current)}
(task/'reviews').mkdir(exist_ok=True)
(target:=task/'reviews'/f'{unit}-review-input.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'unit':unit,'count':len(changed),'changedFiles':changed,'output':str(target)},ensure_ascii=False,indent=2))
