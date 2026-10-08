from pathlib import Path
import json,hashlib,datetime,subprocess
root=Path('.trellis/tasks/10-08-src-remediation-d');ev=root/'research/D07-evidence'
def read(p):return json.loads(Path(p).read_text())
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest() if Path(p).is_file() else None
entry=read(ev/'entry.json');freeze=read(ev/'PRODUCTFROZEN.json')
product=sorted(p for p in freeze['unitChanges'] if p.startswith('src/'))
tests=sorted(p for p in freeze['unitChanges'] if p.startswith('tests/'))
assert len(product)==11 and len(tests)==2
mismatches=[p for p,h in freeze['testedInputs'].items() if sha(p)!=h]
assert not mismatches,mismatches
latest={}
predecessors=[]
for n in range(1,7):
 unit=f'D{n:02d}';p=root/f'reviews/{unit}-check-snapshot.json';s=read(p);predecessors.append({'unit':unit,'path':str(p),'sha256':sha(p),'status':s['status']})
 after=s.get('after',{});before=s.get('before',{})
 chosen=s.get('productPaths') or [p for p in after if p.startswith('src/') and before.get(p)!=after[p]]
 for path in chosen:
  if path.startswith('src/') and (isinstance(after.get(path),str) or after.get(path) is None):latest[path]={'unit':unit,'acceptedAfter':after.get(path),'snapshot':str(p),'snapshotSHA256':sha(p)}
# The accepted D06 checker records earlier final ownership explicitly.
d06=read(root/'reviews/D06-check-snapshot.json')
for record in d06['latestAcceptedOwners']:
 path=record['path']
 if path not in d06['productPaths']:latest[path]={'unit':record['unit'],'acceptedAfter':record['acceptedAfter'],'snapshot':str(root/'reviews/D06-check-snapshot.json'),'snapshotSHA256':sha(root/'reviews/D06-check-snapshot.json')}
prior=[]
for path,record in sorted(latest.items()):
 record={**record,'path':path,'entry':entry['hashes'].get(path),'current':sha(path),'directD07Overlap':path in product}
 record['entryMatchesAccepted']=record['entry']==record['acceptedAfter'];record['currentMatchesAccepted']=record['current']==record['acceptedAfter'];prior.append(record)
assert not [r for r in prior if not r['entryMatchesAccepted'] or not r['currentMatchesAccepted']],prior
originals=[]
for p in sorted((ev/'before').rglob('*')):
 if not p.is_file():continue
 path=str(p.relative_to(ev/'before'))
 originals.append({'copy':str(p),'sourcePath':path,'copyHash':sha(p),'entryHash':entry['hashes'].get(path),'matchesEntry':sha(p)==entry['hashes'].get(path)})
