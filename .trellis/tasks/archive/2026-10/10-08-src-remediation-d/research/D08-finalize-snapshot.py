from pathlib import Path
import json,hashlib,datetime,subprocess
root=Path.cwd();base=root/'.trellis/tasks/10-08-src-remediation-d';entryPath=base/'reviews/D08-entry.json';freezePath=base/'reviews/D08-product-freeze.json'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def rel(p):return str(p.relative_to(root))
def load(p):return json.loads(p.read_text())
entry=load(entryPath);freeze=load(freezePath);implementation=entry['ownedPaths'];current=freeze['testedInputs']
mismatches=[p for p,h in current.items() if not (root/p).exists() or sha(root/p)!=h]
assert not mismatches,mismatches
static=load(base/'reviews/D08-static-summary.json');ast=load(base/'research/D08-current-ast-summary.json')
assert not static['addedNoncomplexity']
assert all(not values['after'] or current.get(p)==values['after'] for p,values in static['hashes'].items())
assert ast['parseErrors']==0 and not ast['staticValueCycles']
originalDir=base/'research/D08-originals';entryManifest=load(originalDir/'entry-hashes.json')
originals={rel(p):{'entryPath':str(p.relative_to(originalDir)),'sha256':sha(p),'matchesEntry':sha(p)==entryManifest.get(str(p.relative_to(originalDir)))} for p in originalDir.rglob('*') if p.is_file() and p.name!='entry-hashes.json'}
assert all(v['matchesEntry'] for v in originals.values())
excluded={'D08-context.jsonl','D08-scope.md','D08-text-draft-plan.md','D08-writer-dispatch.md','D08-spec-draft.md','D08-current-ast-summary.json','D08-current-ast-results.json'}
artifacts=[p for p in (base/'research').glob('D08-*') if p.is_file() and p.name not in excluded and not p.name.startswith('D08-first-')]
artifacts += [p for p in originalDir.rglob('*') if p.is_file()]+[entryPath,freezePath]
artifactPaths=sorted(set(rel(p) for p in artifacts));scope=implementation+artifactPaths
before={p:entry['before'].get(p) for p in scope};after={p:sha(root/p) for p in scope}
notes={
'src/components/drafts/TextDraftField.tsx':'Keyed actual shared control; frozen callback owner; unchanged controller/status; immediate pending marker, local value, retry/latest.',
'src/components/shots/ShotTextField.tsx':'Ten typed free-text fields; actual patchShot field baseline; no duration/relation/slot owner changes.',
'src/components/story/BeatTextField.tsx':'Episode/beat/field draft key; three typed text fields and optional transactional baseline.',
'src/lib/useTextDraftRetention.ts':'Readable missing-row metadata only; synchronous per-field ref plus actual pendingIds render state used in memo; no timer/draft-text store.',
'src/components/shots/ShotRow.tsx':'All text cells migrated; pending joins actual viewport keep-alive; D03 typed columns, duration, relations and slots retained.',
'src/components/shots/ShotEditorPage.tsx':'Existing scope/last-row/manual guard extended for shot/beat text; filter/missing/virtualization protection; bulk/undo owners preserved; EOF normalized.',
'src/components/story/StoryPage.tsx':'Keyed query scope and missing beat/project/episode retention; actual manual guard reuse; main episode/import and relation/reorder/undo owners retained.',
'src/db/episodes.ts':'Optional three-field baseline, missing target rejection only baseline path, assertDraftBaseline inside original complete transaction; legacy calls preserved.',
 'tests/b06EditorSessions.test.ts':'Only new wrapper traversal/router-blocker seam; original B06 editor/import lifetime assertions remain.',
 'tests/d08TextDraftRepository.test.ts':'22 actual transactional storage cases covering all text fields, conflicts/convergence, merge, rollback, missing and legacy behavior.',
 'tests/d08TextDraftComponents.test.ts':'Five actual control/controller/adapter/retention cases in deterministic host with real effect/callback identity; not ReactDOM proof.',
 'tests/fixtures/d08/harness.tsx':'Actual ReactDOM/StoryPage/ShotEditorPage/WorkspaceChrome/native IDB/browser history; controlled command delay/failure and explicit force-remount seam.',
 'tests/fixtures/d08/index.html':'Local native fixture entry, no external resource.',
 'scripts/d08-browser-regression.mjs':'Thirteen actual native scenarios plus optional captured-original control; strict timeout and source/error/request assertions; JSON stdout/optional report override.'}
coverage={p:{'status':'reviewed','classification':'product' if p.startswith('src/') else 'test/native' if p in implementation else 'evidence/producer','note':notes.get(p,'D08-owned immutable original, command/result log, hash provenance, route/build byte proof, report or evidence producer; not attributed as product source.'),'findings':[]} for p in scope}
latest={};owners={};prior={}
for n in range(1,8):
 p=base/f'reviews/D0{n}-check-snapshot.json'
 if not p.exists():continue
 d=load(p);prior[f'D0{n}']={'path':rel(p),'sha256':sha(p)}
 for path,h in d.get('after',{}).items():
  if path.startswith('src/') and isinstance(h,str):latest[path]=h;owners[path]=f'D0{n}'
