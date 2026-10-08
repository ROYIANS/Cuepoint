from pathlib import Path
import hashlib,json,datetime,sys
root=Path('.trellis/tasks/10-08-src-remediation-d/tools/d06')
files=[p for folder in ['src','tests','scripts'] for p in Path(folder).rglob('*') if p.is_file()]
files += [Path(p) for p in ['package.json','pnpm-lock.yaml','tsconfig.app.json','tsconfig.node.json','tsconfig.json','vitest.config.ts','vite.config.ts','.trellis/tasks/10-08-src-remediation-d/reviews/D06-native.mjs','.trellis/tasks/10-08-src-remediation-d/reviews/D06-compiler-negatives.mjs','.trellis/tasks/10-08-src-remediation-d/tools/d06/run-gate.py','.trellis/tasks/10-08-src-remediation-d/tools/d06/lint-leaf.mjs','.trellis/tasks/10-08-src-remediation-d/tools/d06/final-gates.py']]
map={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in files if p.exists()}
source={p:h for p,h in map.items() if p.startswith('src/')}
obj={'at':datetime.datetime.now().astimezone().isoformat(),'phase':sys.argv[1],'hashes':map,'source':source,'sourceSetSha256':hashlib.sha256(json.dumps(source,sort_keys=True).encode()).hexdigest(),'testedSetSha256':hashlib.sha256(json.dumps(map,sort_keys=True).encode()).hexdigest(),'policy':'Product/test/native/compiler/config input hashes are independent of unfinished reports and final evidence maps. Before-source comparator bytes are separately immutable entry copies.'}
(root/(sys.argv[1]+'.json')).write_text(json.dumps(obj,indent=2)+'\n');print('Freeze',sys.argv[1],len(source),'sources',len(map),'inputs')
