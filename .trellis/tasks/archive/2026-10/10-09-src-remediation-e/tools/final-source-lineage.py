"""Inventory actual authored src and historical review ownership; not new review acceptance."""
from pathlib import Path
from hashlib import sha256
from datetime import datetime, timezone
import json, argparse
root=Path.cwd(); task=root/'.trellis/tasks/10-09-src-remediation-e'
audit=root/'.trellis/tasks/09-30-src-quality-architecture-audit/research/coverage.json'
ledger=root/'.trellis/tasks/09-30-src-quality-remediation/remediation-ledger.json'
parser=argparse.ArgumentParser();parser.add_argument('--label',required=True);args=parser.parse_args()
def digest(p):return sha256(p.read_bytes()).hexdigest()
a=json.loads(audit.read_text());l=json.loads(ledger.read_text())
original={r['path']:r for r in a['files']};owners={}
for u in l['units']:
 for path in u.get('changedFiles',[]):
  if path.startswith('src/'):
   owners.setdefault(path,[]).append({'unit':u['id'],'status':u['status'],'review':u.get('review')})
current={str(p.relative_to(root)):p for p in (root/'src').rglob('*') if p.is_file() and 'vendor' not in p.relative_to(root/'src').parts}
rows=[]
for path in sorted(set(original)|set(current)):
 before=original.get(path);p=current.get(path);after=digest(p) if p else None
 state='retired' if not p else 'added' if not before else 'unchanged-since-audit' if after==before['sha256'] else 'changed-since-audit'
 rows.append({'path':path,'lineage':state,'currentSHA256':after,'originalSHA256':before['sha256'] if before else None,'originalReviewStatus':before['status'] if before else None,'originalGroup':before.get('group') if before else None,'recordedUnitOwners':owners.get(path,[]),'needsFinalClosureInterpretation':state!='unchanged-since-audit','hasRecordedUnitOwner':bool(owners.get(path))})
counts={state:sum(r['lineage']==state for r in rows) for state in sorted({r['lineage'] for r in rows})}
out=task/'research'/f'{args.label}-source-lineage.json'
if out.exists():raise SystemExit('Refusing overwrite '+str(out))
data={'purpose':'Actual full authored-src inventory with original audit and ledger attribution, not a fresh manual review or acceptance. Pending/current-unit paths may lack ledger owners until completion.','capturedAt':datetime.now(timezone.utc).isoformat(),'label':args.label,'originalAudit':{'path':str(audit.relative_to(root)),'sha256':digest(audit),'files':len(original)},'ledger':{'path':str(ledger.relative_to(root)),'sha256':digest(ledger),'currentUnit':l['currentUnit']},'actualCurrentFiles':len(current),'counts':counts,'unassignedChanges':[r['path'] for r in rows if r['needsFinalClosureInterpretation'] and not r['hasRecordedUnitOwner']],'rows':rows}
out.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:data[k] for k in ['actualCurrentFiles','counts','unassignedChanges']},ensure_ascii=False,indent=2))
