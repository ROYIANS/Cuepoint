"""Read-only independent final acceptance checks; writes only its own proof report."""
from pathlib import Path
from collections import Counter
import json, hashlib, subprocess, re
root=Path.cwd(); task=root/'.trellis/tasks/10-08-src-remediation-d'; out=task/'reviews/integration'
base='f062d694e61da6bcb574f7fb548803b9e54197eb'
def load(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest() if p.is_file() else None
def git(*a):return subprocess.check_output(['git',*a])
def require(condition,message):
 if not condition:raise AssertionError(message)
head=git('rev-parse','HEAD').decode().strip(); require(head=='abb7a91d255666fc8f772cddecd66676b9f2848c','HEAD drift')
require(not git('diff','--cached','--name-only'),'Index is not empty')
dirty=set(x.decode() for args in [('diff',base,'--name-only','-z'),('ls-files','--others','--exclude-standard','-z')] for x in git(*args).split(b'\0') if x)
prefixes=tuple(str((task/f).relative_to(root))+'/' for f in ['reviews','research'])
product=sorted(n for n in dirty if n.startswith(('src/','tests/','scripts/')) or (n.startswith(prefixes) and n.endswith('.mjs')))
latest={}; history={}; unit_reviews={}
for i in range(1,9):
 unit=f'D{i:02}'; d=load(task/'reviews'/f'{unit}-check-snapshot.json'); require(d['status']=='PASS',unit)
 unit_reviews[unit]=d
 for n,h in d['after'].items():
  latest[n]={'unit':unit,'sha256':h}; history.setdefault(n,[]).append({'unit':unit,'sha256':h})
focus=load(task/'reviews/D-final-fixes-check-snapshot.json'); verbose=load(task/'reviews/D-final-fixes-verbose-merged-snapshot.json')
components=[load(root/n) for n in focus['componentSnapshots']]
merged={k:{} for k in ['before','after','unitAttribution','evidenceHashes']}; checks=[]
for d in components:
 require(d['status']=='PASS','Focused status')
 for k in merged:
  for n,v in d[k].items():
   require(n not in merged[k] or merged[k][n]==v,'Conflicting merge: '+n);merged[k][n]=v
 checks+=d['focusedChecks']
for n in focus['componentSnapshots']:merged['evidenceHashes'][n]=sha(root/n)
for k in merged:require(focus[k]==verbose[k]==merged[k],'Canonical map drift: '+k)
require(focus['focusedChecks']==verbose['focusedChecks']==checks,'Focused checks drift')
require(len(focus['after'])==76 and set(focus['after'])==set(focus['before'])==set(focus['unitAttribution']),'Focused scope')
for n,h in focus['after'].items():
 require(latest.get(n,{}).get('sha256')==focus['before'][n],'Focused before '+n)
 require(sha(root/n)==h,'Focused after '+n); latest[n]={'unit':focus['unitAttribution'][n],'sha256':h}
for n,h in focus['evidenceHashes'].items():require(sha(root/n)==h,'Focused evidence drift '+n)
require(all(c['exitCode']==0 for c in checks),'Focused failure')
supplemental={}
for name in ['.trellis/tasks/10-08-src-remediation-d/research/static-runtime-eslint.config.mjs','.trellis/tasks/10-08-src-remediation-d/reviews/D01-check-native.mjs']:
 require(unit_reviews['D01']['evidenceHashes'][name]==sha(root/name),'Supplemental historical evidence mismatch')
 supplemental[name]={'unit':'D01','sha256':sha(root/name)}
latest.update(supplemental)
coverage=[]
for n in product:
 h=sha(root/n); require(n in latest and latest[n]['sha256']==h,'Unaccepted product '+n)
 coverage.append({'path':n,'status':'reviewed','sha256':h,'latestUnit':latest[n]['unit'],'unitHistory':history.get(n,[]),'focusedCorrection':n in focus['after'],'review':str((task/'reviews'/f"{latest[n]['unit']}-check.md").relative_to(root)),'note':'Inherited unit manual/behavior acceptance, independently matched final bytes; cumulative interfaces and provenance reviewed in final report. Snapshot/comparator copies are hash/closure coverage, not a new manual source audit.','findings':[]})
require(len(product)==335,'Unexpected dirty scope')
pre=load(out/'pre-gate-source-hashes.json'); post=load(out/'post-gate-source-hashes.json'); require(pre==post and len(pre)==759,'Gate freeze')
for n,h in post.items():require(sha(root/n)==h,'Current gate input drift '+n)
expected_inputs={str(f.relative_to(root)) for folder in ['src','tests','scripts'] for f in (root/folder).rglob('*') if f.is_file()}
expected_inputs|={str(f.relative_to(root)) for folder in ['reviews','research'] for f in (task/folder).rglob('*.mjs')}
expected_inputs|={str(f.relative_to(root)) for f in (task/'tools').rglob('*') if f.is_file() and f.suffix in ['.py','.cjs','.mjs']}
expected_inputs|={str((task/'reviews/native-gate-plan.json').relative_to(root))}
expected_inputs|={'package.json','pnpm-lock.yaml','tsconfig.json','tsconfig.app.json','tsconfig.node.json','vite.config.ts','vitest.config.ts'}
require(set(post)==expected_inputs,'Incomplete producer input inventory')
plan=load(task/'reviews/native-gate-plan.json'); commands=load(out/'commands.json'); require(len(plan)==9 and len(commands)==17,'Gate counts')
require([c['name'] for c in commands]==['typecheck','tests','b01-browser','b07-browser','c01-browser','c02-browser']+[r['name'] for r in plan]+['models','build'],'Command membership/order')
for c in commands:
 require(c['exit']==0,'Failed command '+c['name']);require((out/(c['name']+'-stdout.txt')).is_file() and (out/(c['name']+'-stderr.txt')).is_file(),'Missing logs')
 require(c['command'][0].startswith('/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/'),'Wrong runtime')
for r,c in zip(plan,commands[6:15]):require(c['command'][1]==r['path'] and c.get('environment',{})==r.get('environment',{}),'Native command mismatch')
text=re.sub(r'\x1b\[[0-9;]*m','',(out/'tests-stdout.txt').read_text());require(re.search(r'Test Files\s+159 passed',text) and re.search(r'Tests\s+2552 passed',text),'Full test count')
for stage in ['pre','final']:
 d=load(out/(stage+'-whitespace.json'));require(d['status']=='PASS' and d['trackedExitCode']==0 and not d['trackedDiagnostics'].strip() and len(d['untrackedFiles'])==136,'Whitespace '+stage)
 for r in d['untrackedFiles']:require(r['exitCode'] in [0,1] and r['pass'] and not r['diagnostics'] and sha(root/r['path'])==r['sha256'],'Whitespace row')
stat=load(task/'reviews/D-final-static-summary.json'); raw=load(task/'reviews/D-final-static-results.json')
require(stat==load(out/'eslint-summary.json'),'Static summary copy'); require(stat['files']==123,'Static scope')
require({n for n in product if n.startswith('src/') and n.endswith(('.ts','.tsx')) and n!='src/routeTree.gen.ts'}==set(stat['hashes']),'Static actual scope')
for n,r in stat['hashes'].items():
 try:b=git('show',base+':'+n); bh=hashlib.sha256(b).hexdigest()
 except subprocess.CalledProcessError:bh=None
 require(r['before']==bh and r['after']==sha(root/n),'Static hash '+n)
for side,prefix in [('baseline','baseline'),('current','current')]:
 for metric in ['Errors','Warnings']:
  require(sum(r['errorCount' if metric=='Errors' else 'warningCount'] for r in raw[side])==stat[prefix+metric],'Static diagnostic totals')
def sig(m):return json.dumps([m['ruleId'],m['severity'],re.sub(r'\bline \d+\b','line N',m['message'])])
prior=Counter(sig(m) for r in raw['baseline'] for m in r['messages']); added=[]
for r in raw['current']:
 for m in r['messages']:
  if prior[sig(m)]:prior[sig(m)]-=1
  else:added.append({'file':r['filePath'],**m})
require([m for m in added if m['ruleId'] not in ['complexity','sonarjs/cognitive-complexity']]==stat['addedNoncomplexity']==[],'New static rule')
require([m for m in added if m['ruleId'] in ['complexity','sonarjs/cognitive-complexity']]==stat['addedComplexity'],'Complexity classification')
ast=load(task/'research/D-final-current-ast-results.json'); astsummary=load(task/'research/D-final-current-ast-summary.json'); require(ast==load(out/'ast-results.json') and astsummary==load(out/'ast-summary.json'),'AST copies')
source_ts={str(f.relative_to(root)) for f in (root/'src').rglob('*') if f.is_file() and f.suffix in ['.ts','.tsx']}
require(source_ts=={m['file'] for m in ast['metrics']} and len(source_ts)==419 and len(ast['edges'])==2492 and ast['parseErrors']==[],'AST actual scope')
graph={f:set() for f in source_ts}
for e in ast['edges']:
 if e['internal'] and not e['typeOnly'] and e['kind']!='dynamic-import' and e['to'] in graph:graph[e['from']].add(e['to'])
visited=set();active=set()
def visit(n):
 require(n not in active,'AST value cycle '+n)
 if n in visited:return
 active.add(n)
 for x in graph[n]:visit(x)
 active.remove(n);visited.add(n)
for n in graph:visit(n)
require(ast['staticValueCycles']==[],'Reported cycle')
groups=load(task/'commit-groups.json'); boundary=load(task/'reviews/commit-boundaries.json'); require(boundary['status']=='PASS' and boundary['baseRevision']==head and boundary['groupsSha256']==sha(task/'commit-groups.json') and len(groups)==3,'Compiler grouping proof')
assigned=set(); seen=set(); overlay_reports=[]
for i,(g,r) in enumerate(zip(groups,boundary['groups'])):
 require(not (seen&set(g['files'])),'Grouping overlap');seen|=set(g['files']);assigned|=set(g['files'])
 require(not r['diagnostics'] and not r['unresolvedTestImports'] and not r['programInputMismatches'],'Compiler failures')
 for n,h in r['sourceHashes'].items():
  if n in dirty and n not in assigned:
   try: actual=hashlib.sha256(git('show',head+':'+n)).hexdigest()
   except subprocess.CalledProcessError:actual=None
  else:actual=sha(root/n)
  require(h==actual,'Compiler reads wrong intermediate bytes '+n)
 overlay_reports.append({'group':i+1,'files':len(g['files']),'roots':r['sourceCount'],'allRecordedInputsIndependentlyMatched':True})
require({n for n in product if n.startswith(('src/','tests/','scripts/'))}<=seen,'Application groups omit product')
route=load(out/'generated-route.json');require(route['formatRestored'] and route['beforeSha256']==sha(root/'src/routeTree.gen.ts') and json.loads(route['tokenComparison'])=={'same':True,'beforeTokens':3995,'afterTokens':3995},'Route restoration')
result={'status':'PASS','head':head,'sourceBaseline':base,'productCount':len(product),'coverageInventoryCorrection':{'priorToolCount':333,'actualDirtyScope':335,'priorOmissions':supplemental},'unitUpdates':{**{n:latest[n] for n in focus['after']},**supplemental},'after':{r['path']:r['sha256'] for r in coverage},'coverage':coverage,'overlaps':{n:v for n,v in history.items() if n in product and len(v)>1},'focusedMerge':{'componentCount':3,'pathCount':76,'mapsAndChecksIdentical':True,'canonicalMetadataOnly':True},'gate':{'inputCount':len(post),'prePostCurrentEqual':True,'completeIndependentInventory':True,'commands':17,'native':9,'files':159,'tests':2552,'untrackedWhitespace':136},'static':{'files':stat['files'],'baseline':[stat['baselineErrors'],stat['baselineWarnings']],'current':[stat['currentErrors'],stat['currentWarnings']],'addedNoncomplexity':0,'addedComplexity':len(stat['addedComplexity']),'versions':stat['versions']},'ast':astsummary,'compilerGroups':overlay_reports,'route':route,'limits':['No heavy/native gates rerun; existing final current logs reused after exact input verification.','Unit source manual checks inherited on exact final bytes; immutable snapshots not newly manually audited.','Producer review and this independent recomputation supplement rather than prove all execution history.']}
(task/'reviews/D-final-independent-proof.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
print(json.dumps({k:v for k,v in result.items() if k not in ['after','coverage','overlaps','unitUpdates']},indent=2))