assert all(r['matchesEntry'] for r in originals)
stat=read(root/'reviews/D07-static-summary.json');ast=read(root/'research/D07-current-ast-summary.json')
statMismatch=[p for p,h in stat['hashes'].items() if sha(p)!=h['after']];assert not statMismatch
assert not stat['addedNoncomplexity'] and not ast['parseErrors'] and not ast['staticValueCycles']
staticPaths=[root/'reviews/D07-static-summary.json',root/'reviews/D07-static-results.json',root/'reviews/D07-static.log',root/'research/D07-current-ast-summary.json',root/'research/D07-current-ast-results.json',root/'reviews/D07-ast.log']
owned=[p for p in ev.rglob('*') if p.is_file()]+[root/'reviews/D07-entry.json',root/'reviews/D07-product-freeze.json',root/'research/D07-implementation.md']
coverage={
 'src/lib/ai/baseUrl.ts':'Unchanged trim/trailing-slash normalization; neutral leaf, direct imports and compatibility export.',
 'src/lib/ai/requestBoundary.ts':'Exactly one fetch with mandatory browser policy; native/bounded JSON selection delegates original reader; success error identity and optional non2xx diagnostics; no decoder/retry/timeout/auth.',
 'src/lib/ai/apimart.ts':'Native JSON both branches, shared abort detection; local URL/key/init/upload/Ext headers/code/status/results preserved; original/current normal+negative controls.',
 'src/lib/ai/apimartAudio.ts':'Once fetch/public CDN; music4MiB/error64KiB fatal JSON; original speech Blob/MIME/audio32MiB/uncertainty/GET recovery unchanged.',
 'src/lib/ai/aihubmix.ts':'providerRoot same trim semantics and guards; public/protected headers and task envelope exception; native inline JSON; protected diagnostics4MiB/64KiB and binary256MiB retained.',
 'src/lib/ai/mimoSpeech.ts':'Fetch/base leaf only; exact text/error fallback/envelope/base64/MIME/model/preset/clone contracts unchanged.',
 'src/lib/ai/tavily.ts':'Fetch only, local timer/controller and2MiB nonfatal parser; status/cancel/serialized outputs/key guards unchanged.',
 'src/lib/ai/openaiCompatible.ts':'Compatibility normalization export and additive third signal; explicit default browser policy; native success/error readers; abort before fetch-only TypeError fallback, no POST after body failure.',
 'src/lib/ai/chatStream.ts':'Only fetch/base imports; exact request body materialization and original output/tools/SSE/callback/partial/finish owner retained.',
 'src/lib/ai/responsesStream.ts':'Only fetch/base imports; exact response input and original post-header cancel/SSE/output/continuation/flush behavior retained.',
 'src/lib/ai/connectors.ts':'One-line actual generic discovery signal forwarding; provider specialized probes/action compatibility boundary unchanged.',
 'tests/d07RequestBoundary.test.ts':'18 meaningful direct boundary/adapter negatives and normal controls: native vs bounded/status/cleanup/abort/redaction/one paid POST and separate GET.',
 'tests/d07RequestWire.test.ts':'27 original/current actual adapter normal controls, effective request body/headers/calls/results/read counts/callback comparisons; unchanged metadata/vision dependencies shared explicitly.',
}
paths=product+tests
scopePaths=paths+[str(p) for p in sorted(set(owned))]
before={p:entry['hashes'].get(p) for p in paths};after={p:sha(p) for p in paths}
gates=[json.loads(line) for line in (ev/'gates.jsonl').read_text().splitlines()]
now=datetime.datetime.now().astimezone().isoformat()
snapshot={
 'status':'implementationPASS','unit':'D07','finding':'PM07','role':'trellis-implement','capturedAt':now,'baselineRevision':entry['baseline'],'entryHEAD':entry['head'],'currentHEAD':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),
 'reviewBoundary':'Writer implementation handoff, no independent acceptance or finding closure. Main owns specs/ledger/checker and D08.',
 'entryArtifact':str(ev/'entry.json'),'entryArtifactSHA256':sha(ev/'entry.json'),'entryCapturedAt':entry['at'],'preFirstEditEntryCount':len(entry['hashes']),'entryGitStatus':str(ev/'entry-git-status.txt'),'entryGitStatusSHA256':sha(ev/'entry-git-status.txt'),
 'productPaths':product,'testFixturePaths':tests,'scopePaths':scopePaths,'scopeCount':len(scopePaths),'before':{p:entry['hashes'].get(p) for p in scopePaths},'after':{p:sha(p) for p in scopePaths},'unitBefore':before,'unitAfter':after,'newPaths':[p for p in paths if before[p] is None],'deletedPaths':[p for p in paths if after[p] is None],
 'perFileCoverage':{p:{'classification':'product-source' if p in product else 'regression-test','before':before[p],'after':after[p],'note':coverage[p],'status':'implementation-reviewed-awaiting-independent-check'} for p in paths},
 'sourceFreeze':{'path':str(ev/'PRODUCTFROZEN.json'),'mirrorPath':str(root/'reviews/D07-product-freeze.json'),'sha256':sha(ev/'PRODUCTFROZEN.json'),'status':freeze['status'],'at':freeze['at'],'sourceCount':len(freeze['sourceInputs']),'testedInputCount':len(freeze['testedInputs']),'sourceSetSHA256':freeze['sourceSetSHA256'],'inputSetSHA256':freeze['inputSetSHA256'],'currentHashMismatches':mismatches},
 'firstImmediateFreeze':{'path':str(ev/'PRODUCTFROZEN-build.json'),'sha256':sha(ev/'PRODUCTFROZEN-build.json'),'at':'2026-10-08T15:07:11.077843+08:00','sourceCount':438,'testedInputCount':674,'observedChanges':14,'historical':'Build-generated route formatting only subsequently restored with3995-token and entry/predecessor hash proof; no adapter/test/config/native changes.'},
 'productFixesFrozen':True,'heavyGatesFinished':True,'testedInputs':freeze['testedInputs'],'sourceInputs':freeze['sourceInputs'],'originalCopies':originals,'originalCopiesAllMatchEntry':True,
 'policyMatrix':{'path':str(ev/'policy-matrix.md'),'sha256':sha(ev/'policy-matrix.md'),'owner':'writer; persisted during implementation before tests/heavy gates'},'actualImportReadEvidence':{'path':str(ev/'entry-consumers.txt'),'sha256':sha(ev/'entry-consumers.txt')},'exactEntrySourceDiff':{'path':str(ev/'source-diff.patch'),'sha256':sha(ev/'source-diff.patch')},
 'gateResults':gates,'commands':{'heavyGateExecution':'serial explicit local pnpm; no installation/live paid call','focused':'31files/900tests','full':'157files/2525tests','leafStatic':'0diagnostics','type':'PASS','build':'PASS inherited large-chunk warning','models':'197files/85providers/1855models'},
 'preservedFailures':{'migrationAndType':{'path':str(ev/'attempts.json'),'sha256':sha(ev/'attempts.json')},'initialTestAttempts':[g for g in gates if g['exitCode']!=0],'resolution':'Fixture prompt and shared untouched metadata/vision dependencies fixed; physical SSE event fixture completed. No production parser/assertion/timeout/resource limit weakened.'},
 'priorUnitSnapshots':predecessors,'latestAcceptedOwners':prior,'priorUnitDirectOverlaps':[r for r in prior if r['directD07Overlap']],'priorOwnerFailures':[],
 'static':{'owner':'main coordinator, read-only attributed evidence','summaryPath':str(root/'reviews/D07-static-summary.json'),'files':stat['files'],'versions':stat['versions'],'policy':stat['policy'],'before':[stat['baselineErrors'],stat['baselineWarnings']],'after':[stat['currentErrors'],stat['currentWarnings']],'addedNoncomplexity':stat['addedNoncomplexity'],'addedComplexity':stat['addedComplexity'],'newFileDiagnostics':stat['newFileDiagnostics'],'currentHashes':stat['hashes'],'hashMismatches':statMismatch,'limit':'Cumulative D01-D07 versus C; inherited static debt remains; new leaves separately clean.'},
 'ast':{'owner':'main coordinator, read-only attributed evidence','summaryPath':str(root/'research/D07-current-ast-summary.json'),'summary':ast,'limit':'Current global static value graph; not dynamic/live-provider behavioral proof.'},
 'coordinatorEvidenceHashes':{str(p):sha(p) for p in staticPaths},'ownedArtifactHashes':{str(p):sha(p) for p in sorted(set(owned))},
 'completedReportProvenance':{'path':str(root/'research/D07-implementation.md'),'sha256':sha(root/'research/D07-implementation.md'),'writtenAfterProductFreeze':True,'testedInputClaim':False},
 'postGateEvidenceProducers':{'routeTokenProof':{'runner':str(ev/'route-tree-proof.mjs'),'runnerSHA256':sha(ev/'route-tree-proof.mjs'),'result':str(ev/'route-tree-proof.json'),'resultSHA256':sha(ev/'route-tree-proof.json'),'gate':'route-tree-proof; output-only evidence and restoration of actual entry formatting'},'finalizer':{'path':str(Path(__file__)),'sha256':sha(Path(__file__)),'classification':'Read-only source/input/hash attribution and writing this snapshot; not another product gate.'}},
 'nativeBrowserApplicability':'No UI/IDB transaction/persistence/recovery-command boundary changed; no new native/browser gate. Existing runtime/tool/stream/resource/paid recovery tests included; earlier accepted native/compiler reports preserved.',
 'blockers':[],'notClosed':['D07/PM07 independent acceptance','D08','whole D integration','E/QG01'],
 'limitations':['Native .json()/generic native error text intentionally remain uncapped; native mock reader ignoring fetch signal has no new bounded cancellation promise.','Inline finite seam/declared-size witness proves policy choice without huge allocation; no OOM/network/live supplier evidence.','One requestOnce invocation preserves legacy generic follow redirect and does not prove one physical network exchange.','Existing adapter error/result conversion remains local; original error identity is directly asserted at transport/JSON leaf and existing public semantic mappings are retained.','Wire equality normalizes original implicit same-origin/follow defaults; timing/retrieved timestamps excluded. Original adapter runs share only unchanged metadata/vision dependencies, explicitly substituted and hash-preserved.','Static debt, build chunk warnings and later whole-batch independent/native acceptance remain.'],
}
snapshotPath=root/'reviews/D07-implement-snapshot.json';snapshotPath.write_text(json.dumps(snapshot,indent=2)+'\n')
print(json.dumps({'status':snapshot['status'],'productFiles':len(product),'newTests':len(tests),'ownedScope':len(scopePaths),'originalCopies':len(originals),'priorAcceptedOwners':len(prior),'priorDirectOverlap':len(snapshot['priorUnitDirectOverlaps']),'testedInputHashMismatches':len(mismatches),'staticHashMismatches':len(statMismatch),'snapshot':str(snapshotPath),'sha256':sha(snapshotPath),'report':str(root/'research/D07-implementation.md'),'reportSha256':sha(root/'research/D07-implementation.md')}))
