from pathlib import Path
import hashlib,json,datetime,subprocess
root=Path(__file__).parent
entry=json.loads((root/'entry.json').read_text())
paths={Path(p) for p in entry['hashes']}
for directory in ['src','tests','scripts']:
 paths.update(p for p in Path(directory).rglob('*') if p.is_file())
paths.update(p for p in Path('.').iterdir() if p.is_file() and (p.suffix in ['.json','.ts','.js','.mjs','.yaml','.yml'] or p.name in ['index.html','.npmrc']))
paths.update(p for p in root.rglob('*') if p.is_file() and p.suffix in ['.ts','.mjs','.py','.json'] and ('before' in p.parts or p.name in ['run-gate.py','serial-gates.py','freeze.py','lint-leaves.mjs']))
inputs={str(p):hashlib.sha256(p.read_bytes()).hexdigest() if p.is_file() else None for p in sorted(paths)}
sources={p:h for p,h in inputs.items() if p.startswith('src/')}
changes={p:{'before':entry['hashes'].get(p),'after':h} for p,h in inputs.items() if (p.startswith('src/') or p.startswith('tests/') or p.startswith('scripts/')) and entry['hashes'].get(p)!=h}
gates=[json.loads(line) for line in (root/'gates.jsonl').read_text().splitlines()]
freeze={'status':'PRODUCTFROZEN','at':datetime.datetime.now().astimezone().isoformat(),'head':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'entryArtifact':str(root/'entry.json'),'entrySHA256':hashlib.sha256((root/'entry.json').read_bytes()).hexdigest(),'sourceInputs':sources,'testedInputs':inputs,'sourceSetSHA256':hashlib.sha256(json.dumps(sources,sort_keys=True).encode()).hexdigest(),'inputSetSHA256':hashlib.sha256(json.dumps(inputs,sort_keys=True).encode()).hexdigest(),'unitChanges':changes,'gateRecords':gates,'note':'Freeze captured immediately after final heavy gates, before report refinement. No native/browser gate: pure fetch/JSON leaves, no UI/IDB write or transaction boundary touched; existing recovery runtime tests included.'}
data=json.dumps(freeze,indent=2)+'\n';(root/'PRODUCTFROZEN.json').write_text(data);Path('.trellis/tasks/10-08-src-remediation-d/reviews/D07-product-freeze.json').write_text(data)
(root/'frozen-git-status.txt').write_bytes(subprocess.check_output(['git','status','--short','--untracked-files=all']))
print('PRODUCTFROZEN',freeze['at'],len(sources),'source paths',len(inputs),'tested inputs; changes',len(changes),freeze['sourceSetSHA256'],flush=True)
