#!/usr/bin/env python3
"""Prepared isolated clean-install verifier; refuses execution before E07 activation."""
from pathlib import Path
from hashlib import sha256
from datetime import datetime, timezone
import argparse, json, os, shutil, subprocess, sys, time
parser=argparse.ArgumentParser();parser.add_argument('--label',required=True);parser.add_argument('--extra-root',action='append',default=[]);args=parser.parse_args()
if not all(c.isalnum() or c in '-_' for c in args.label):raise SystemExit('Unsafe label')
root=Path(__file__).resolve().parents[4];task=Path(__file__).resolve().parents[1]
ledger=json.loads((root/'.trellis/tasks/09-30-src-quality-remediation/remediation-ledger.json').read_text())
if not any(u['id']=='E07' and u['status'] in ['in_progress','verified'] for u in ledger['units']):raise SystemExit('E07 is not active; preparation only')
out=task/'reviews'/args.label
if out.exists():raise SystemExit('Never overwrite prior evidence')
out.mkdir();mirror=out/'clean-project';mirror.mkdir()
node=Path('/Users/xiaomengdao/.nvm/versions/node/v22.21.1/bin/node');pnpm=Path('/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm')
env=dict(os.environ);env['PATH']=str(node.parent)+os.pathsep+env.get('PATH','')
env['E07_PLAYWRIGHT_PATH']='/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
env['E07_CHROMIUM_PATH']='/Users/xiaomengdao/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell'
env['E07_DRAFT_REBASE_TEST_OUTPUT_DIR']=str(out/'native-draft-regression')
def digest(path):return sha256(path.read_bytes()).hexdigest()
roots=['src','tests','scripts','public','vendor','quality','.quality','.github']+args.extra_root
files=set()
for name in roots:
 p=root/name
 if p.exists():files.update(f for f in p.rglob('*') if f.is_file() and 'node_modules' not in f.relative_to(root).parts)
contractsPath=root/'quality/unused-contracts.json'
if contractsPath.exists():
 for contract in json.loads(contractsPath.read_text())['contracts']:
  for evidence in contract['evidence']:
   relative=Path(evidence['file'])
   if relative.is_absolute() or '..' in relative.parts:raise SystemExit('Unsafe contract evidence path')
   files.add(root/relative)
for p in root.iterdir():
 if p.is_file() and (p.suffix in ['.json','.yaml','.yml','.ts','.mts','.cts','.js','.mjs','.cjs','.html'] or p.name=='.npmrc'):files.add(p)
inputs={str(p.relative_to(root)):digest(p) for p in sorted(files)}
for p in sorted(files):
 dest=mirror/p.relative_to(root);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
assert not (mirror/'node_modules').exists()
(out/'inputs.json').write_text(json.dumps(inputs,indent=2)+'\n')
route=mirror/'src/routeTree.gen.ts';openingRoute=route.read_bytes();(out/'routeTree-opening.ts').write_bytes(openingRoute)
commands=[('runtime',[str(node),'--version']),('install',[str(pnpm),'install','--frozen-lockfile']),('effective-runtime',[str(pnpm),'exec','node','--version']),('type',[str(pnpm),'lint']),('quality',[str(pnpm),'quality']),('quality-self-test',[str(pnpm),'quality:self-test','--output',str(out/'self-test-evidence')]),('tests',[str(pnpm),'test','--maxWorkers=4']),('models',[str(pnpm),'model-bank:verify']),('build',[str(pnpm),'build'])]
rows=[]
for name,argv in commands:
 started=time.monotonic()
 with (out/(name+'.log')).open('w') as log:r=subprocess.run(argv,cwd=mirror,env=env,stdout=log,stderr=subprocess.STDOUT)
 rows.append({'name':name,'argv':argv,'cwd':str(mirror),'exit':r.returncode,'seconds':round(time.monotonic()-started,3),'log':str((out/(name+'.log')).relative_to(root))})
 (out/'commands.json').write_text(json.dumps(rows,indent=2)+'\n');print(name,r.returncode,flush=True)
 if r.returncode:break
routeProof={'openingSHA256':sha256(openingRoute).hexdigest(),'generatedSHA256':digest(route),'restored':False,'tokenCheckExit':None}
if route.read_bytes()!=openingRoute:
 (out/'routeTree-generated.ts').write_bytes(route.read_bytes())
 with (out/'route-token-equivalence.log').open('w') as log:check=subprocess.run([str(node),str(task/'tools/verify-route-tokens.cjs'),str(out/'routeTree-opening.ts'),str(out/'routeTree-generated.ts')],cwd=mirror,env=env,stdout=log,stderr=subprocess.STDOUT)
 routeProof['tokenCheckExit']=check.returncode
 if check.returncode==0:route.write_bytes(openingRoute);routeProof['restored']=True
(out/'generated-route-attribution.json').write_text(json.dumps(routeProof,indent=2)+'\n')
mirrorPost={f:(digest(mirror/f) if (mirror/f).is_file() else None) for f in inputs}
rootPost={f:(digest(root/f) if (root/f).is_file() else None) for f in inputs}
(out/'mirror-post-inputs.json').write_text(json.dumps(mirrorPost,indent=2)+'\n')
(out/'root-post-inputs.json').write_text(json.dumps(rootPost,indent=2)+'\n')
changedMirror=[f for f in inputs if inputs[f]!=mirrorPost[f]];changedRoot=[f for f in inputs if inputs[f]!=rootPost[f]]
version=(out/'effective-runtime.log').read_text().strip() if (out/'effective-runtime.log').exists() else None
lockMatches=mirrorPost.get('pnpm-lock.yaml')==inputs.get('pnpm-lock.yaml')
result={'purpose':'Actual isolated fresh Node22 locked installation and final commands on copied source/config/importedmetadata closure; localmacOS, not GitHubLinuxCI','capturedAt':datetime.now(timezone.utc).isoformat(),'node':str(node),'pnpm':str(pnpm),'PATHPrefix':str(node.parent),'actualEffectiveRuntime':version,'sourceInputCount':len(inputs),'cleanStartNoNodeModules':True,'generatedRouteAttribution':routeProof,'commands':rows,'lockUnchanged':lockMatches,'changedMirrorInputs':changedMirror,'changedRootInputs':changedRoot,'status':'PASS' if len(rows)==len(commands) and all(not r['exit'] for r in rows) and version=='v22.21.1' and lockMatches and not changedMirror and not changedRoot else 'FAIL'}
(out/'summary.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2));sys.exit(0 if result['status']=='PASS' else 1)
