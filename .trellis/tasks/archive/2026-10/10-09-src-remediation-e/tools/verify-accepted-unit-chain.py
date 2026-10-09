#!/usr/bin/env python3
"""Verify accepted E unit root hashes as a serial change chain, without editing evidence."""
from pathlib import Path
import json,hashlib,sys
root=Path.cwd();task=Path(__file__).resolve().parents[1]
end=sys.argv[1]
entryTarget=None
if len(sys.argv)>2:
 if len(sys.argv)!=4 or sys.argv[2]!='--against-entry' or not (len(sys.argv[3])==3 and sys.argv[3].startswith('E') and sys.argv[3][1:].isdigit()):raise SystemExit('Optional --against-entry E03')
 entryTarget=sys.argv[3]
if not (len(end)==3 and end.startswith('E') and end[1:].isdigit()):raise SystemExit('Supply accepted final E unit')
state=json.loads((task/'research/E01-entry.json').read_text())['hashes'].copy()
errors=[];units=[]
for n in range(1,int(end[1:])+1):
 unit=f'E{n:02}';path=task/'reviews'/f'{unit}-check-snapshot.json';snapshot=json.loads(path.read_text())
 accepted = snapshot.get('status') == 'PASS' or (snapshot.get('status') == 'COMPLETED' and snapshot.get('verdict') == 'PASS' and snapshot.get('closed') is True)
 if not accepted or snapshot.get('blockers'):errors.append(unit+' not accepted PASS')
 before=snapshot['before'];after=snapshot['after'];changed=snapshot.get('changedFiles')
 if changed is None:changed=[row['path'] for row in snapshot['files']]
 if set(changed)!=set(before) or set(changed)!=set(after):errors.append(unit+' scope map mismatch')
 mismatches=[]; expandedEntry=[]
 unitEntry=json.loads((task/'research'/f'{unit}-entry.json').read_text())
 for file in changed:
  # Older serial inventories deliberately covered src/tests/scripts only.
  # Expanded final config paths must prove their exact captured before bytes,
  # rather than silently seeding absent state from the review's own assertion.
  if file not in state and before[file] is not None and not file.startswith(('src/','tests/','scripts/')):
   preserved=unitEntry.get('beforeCopies',{}).get(file)
   copy=root/preserved['copy'] if preserved else None
   actual=hashlib.sha256(copy.read_bytes()).hexdigest() if copy and copy.is_file() else None
   if not preserved or preserved['sha256']!=before[file] or actual!=before[file]:mismatches.append(file+' expanded before preservation mismatch')
   else:
    state[file]=actual;expandedEntry.append({'path':file,'sha256':actual,'preservedBeforeCopy':preserved['copy']})
  if state.get(file)!=before[file]:mismatches.append(file)
  if after[file] is None:state.pop(file,None)
  else:state[file]=after[file]
 if mismatches:errors.append({'unit':unit,'serialBeforeMismatch':mismatches})
 units.append({'unit':unit,'snapshotSHA256':hashlib.sha256(path.read_bytes()).hexdigest(),'changedFileCount':len(changed),'serialBeforeMismatches':mismatches,'explicitExpandedBeforeClosure':expandedEntry})
current={str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for folder in ['src','tests','scripts'] for p in (root/folder).rglob('*') if p.is_file() and 'vendor' not in p.parts}
if entryTarget:current=json.loads((task/'research'/f'{entryTarget}-entry.json').read_text())['hashes']
# Config/package additions are handled by the final unit's explicit expanded root scope.
ownedOutside={f for f in state if not f.startswith(('src/','tests/','scripts/'))}
for file in ownedOutside if not entryTarget else []:
 p=root/file
 if p.is_file():current[file]=hashlib.sha256(p.read_bytes()).hexdigest()
actualDrift=[f for f in sorted(set(state)|set(current)) if state.get(f)!=current.get(f)]
if actualDrift:errors.append({'currentVersusAcceptedChainDrift':actualDrift})
print(json.dumps({'purpose':'Accepted root-source serial attribution only; not artifact/spec integrity, native behavior, final batch acceptance or QG01 proof','acceptedThrough':end,'comparisonTarget':entryTarget or 'actual working tree','units':units,'expectedCurrentInputs':len(state),'currentInputs':len(current),'errors':errors},ensure_ascii=False,indent=2))
sys.exit(1 if errors else 0)
