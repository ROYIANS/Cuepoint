from pathlib import Path
import json,hashlib
root=Path(__file__).resolve().parents[4];task=Path(__file__).resolve().parents[1]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
rows=[]
for name in ['coercion','typed-boundaries','hooks','gate']:
 p=task/'research'/f'E07-{name}-implementation.json';d=json.loads(p.read_text());checks=[]
 if name=='coercion':
  assert d['sliceStatus']=='COMPLETED'
  checks += [(r['path'],r['afterSha256'],'current-source') for r in d['changedFiles']]
  inventory=json.loads((task/'research/e07-coercion-implementation/artifact-hashes.json').read_text())
  checks += [(r['path'],r['sha256'],'evidence') for r in inventory['files']]
 elif name=='typed-boundaries':
  assert d['status']=='COMPLETED'
  checks += [(r['path'],r['afterSHA256'],'current-source') for r in d['source']]
  checks += [(r['path'],r['sha256'],'evidence') for r in d['evidence']]
 elif name=='hooks':
  assert d['status']=='COMPLETED'
  checks += [(f,v['sha256'],'current-source') for f,v in d['after'].items()]
  inventory=json.loads((task/'research'/d['evidenceManifest']).read_text())
  checks += [(str((task/'research'/f).relative_to(root)),v['sha256'],'evidence') for f,v in inventory.items()]
 elif name=='gate':
  assert d['status']=='IMPLEMENTATION_COMPLETE'
  checks += [(f,h,'original-producer') for f,h in d['producer'].items()]
 bad=[{'path':f,'kind':kind,'expected':h,'actual':sha(root/f) if(root/f).exists() else None} for f,h,kind in checks if not(root/f).is_file() or sha(root/f)!=h]
 rows.append({'slice':name,'report':str(p.relative_to(root)),'reportSHA256':sha(p),'checked':len(checks),'mismatches':bad})
out=task/'research/E07-completed-worker-hash-check.json'
if out.exists():raise SystemExit('Existing evidence; use new label')
out.write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps(rows,indent=2))
