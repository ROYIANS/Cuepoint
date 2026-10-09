from pathlib import Path
from hashlib import sha256
import argparse,json,os,subprocess,time,sys
parser=argparse.ArgumentParser();parser.add_argument('--label',required=True);parser.add_argument('--start-at',default='e01-drafts-browser-regression');args=parser.parse_args()
if not all(c.isalnum() or c in '-_' for c in args.label):raise SystemExit('Unsafe label')
task=Path(__file__).resolve().parents[1];root=task.parents[2];out=task/'reviews'/args.label;out.mkdir()
node='/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node'
playwright='/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
chromium='/Users/xiaomengdao/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell'
env=dict(os.environ);env['PATH']=str(Path(node).parent)+os.pathsep+env.get('PATH','')
for key in list(env):
 if key.endswith('_BASELINE_ROOT') or '_BASELINE_' in key or key.endswith('_BASELINE'):env.pop(key)
for prefix in ['B01','B07','C01','C02','D08','E01','E02','E03','E04','E04_MEDIA','E04_MEMORY','E05']:
 env[prefix+'_PLAYWRIGHT_PATH']=playwright;env[prefix+'_CHROMIUM_PATH']=chromium
env['E06_PLAYWRIGHT_PATH']=playwright;env['E06_BROWSER_PATH']=chromium
env['E03_PAIRED']='1';env['E03_SOFTWARE_RASTER']='1'
env.update({'E01_OBSERVATIONS':str(out/'e01-drafts-observations.json'),'D08_REPORT_PATH':str(out/'d08-report.json'),'E02_OUTPUT':str(out/'e02'),'E03_OUTPUT':str(out/'e03'),'E04_LIBRARY_OUTPUT_DIR':str(out/'e04-library'),'E04_MEDIA_OUTPUT':str(out/'e04-media'),'E04_MEMORY_OUTPUT':str(out/'e04-memory'),'E05_OUTPUT':str(out/'e05')})
native=[f'scripts/{n}-browser-regression.mjs' for n in ['e01-drafts','e01-writes','b01','b07','c01','c02','d08','e02','e03','e04-library','e04-media','e04-memory','e05']]+['scripts/e06-build.mjs','scripts/e06-icon-data.mjs','scripts/e06-icon-data.d.mts','scripts/e06-icons-browser.mjs','scripts/e06-root-browser.mjs','scripts/e06-root-parity.mjs','scripts/native-fixture-ready.mjs']
def hashes():
 paths=[p for name in ['src','tests','public','vendor'] for p in(root/name).rglob('*') if p.is_file()]
 paths += [root/f for f in native+['package.json','pnpm-lock.yaml','tsconfig.json','tsconfig.app.json','tsconfig.node.json','vite.config.ts','vitest.config.ts','index.html']]
 return {str(p.relative_to(root)):sha256(p.read_bytes()).hexdigest() for p in sorted(set(paths))}
pre=hashes();(out/'inputs-before.json').write_text(json.dumps(pre,indent=2)+'\n');rows=[]
commands=[(Path(f).stem,[node,f]) for f in native[:13]]
commands += [('e06-build',[node,'scripts/e06-build.mjs',str(out/'e06-build')]),('e06-icons',[node,'scripts/e06-icons-browser.mjs',str(out/'e06-icons')]),('e06-root',[node,'scripts/e06-root-browser.mjs',str(out/'e06-build'),str(out/'e06-root')]),('e06-parity',[node,'scripts/e06-root-parity.mjs',str(out/'e06-build'),str(out/'e06-parity')])]
start=next((i for i,(n,a)in enumerate(commands)if n==args.start_at),None)
if start is None:raise SystemExit('Unknown command start')
commands=commands[start:]
for name,argv in commands:
 started=time.monotonic()
 with(out/(name+'.log')).open('w') as log:r=subprocess.run(argv,cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT)
 rows.append({'name':name,'argv':argv,'exit':r.returncode,'seconds':round(time.monotonic()-started,3),'log':str((out/(name+'.log')).relative_to(root))});(out/'commands.json').write_text(json.dumps(rows,indent=2)+'\n');print(name,r.returncode,flush=True)
 if r.returncode:break
post=hashes();(out/'inputs-after.json').write_text(json.dumps(post,indent=2)+'\n');changed=[f for f in set(pre)|set(post) if pre.get(f)!=post.get(f)]
result={'status':'PASS' if len(rows)==len(commands) and all(not r['exit'] for r in rows) and not changed else 'FAIL','purpose':'Actual current authored source and permanent native fixture regression plus isolated real root build/icon/root/parity. Native relevant input closure frozen; gate implementation producers/debt/architecture config have separate input proof. No paid providers/GitHubLinux/device/battery/latency claim.','node':node,'injectedPlaywright':playwright,'injectedChromium':chromium,'commands':rows,'expectedCommands':len(commands),'startAt':args.start_at,'scope':'Explicit remaining native commands; earlierpassingcommands require matchingfinalrelevantinputs and separateacceptedsummary','inputs':len(pre),'changedInputs':changed}
(out/'summary.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2));sys.exit(0 if result['status']=='PASS' else 1)
