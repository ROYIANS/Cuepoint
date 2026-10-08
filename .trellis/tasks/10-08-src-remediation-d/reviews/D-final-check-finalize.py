"""Freeze completed independent review; no source/tool/status mutation."""
from pathlib import Path
import json,hashlib,subprocess,datetime
root=Path.cwd(); task=root/'.trellis/tasks/10-08-src-remediation-d'; reviews=task/'reviews'
def load(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest() if p.is_file() else None
proof=load(reviews/'D-final-independent-proof.json'); assert proof['status']=='PASS' and len(proof['after'])==335 and len(proof['unitUpdates'])==78
post=load(reviews/'integration/post-gate-source-hashes.json');pre=load(reviews/'integration/pre-gate-source-hashes.json');assert post==pre and len(post)==759
for n,h in {**post,**proof['after']}.items():assert sha(root/n)==h,n
focus=load(reviews/'D-final-fixes-check-snapshot.json')
for n,h in focus['evidenceHashes'].items():assert sha(root/n)==h,n
names=set(post)|set(focus['evidenceHashes'])
units={}; historical=[]
for i in range(1,9):
 u=f'D{i:02}';sp=reviews/(u+'-check-snapshot.json');rp=reviews/(u+'-check.md');d=load(sp);assert d['status']=='PASS'
 units[u]={'report':str(rp.relative_to(root)),'reportSha256':sha(rp),'snapshot':str(sp.relative_to(root)),'snapshotSha256':sha(sp),'acceptedAfterPaths':len(d['after'])}
 names.update([str(sp.relative_to(root)),str(rp.relative_to(root))])
 for n,h in d.get('evidenceHashes',{}).items():
  # Historical report/snapshot evidence is immutable; source owners intentionally evolve.
  if any(n.endswith('/'+v+suffix) for v in [f'D{x:02}' for x in range(1,9)] for suffix in ['-check.md','-check-snapshot.json']):
   assert sha(root/n)==h,'Historical independent acceptance changed: '+n;historical.append({'from':u,'path':n,'sha256':h})
  # Freeze the actually inherited raw proof/command records without representing
  # immutable copies as newly manually audited application bodies.
  if n.startswith(str(task.relative_to(root))+'/') and (root/n).is_file():names.add(n)
# Freeze final raw gates, preserved attempts and focused proof producers/reports.
for folder in [reviews,task/'research',task/'tools']:
 for p in folder.rglob('*'):
  if p.is_file() and p.suffix in ['.json','.log','.txt','.html','.png','.py','.cjs','.mjs','.md','.yaml']:
   names.add(str(p.relative_to(root)))
# All relevant current layer contracts and shared routing guides.
for p in (root/'.trellis/spec/frontend').glob('*.md'):names.add(str(p.relative_to(root)))
for p in (root/'.trellis/spec/guides').glob('*.md'):names.add(str(p.relative_to(root)))
for n in ['prd.md','design.md','commit-groups.json']:names.add(str((task/n).relative_to(root)))
# Explicitly mutable task records and future plan outputs are never protected evidence.
mutable_names={'task.json','implement.md','progress.md','remediation-ledger.json','remediation-ledger.md','check.jsonl','implement.jsonl','debug.jsonl','coordinator-checkpoint.md','commit-plan.json','commit-plan.md'}
selfname=str((reviews/'D-final-check-snapshot.json').relative_to(root))
names={n for n in names if Path(n).name not in mutable_names and not n.endswith('.jsonl') and n!=selfname and not n.startswith('.trellis/tasks/09-30-src-quality-remediation/') and 'node_modules/' not in n and '__pycache__/' not in n}
# Parent audit/archived immutable evidence may be referenced by unit reports; protect
# only actually selected task evidence here, not mutable parent bookkeeping.
evidence={n:sha(root/n) for n in sorted(names)};assert all(v for v in evidence.values())
additions={}
for n,update in proof['coverageInventoryCorrection']['priorOmissions'].items():
 assert n in pre and pre[n]==post[n]==update['sha256']
 additions[n]={'unit':update['unit'],'before':None,'after':update['sha256'],'classification':'Existing D01 independently accepted evidence artifact, newly included in literal dirty ALL-task-mjs final scope; no byte change.','priorEvidence':units['D01']['snapshot'],'frozenGateInput':{'pre':pre[n],'post':post[n],'current':sha(root/n)}}
count_app=sum(n.startswith(('src/','tests/','scripts/')) for n in proof['after']);assert count_app==316
snapshot={'status':'PASS','role':'trellis-check','scope':'FINAL whole D01–D08; required Trellis last 2.2 full-scope acceptance','capturedAt':datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat(),'baselineRevision':proof['sourceBaseline'],'currentHEAD':proof['head'],'scopePaths':list(proof['after']),'scopeCount':335,'applicationPathCount':316,'taskMjsPathCount':19,'after':proof['after'],'unitUpdates':proof['unitUpdates'],'unitUpdateCount':78,'focusedCorrectionCount':76,'focusedBefore':focus['before'],'focusedAttribution':focus['unitAttribution'],'additionalScopeAcceptance':additions,'coverageInventoryCorrection':{'historicalIntegrationCoverageCount':333,'finalActualDirtyCoverageCount':335,'reason':'Existing coverage producer appends only reviewed after-map runners, omitting these two evidence artifacts. Independent dirty enumeration and renderer ALL-task-mjs enumeration include both. Producing tool and prior evidence are unchanged.','omittedPaths':list(additions),'allOmissionsAlreadyFrozenAtGate':True},'perFileCoverage':proof['coverage'],'cumulativeOverlaps':proof['overlaps'],'unitAcceptance':units,'historicalAcceptanceHashChecks':historical,'focusedMerge':proof['focusedMerge'],'gate':proof['gate'],'static':proof['static'],'ast':proof['ast'],'compilerGroups':proof['compilerGroups'],'routeRestoration':proof['route'],'report':str((reviews/'D-final-check.md').relative_to(root)),'reportSHA256':sha(reviews/'D-final-check.md'),'proof':{'producer':str((reviews/'D-final-independent-proof.py').relative_to(root)),'result':str((reviews/'D-final-independent-proof.json').relative_to(root)),'log':str((reviews/'D-final-independent-proof.log').relative_to(root)),'exitCode':0},'checkerChangedProductFiles':[],'checkerChangedProducingTools':[],'blockers':[],'fixesRequired':[],'sourceFreezeUnchanged':True,'evidenceHashes':evidence,'snapshotSelfHashExcluded':True,'mutableArtifactsExcluded':sorted(mutable_names),'limitations':['Prior whole-unit manual source acceptance inherited only on exact latest/focused final bytes; immutable original copies are hash/closure provenance, not a new manual audit.','Static zero-new-noncomplexity applies to 123 changed TS paths using complete baseline/current programs; 128 errors/273 warnings remain. Not all419 lint-clean; E/QG01 remains pending.','Existing integration coverage333 is partial inventory history; final acceptance335 includes two prior accepted evidence mjs omissions and78 explicit updates.','No redundant full/native/heavy reruns; final17 commands accepted on independently reconstructed759 pre/post/current identical inputs.','B01 trigger/optimizer root cause UNPROVEN; isolated caches/explicit fixture entry/additive document guard pass without weakened business checks or timeouts.','Local native fixtures/controlled transport do not establish live paid-provider/full-product E2E/acoustic/OOM/crash/all-browser/OS-IME behavior.','Recorded intermediate compiler tree/import proof does not prove every historical native runner executable against current owners.','38 fixed/13 E pending and EX01 verified observed; mutable ledger/status/checklist/context/parent progress excluded. No staging/commit/approval/push/archive/E work.']}
(reviews/'D-final-check-snapshot.json').write_text(json.dumps(snapshot,ensure_ascii=False,indent=2)+'\n')
for n,h in evidence.items():assert sha(root/n)==h,'Evidence drift during finalization '+n
assert not subprocess.check_output(['git','diff','--cached','--name-only'])
print(json.dumps({'status':'PASS','after':335,'application':316,'taskMjs':19,'unitUpdates':78,'focusedUpdates':76,'evidenceHashes':len(evidence),'gateInputs':759,'finalReport':snapshot['report'],'finalSnapshot':selfname},indent=2))
