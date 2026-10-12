import hashlib,json,os,subprocess,time
from pathlib import Path
ROOT=Path.cwd()
OUT=ROOT/'.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final-after-agent'
NODE='/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node'
PNPM='/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm'
ENV={**os.environ,'PATH':str(Path(NODE).parent)+os.pathsep+os.environ['PATH']}
BASE=ROOT/'.trellis/tasks/10-12-desktop-release-pipeline/research/logs/release-hosted-final/final-source-before.json'
keys=sorted(json.loads(BASE.read_text()))
def snapshot(): return {key:hashlib.sha256((ROOT/key).read_bytes()).hexdigest() for key in keys}
before=snapshot()
(OUT/'source-before.json').write_text(json.dumps(before,indent=2)+'\n')
steps=[
('root-types',[PNPM,'lint']),
('root-quality',[PNPM,'quality']),
('desktop-types',[PNPM,'--dir','desktop/tauri','types']),
('desktop-lint',[PNPM,'--dir','desktop/tauri','lint']),
('desktop-quality',[PNPM,'--dir','desktop/tauri','quality']),
('desktop-release-tests',[PNPM,'--dir','desktop/tauri','test:release']),
('root-tests',[PNPM,'test']),
('sqlite-all',[NODE,'scripts/native-storage-regression.mjs','--evidence-dir',str(OUT/'sqlite-all'),'--suite','all']),
('root-build',[PNPM,'build']),
('desktop-normal-build',['/usr/bin/time','-l',NODE,'desktop/tauri/scripts/build-frontend.mjs']),
('diff-check',['git','diff','--check'])
]
receipt={'node':NODE,'pnpm':PNPM,'sourceBefore':before,'results':[], 'retainedUnchangedEarlierGates':['release-hosted-final/quality-selftest.log','release-hosted-final/model-verify.log','release-hosted-final/rust-checks.json','release-frontend-heap-implementation/acceptance-build.log']}
for name,argv in steps:
 print('START '+name,flush=True); start=time.monotonic()
 with (OUT/(name+'.log')).open('xb') as log: result=subprocess.run(argv,cwd=ROOT,env=ENV,stdout=log,stderr=subprocess.STDOUT)
 row={'name':name,'command':argv,'exitCode':result.returncode,'elapsedSeconds':time.monotonic()-start}
 receipt['results'].append(row)
 after=snapshot(); receipt['sourceAfter']=after;receipt['changedInputs']=[key for key in keys if before[key]!=after[key]]
 (OUT/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(row),flush=True)
 if result.returncode or receipt['changedInputs']:
  print('STOP: failed gate or changing source; original log retained.',flush=True)
  raise SystemExit(1)
print('PASS: all sequential final gates; '+str(len(keys))+' inputs unchanged.',flush=True)
