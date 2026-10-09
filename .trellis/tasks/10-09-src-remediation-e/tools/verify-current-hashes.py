#!/usr/bin/env python3
"""Read-only hash verification for explicit accepted snapshots, including absence."""
from pathlib import Path
import json,hashlib,sys
snapshot=Path(sys.argv[1])
record=json.loads(snapshot.read_text())
field=sys.argv[2] if len(sys.argv)>2 else 'after'
if field not in record or not isinstance(record[field],dict):raise SystemExit('Missing hash field '+field)
errors=[]
for name,expected in record[field].items():
 if expected is not None and (not isinstance(expected,str) or len(expected)!=64):raise SystemExit('Invalid hash record '+name)
 p=Path(name)
 actual=hashlib.sha256(p.read_bytes()).hexdigest() if p.is_file() else None
 if actual!=expected:errors.append({'file':name,'expected':expected,'actual':actual})
print(json.dumps({'snapshot':str(snapshot),'field':field,'paths':len(record[field]),'mismatches':errors},ensure_ascii=False,indent=2))
sys.exit(1 if errors else 0)
