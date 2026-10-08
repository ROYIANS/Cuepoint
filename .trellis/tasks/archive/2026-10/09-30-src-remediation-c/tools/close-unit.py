"""Close the current sequential C unit only against exact independent PASS hashes."""
from pathlib import Path
import json, hashlib, sys
root=Path.cwd(); task=Path(__file__).resolve().parents[1]
unit=sys.argv[1]; details=json.loads(Path(sys.argv[2]).read_text())
parent=root/'.trellis/tasks/09-30-src-quality-remediation'
ledger=json.loads((parent/'remediation-ledger.json').read_text())
if ledger['currentUnit']!=unit:raise SystemExit('Unit is not current')
snapshot=task/'reviews'/f'{unit}-check-snapshot.json';report=task/'reviews'/f'{unit}-check.md'
d=json.loads(snapshot.read_text())
if d.get('status')!='PASS' or not report.exists():raise SystemExit('Independent PASS required')
files=d.get('after',{})
if not files:raise SystemExit('Final hash map required')
for name,digest in files.items():
 if hashlib.sha256((root/name).read_bytes()).hexdigest()!=digest:raise SystemExit('Changed after review: '+name)
u=next(u for u in ledger['units'] if u['id']==unit)
u.update(status='verified',changedFiles=sorted(files),checks=details['checks'],review=str(report.relative_to(root)))
evidence=[str(report.relative_to(root)),str(snapshot.relative_to(root))]+details.get('evidence',[])
for f in ledger['findings']:
 if f['id'] in u['findings']:f.update(status='fixed',resolution=details['resolution'],evidence=evidence)
nextunit=next((u for u in ledger['units'] if u['status']!='verified'),None)
ledger['currentUnit']=nextunit['id'] if nextunit else None
if nextunit and nextunit['batch']=='C':
 nextunit['status']='in_progress'
 for f in ledger['findings']:
  if f['id'] in nextunit['findings']:f['status']='in_progress'
(parent/'remediation-ledger.json').write_text(json.dumps(ledger,ensure_ascii=False,indent=2)+'\n')
p=task/'implement.md';text=p.read_text().replace(f'- [ ] {unit}',f'- [x] {unit}')
nextlabel=ledger['currentUnit'] if nextunit and nextunit['batch']=='C' else '完整批门禁与独立全范围检查'
text=text.replace('当前'+unit+'。','当前'+nextlabel+'。');p.write_text(text)
meta=task/'task.json';m=json.loads(meta.read_text());m['notes']=unit+' independent PASS; current '+nextlabel+'; no C commits or push.';meta.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
with (parent/'progress.md').open('a') as out:out.write('\n'+details['progress']+'\n')
print(json.dumps({'verified':unit,'next':ledger['currentUnit'],'hashes':len(files)},ensure_ascii=False))