correctionPath=base/'reviews/D-final-fixture-check-snapshot.json';correction=load(correctionPath)
assert all((root/p).exists() and sha(root/p)==h for p,h in correction['after'].items())
overlap={p:{'latestAcceptedUnit':owners[p],'acceptedSHA256':h,'D08entrySHA256':entry['before'][p],'matches':h==entry['before'][p]} for p,h in latest.items() if p in implementation}
assert all(v['matches'] for v in overlap.values())
priorFailures=[]
for p,h in latest.items():
 if p in implementation:continue
 expected=correction['after'].get(p,h)
 if current.get(p)!=expected:priorFailures.append(p)
assert not priorFailures
coordinatorPaths=['reviews/D08-static-summary.json','reviews/D08-static-results.json','reviews/D08-static.log','research/D08-current-ast-summary.json','research/D08-current-ast-results.json','reviews/D08-ast.log','reviews/D08-first-static-summary.json','reviews/D08-first-static-results.json','reviews/D08-first-static.log','reviews/D08-first-product-freeze.json','research/D08-first-current-ast-summary.json','research/D08-first-current-ast-results.json','reviews/D08-first-ast.log']
coordinatorHashes={rel(base/p):sha(base/p) for p in coordinatorPaths if (base/p).exists()}
affected=load(base/'research/D08-affected-gate-records.json');pre=load(base/'research/D08-gate-records.json');assert all(g['exitCode']==0 and sha(Path(g['log']))==g['logSHA256'] for g in affected+pre)
native=load(base/'research/D08-native-current.json');assert native['status']=='PASS' and len(native['checks'])==13 and not native['errors'] and native['externalRequests']==0
failureNotes={'D08-finalizer-attempt1.log':'Exit1: evidence-only finalizer incorrectly expected two disjoint checker evidence producers in product/test manifest; now checks actual file bytes, all72 match.','D08-typecheck-attempt1.log':'Exit2: initial media text wiring referenced design-column id; actual content field corrected.','D08-focused-attempt1.log':'Exit1: three unrealistic hook-host dependency identity failures plus invalid script-range fixture; corrected test inputs without weakening assertions.','D08-native-attempt1.log':'Exit1: normal navigation ran before saving status committed; reached earlier three native cases.','D08-native-attempt2.log':'Exit1: waiting for category control outside original visible columns; four prior cases passed, caret assertion not yet reached.','D08-native-attempt3.log':'Exit1: ordinary post-reopen navigation before guard settled; eight native cases passed.','D08-first-static-summary.json':'Main-preserved first freeze scan: one new unnecessary revision memo dependency. Genuine pendingIds render-state correction followed.'}
preserved={rel(base/('reviews' if name.startswith('D08-first-') else 'research')/name):{'sha256':sha(base/('reviews' if name.startswith('D08-first-') else 'research')/name),'note':note} for name,note in failureNotes.items()}
record={
'status':'implementationPASS','unit':'D08','finding':'PU06','role':'trellis-implement','capturedAt':datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat(),'baselineRevision':'f062d694e61da6bcb574f7fb548803b9e54197eb','entryHEAD':entry['head'],'currentHEAD':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),
'reviewBoundary':'Entire D08/PU06 implementation; not independent acceptance, whole-D current gate, ledger closure or E/QG01.',
'entryArtifact':rel(entryPath),'entryArtifactSHA256':sha(entryPath),'entryCapturedAt':entry['at'],'preFirstEditEntryCount':entry['inputCount'],'actualEntryManifest':{'path':rel(originalDir/'entry-hashes.json'),'sha256':sha(originalDir/'entry-hashes.json'),'hashes':entryManifest},
'productPaths':[p for p in implementation if p.startswith('src/')],'testFixturePaths':[p for p in implementation if not p.startswith('src/')],'implementationPaths':implementation,'implementationCount':len(implementation),'scopePaths':scope,'scopeCount':len(scope),'before':before,'after':after,'unitBefore':{p:before[p] for p in implementation},'unitAfter':{p:after[p] for p in implementation},'newPaths':[p for p in implementation if before[p] is None],'deletedPaths':[],
'perFileCoverage':coverage,'originalCopies':originals,'originalCopiesAllMatchEntry':True,'exactEntryDiff':{'path':rel(base/'research/D08-entry.patch'),'sha256':sha(base/'research/D08-entry.patch')},
'sourceFreeze':{'path':rel(freezePath),'sha256':sha(freezePath),'at':freeze['at'],'sourceSetSHA256':freeze['sourceSetSHA256'],'inputSetSHA256':freeze['inputSetSHA256'],'sourceCount':len(freeze['sourceInputs']),'inputCount':len(current),'allCurrentInputHashesMatch':True,'all123StaticCurrentHashesMatch':True},'testedInputs':current,'sourceInputs':freeze['sourceInputs'],'productFixesFrozen':True,
'gateResults':{'currentAfterMemoFix':{'TypeScript':'PASS','focused':'10 files /169 tests PASS','D08native':'13 scenarios PASS, zero page errors/external requests'},'preMemoFixOnly':{'full':'159 files /2552 tests PASS','B01':'19 PASS','B07':'5 PASS','C01':'6 PASS','C02':'3 PASS','models':'197 files/85 providers/1855 models verified','build':'PASS with inherited chunk warning; 519 built files preserved'},'note':'PRE full/core/models/build are not current after memo correction. Whole batch runs final current gates after independent D08 acceptance.'},'commands':{'current':affected,'preMemoFix':pre,'originalNativeControl':{'command':['/Users/xiaomengdao/.nvm/versions/node/v24.11.0/bin/node','scripts/d08-browser-regression.mjs'],'environment':{'D08_BASELINE_ROOT':str(originalDir),'D08_PLAYWRIGHT_PATH':affected[-1]['environment']['D08_PLAYWRIGHT_PATH'],'D08_CHROMIUM_PATH':affected[-1]['environment']['D08_CHROMIUM_PATH']},'exitCode':0,'log':rel(base/'research/D08-original-native-control.log'),'logSHA256':sha(base/'research/D08-original-native-control.log'),'applicability':'Bounded actual original direct-write missing flush-registration negative control, not current whole UI acceptance'}},
'nativeReport':{'path':rel(base/'research/D08-native-current.json'),'sha256':sha(base/'research/D08-native-current.json'),'checks':native['checks'],'limits':native['limits']},'preservedFailures':preserved,'historicalAttemptLimits':'Failed attempt command/result logs preserved; old rewritten native runner revisions were not separately copied. Failed-stage logs are not claimed to execute the current final runner bytes.',
'correction':freeze['correction'],'routeRestoration':load(base/'research/D08-route-restoration.json'),'builtBytes':{'path':rel(base/'research/D08-built-byte-manifest.json'),'sha256':sha(base/'research/D08-built-byte-manifest.json'),'count':519,'stage':'PRE memo correction build only'},
'static':{'status':'PASS','scope':'123 cumulative D01-D08 TS sources versus committed C','versions':static['versions'],'baselineErrors':static['baselineErrors'],'baselineWarnings':static['baselineWarnings'],'currentErrors':static['currentErrors'],'currentWarnings':static['currentWarnings'],'addedNoncomplexity':static['addedNoncomplexity'],'complexityDebtDisclosed':True,'newD08LeavesNoDiagnostics':True,'note':'Same restored versions/rules, separate complete programs; cumulative inherited debt remains, not clean lint.'},'ast':{'status':'PASS','summary':ast,'noAnyAssertionGrowth':True,'scope':'Current global syntactic value graph; no computed-import/runtime graph claim'},'coordinatorEvidenceHashes':coordinatorHashes,
'priorUnitSnapshots':prior,'latestAcceptedSourceOwnerCount':len(latest),'priorUnitDirectOverlaps':overlap,'priorOwnerFailures':priorFailures,'excludedConcurrentCorrection':{'snapshot':rel(correctionPath),'sha256':sha(correctionPath),'count':len(correction['after']),'currentHashesMatch':True,'attribution':'Independent checker, not D08; five comparator/catalog tests, sourceSnapshots and Gallery EOF only'},
'ownedArtifactHashes':{p:after[p] for p in artifactPaths},'postGateEvidenceProducers':[rel(base/'research/D08-finalize-snapshot.py')],'completedReportProvenance':{'path':rel(base/'research/D08-implementation.md'),'sha256':sha(base/'research/D08-implementation.md')},'snapshotSelfHashExcluded':'Snapshot is the index, excluded from its recursive after set; final caller computes its hash.',
'blockers':[],'notClosed':['Independent whole-D08 technical acceptance','Whole-batch current integration gates','Coordinator spec/ledger closure and human commit approval','E/QG01'],
'limitations':[native['limits'],'Deterministic hook host does not prove ReactDOM/Radix/native scheduling; actual native fixture supplements it.','No new timer/store/global guard; debouncedDraft/DraftStatus/patchShot/duration/shared manual guard unchanged.','No commits/staging/push/install/children/spec/ledger/archive actions.']}
output=base/'reviews/D08-implement-snapshot.json';output.write_text(json.dumps(record,indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'status':record['status'],'implementationCount':len(implementation),'scopeCount':len(scope),'testedInputs':len(current),'snapshotSHA256':sha(output),'reportSHA256':record['completedReportProvenance']['sha256'],'freezeSHA256':sha(freezePath),'sourceUnchanged':True,'originalCopiesMatch':True,'priorOwnerFailures':priorFailures},indent=2))
