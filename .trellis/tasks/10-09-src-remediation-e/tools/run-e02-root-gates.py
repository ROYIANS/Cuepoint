#!/usr/bin/env python3
"""Frozen-input local gates for one explicitly labelled E checkpoint."""
from pathlib import Path
import json,hashlib,subprocess,os,sys,time
label=sys.argv[1]
if not all(c.isalnum() or c in '-_' for c in label):raise SystemExit('Unsafe output label')
task=Path(__file__).resolve().parents[1]
root=task.parents[2]
out=task/'reviews'/label
out.mkdir(parents=True,exist_ok=True)
if (out/'commands.json').exists():raise SystemExit('Use a new label; do not overwrite gate evidence')
node='/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node'
pnpm='/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm'
env=dict(os.environ);env['PATH']=str(Path(node).parent)+os.pathsep+env.get('PATH','')
for prefix in ['E01','B01','B07','C01','C02','D08']:
 env[prefix+'_PLAYWRIGHT_PATH']='/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
 env[prefix+'_CHROMIUM_PATH']='/Users/xiaomengdao/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell'
for key,value in env.items():
 if value and ('_BASELINE_' in key or key.endswith('_BASELINE_ROOT')):raise SystemExit('Actual-source proof forbids baseline override '+key)
def hashes():
 paths=[p for f in ['src','tests','scripts'] for p in (root/f).rglob('*') if p.is_file()]
 paths += [root/f for f in ['package.json','pnpm-lock.yaml','tsconfig.json','tsconfig.app.json','tsconfig.node.json','vite.config.ts','vitest.config.ts']]
 return {str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(paths) if p.is_file()}
pre=hashes();(out/'pre.json').write_text(json.dumps(pre,indent=2)+'\n')
commands=[('typecheck',[pnpm,'lint']),('tests',[pnpm,'test','--maxWorkers=4'])]
rows=[]
for name,argv in commands:
 started=time.monotonic()
 with (out/(name+'.log')).open('w') as log:r=subprocess.run(argv,cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT)
 rows.append({'name':name,'argv':argv,'exit':r.returncode,'seconds':round(time.monotonic()-started,2)})
 (out/'commands.json').write_text(json.dumps(rows,indent=2)+'\n')
 print(name,r.returncode,flush=True)
 if r.returncode:break
post=hashes();(out/'post.json').write_text(json.dumps(post,indent=2)+'\n')
changed=[p for p in sorted(set(pre)|set(post)) if pre.get(p)!=post.get(p)]
result={'purpose':'E02 current frozen-source application type/full-test gates; native evidence separately frozen and independently reviewed, not entire E completion or formal QG01 proof','commands':rows,'expectedCommandCount':len(commands),'sourceInputs':len(pre),'inputsUnchanged':pre==post,'changedInputs':changed,'status':'PASS' if len(rows)==len(commands) and all(not r['exit'] for r in rows) and pre==post else 'FAIL'}
(out/'summary.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
sys.exit(0 if result['status']=='PASS' else 1)
