from pathlib import Path
import os,subprocess,hashlib,json,time,datetime
root=Path.cwd();base=root/'.trellis/tasks/10-08-src-remediation-d';records=base/'research/D08-affected-gate-records.json'
pnpm='/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm';node='/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node'
focused=['tests/d08TextDraftRepository.test.ts','tests/d08TextDraftComponents.test.ts','tests/debouncedDraft.test.ts','tests/draftConcurrency.test.ts','tests/manualDraftBaseline.test.ts','tests/manualDraftWiring.test.ts','tests/b01QueryIdentity.test.ts','tests/b03IntentBoundaries.test.ts','tests/b06EditorSessions.test.ts','tests/d03ShotCommands.test.ts']
commands=[('typecheck',[pnpm,'lint'],{}),('focused',[pnpm,'test','--maxWorkers=4',*focused],{}),('native',[node,'scripts/d08-browser-regression.mjs'],{'D08_PLAYWRIGHT_PATH':'/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs','D08_CHROMIUM_PATH':'/Users/xiaomengdao/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell','D08_REPORT_PATH':str(base/'research/D08-native-current.json')})]
result=[]
for name,args,extra in commands:
 env={key:value for key,value in os.environ.items() if 'BASELINE' not in key and key!='REPORT_PATH' and not key.endswith('_REPORT_PATH')};env.update(extra)
 log=base/f'research/D08-{name}-post-static-fix.log';start=time.monotonic();at=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat()
 with log.open('w') as out:
  try:code=subprocess.run(args,cwd=root,env=env,stdout=out,stderr=subprocess.STDOUT,timeout=180).returncode
  except subprocess.TimeoutExpired:code=124;out.write('\nRunner cap 180s reached.\n')
 result.append({'name':name,'command':args,'cwd':str(root),'environment':extra,'startedAt':at,'seconds':round(time.monotonic()-start,3),'exitCode':code,'log':str(log),'logSHA256':hashlib.sha256(log.read_bytes()).hexdigest(),'sourceStage':'after genuine pendingIds memo correction'})
 records.write_text(json.dumps(result,indent=2)+'\n');print(name,'exit',code,flush=True)
 if code:raise SystemExit(code)
