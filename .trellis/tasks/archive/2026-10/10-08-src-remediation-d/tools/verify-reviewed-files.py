"""Validate every current D product change against latest accepted unit hashes, including deletion."""
from pathlib import Path
import hashlib,json,subprocess,sys
from accepted_final_fixes import read_final_fixes
root=Path.cwd();task=Path(__file__).resolve().parents[1];reviewed={};units=[]
for unit in ('D01','D02','D03','D04','D05','D06','D07','D08'):
 p=task/'reviews'/f'{unit}-check-snapshot.json'
 if not p.exists():continue
 d=json.loads(p.read_text())
 if d.get('status')!='PASS':raise SystemExit('Unaccepted unit snapshot: '+unit)
 units.append(unit)
 for name,h in d['after'].items():reviewed[name]={'unit':unit,'sha256':h}
reviewed.update(read_final_fixes(task,root,{name:value['sha256'] for name,value in reviewed.items()},units))
final_path=task/'reviews/D-final-check-snapshot.json'
if final_path.exists():
 final=json.loads(final_path.read_text())
 if final.get('status')!='PASS':raise SystemExit('Unaccepted whole-D snapshot')
 for name,update in final.get('unitUpdates',{}).items():
  if update['unit'] not in units or final['after'].get(name)!=update['sha256']:
   raise SystemExit('Invalid final attribution: '+name)
  reviewed[name]={'unit':update['unit'],'sha256':update['sha256']}
 for name,h in final['after'].items():
  if reviewed.get(name,{}).get('sha256')!=h:raise SystemExit('Final hash missing unit attribution: '+name)
changed=set()
for args in (['git','diff','f062d694e61da6bcb574f7fb548803b9e54197eb','--name-only','-z'],['git','ls-files','--others','--exclude-standard','-z']):changed.update(n for n in subprocess.check_output(args,text=True).split('\0') if n)
files=sorted(n for n in changed if n.startswith(('src/','tests/','scripts/')))
files=sorted(set(files)|{n for n in reviewed if n.startswith(tuple(str((task/folder).relative_to(root))+'/' for folder in ('reviews','research'))) and n.endswith('.mjs')})
rows=[]
for name in files:
 p=root/name; h=hashlib.sha256(p.read_bytes()).hexdigest() if p.is_file() else None
 evidence=reviewed.get(name);rows.append({'path':name,'sha256':h,'review':evidence,'matches':bool(evidence and h==evidence['sha256'])})
result={'completedReviewUnits':units,'files':rows,'missingOrChanged':[r['path'] for r in rows if not r['matches']]}
print(json.dumps({'units':units,'changedFiles':len(rows),'missingOrChanged':result['missingOrChanged']},ensure_ascii=False,indent=2))
# Emit only when explicitly requested, so post-final checks do not mutate hashed evidence.
if '--write' in sys.argv:
 out=task/'reviews/integration';out.mkdir(exist_ok=True)
 (out/'review-file-coverage.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
raise SystemExit(1 if result['missingOrChanged'] else 0)
