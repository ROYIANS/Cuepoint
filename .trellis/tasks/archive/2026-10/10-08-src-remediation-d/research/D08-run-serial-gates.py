from pathlib import Path
import os, subprocess, hashlib, json, time, datetime
root=Path.cwd(); base=root/'.trellis/tasks/10-08-src-remediation-d'; records=base/'research/D08-gate-records.json'
pnpm='/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/pnpm'; node='/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node'
playwright='/Users/xiaomengdao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
chromium='/Users/xiaomengdao/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell'
focused=['tests/d08TextDraftRepository.test.ts','tests/d08TextDraftComponents.test.ts','tests/debouncedDraft.test.ts','tests/draftConcurrency.test.ts','tests/manualDraftBaseline.test.ts','tests/manualDraftWiring.test.ts','tests/b01QueryIdentity.test.ts','tests/b03IntentBoundaries.test.ts','tests/b06EditorSessions.test.ts','tests/d03ShotCommands.test.ts']
commands=[('typecheck',[pnpm,'lint'],{},180),('focused',[pnpm,'test','--maxWorkers=4',*focused],{},180),('full',[pnpm,'test','--maxWorkers=4'],{},300)]
for unit in ['B01','B07','C01','C02']:
 commands.append((unit.lower()+'-native',[node,f'scripts/{unit.lower()}-browser-regression.mjs'],{unit+'_PLAYWRIGHT_PATH':playwright,unit+'_CHROMIUM_PATH':chromium},180))
commands += [('models',[pnpm,'model-bank:verify'],{},180),('build',[pnpm,'build'],{},300)]
result=[]
for name,args,extra,limit in commands:
 env={key:value for key,value in os.environ.items() if 'BASELINE' not in key and key!='REPORT_PATH' and not key.endswith('_REPORT_PATH')};env.update(extra)
 log=base/f'research/D08-{name}-final.log'
 started=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat();begin=time.monotonic()
 with log.open('w') as out:
  try: code=subprocess.run(args,cwd=root,env=env,stdout=out,stderr=subprocess.STDOUT,timeout=limit).returncode
  except subprocess.TimeoutExpired: code=124;out.write(f'\nRunner subprocess cap {limit}s reached; no product assertion/timeout changed.\n')
 row={'name':name,'command':args,'cwd':str(root),'environment':extra,'baselineEnvironmentsRemoved':True,'startedAt':started,'seconds':round(time.monotonic()-begin,3),'exitCode':code,'log':str(log),'logSHA256':hashlib.sha256(log.read_bytes()).hexdigest()}
 result.append(row);records.write_text(json.dumps(result,indent=2)+'\n');print(name,'exit',code,round(time.monotonic()-begin,2),flush=True)
 if code!=0: raise SystemExit(code)
