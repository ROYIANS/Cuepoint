# -*- coding: utf-8 -*-
from pathlib import Path
from collections import Counter
import json,sys,os
root=Path(__file__).resolve().parents[1]
repo=next(path for path in root.parents if (path / ".trellis").is_dir())
os.chdir(repo)
ledger=json.loads((root/'remediation-ledger.json').read_text())
audit=Path(ledger['auditTask'])
expected={f['id'] for f in json.loads((audit/'research/findings.json').read_text())['findings']}
actual=[f['id'] for f in ledger['findings']]
assigned=[id for unit in ledger['units'] for id in unit['findings']]
errors=[]
if set(actual)!=expected or len(actual)!=len(expected):errors.append('finding inventory mismatch')
if set(assigned)!=expected or len(assigned)!=len(expected):errors.append('unit mapping missing/duplicated')
if [u['id'] for u in ledger['units']] != sorted(u['id'] for u in ledger['units']):errors.append('unit order drift')
if ledger['currentUnit'] is not None and ledger['currentUnit'] not in {u['id'] for u in ledger['units']}:errors.append('unknown current unit')
seen_unverified=False
for unit in ledger['units']:
 if unit['status']!='verified':seen_unverified=True
 elif seen_unverified:errors.append(unit['id']+' verified ahead of unfinished earlier unit')
first_unfinished=next((u['id'] for u in ledger['units'] if u['status']!='verified'),None)
if ledger['currentUnit']!=first_unfinished:errors.append('current unit must be first unfinished unit')
for unit in ledger['units']:
 if unit['status'] not in ['pending','in_progress','verified']:errors.append(unit['id']+' invalid unit status')
 if unit['status']=='verified' and any(f['status'] not in ['fixed','validated-no-change'] for f in ledger['findings'] if f['id'] in unit['findings']):errors.append(unit['id']+' verified but linked finding not resolved')
 if unit['status']=='verified' and (not unit.get('review') or not Path(unit['review']).exists() or not unit['checks']):errors.append(unit['id']+' lacks verification evidence')
for finding in ledger['findings']:
 if finding['status'] not in ['pending','in_progress','fixed','validated-no-change']:errors.append(finding['id']+' invalid finding status')
 for evidence in finding.get('evidence',[]):
  if not Path(evidence).exists():errors.append(finding['id']+' missing evidence '+evidence)
 unit=next(u for u in ledger['units'] if finding['id'] in u['findings'])
 if finding['unit']!=unit['id']:errors.append(finding['id']+' points to wrong unit')
 if finding['status'] in ['fixed','validated-no-change'] and (unit['status']!='verified' or not finding['resolution'] or not finding['evidence']):errors.append(finding['id']+' closed without evidence')
for work in ledger.get('ancillaryWork',[]):
 if work['unit'] not in {u['id'] for u in ledger['units']}:errors.append(work['id']+' unknown linked unit')
 if work['status']=='verified' and not work['evidence']:errors.append(work['id']+' lacks evidence')
print(json.dumps({'findings':len(actual),'units':len(ledger['units']),'statuses':dict(Counter(f['status'] for f in ledger['findings'])),'currentUnit':ledger['currentUnit'],'errors':errors},ensure_ascii=False,indent=2))
sys.exit(1 if errors else 0)
