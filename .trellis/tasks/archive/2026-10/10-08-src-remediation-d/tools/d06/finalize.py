from pathlib import Path
import json,hashlib,datetime,subprocess
root=Path('.trellis/tasks/10-08-src-remediation-d');tools=root/'tools/d06'
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest() if Path(p).exists() else None
entry=json.loads((tools/'entry.json').read_text());freeze=json.loads((root/'reviews/D06-product-freeze.json').read_text())
product=['src/domain/generationCapabilities.ts','src/domain/output.ts','src/lib/agent/generationProfiles.ts','src/components/agent/GenerationReview.tsx','src/components/workspace/ProjectSettingsPanel.tsx']
tests=['tests/d06Capabilities.test.ts','tests/fixtures/d06/harness.tsx','tests/fixtures/d06/index.html']
ownedReviews=['D06-native.mjs','D06-native.json','D06-native-original.json','D06-compiler-negatives.mjs','D06-compiler-negatives.json','D06-product-freeze.json','D06-route-tree-proof.json','D06-semantic-proof.json','D06-entry-metrics.json']
evidence=[p for p in tools.rglob('*') if p.is_file()]+[root/'reviews'/name for name in ownedReviews]+[root/'research/D06-implementation.md']
scope=sorted(set(product+tests+[str(p) for p in evidence]))
sourceMismatches=[p for p,h in freeze['hashes'].items() if sha(p)!=h]
assert not sourceMismatches,sourceMismatches
copyProof={}
for p in (tools/'before').rglob('*'):
 if p.is_file():
  original=str(p.relative_to(tools/'before'));assert sha(p)==entry['hashes'][original],original;copyProof[str(p)]={'originalPath':original,'originalSha256':entry['hashes'][original],'copySha256':sha(p)}
before={p:entry['hashes'].get(p) if p in product+tests else None for p in scope};after={p:sha(p) for p in scope}
assert all(h for h in after.values())
gates=[json.loads(line) for line in (tools/'gates.jsonl').read_text().splitlines()]
for gate in gates:assert sha(gate['log'])==gate['sha256'],gate['log']
finalGates=[g for g in gates if Path(g['log']).stem.endswith('fallback-corrected')];assert len(finalGates)==12 and all(g['exitCode']==0 for g in finalGates)
coordinatorPaths=[root/'reviews'/name for name in ['D06-static-results.json','D06-static-summary.json','D06-static.log','D06-ast.log','D06-coordinator-scan-entry.json']]+[root/'research'/name for name in ['D06-current-ast-summary.json','D06-current-ast-results.json']]
coordinator={str(p):sha(p) for p in coordinatorPaths};assert all(coordinator.values())
static=json.loads((root/'reviews/D06-static-summary.json').read_text());ast=json.loads((root/'research/D06-current-ast-summary.json').read_text())
assert not static['addedNoncomplexity'] and not ast['staticValueCycles'] and not ast['parseErrors']
staticMismatches=[]
for p,row in static['hashes'].items():
 if sha(p)!=row['after']:staticMismatches.append(p)
assert not staticMismatches,staticMismatches
latest={};overlaps={}
for unit in ['D01','D02','D03','D04','D05']:
 path=root/f'reviews/{unit}-check-snapshot.json';snap=json.loads(path.read_text())
 for p,h in snap.get('after',{}).items():
  if p.startswith('src/'):latest[p]={'unit':unit,'hash':h}
 overlaps[unit]={p:{'acceptedAfter':snap.get('after',{})[p],'entry':entry['hashes'][p],'matches':snap.get('after',{})[p]==entry['hashes'][p]} for p in product+['src/components/agent/AgentGenerationBatches.tsx'] if p in snap.get('after',{})}
latestProof={p:{'latestAcceptedUnit':owner['unit'],'acceptedAfter':owner['hash'],'entry':entry['hashes'].get(p),'current':sha(p),'entryMatches':entry['hashes'].get(p)==owner['hash'],'unchangedByD06':sha(p)==entry['hashes'].get(p)} for p,owner in latest.items() if p in entry['hashes']}
latestMismatches=[p for p,row in latestProof.items() if not row['entryMatches']];assert not latestMismatches,latestMismatches
acceptedEvidence={str(root/p):{'current':sha(root/p),'accepted':json.loads((root/'reviews/D05-check-snapshot.json').read_text())['after'][str(root/p)]} for p in ['reviews/D05-compiler-negatives.mjs','reviews/D05-compiler-negatives.json','tools/d05/runtime-catalog.json']}
assert all(row['current']==row['accepted'] for row in acceptedEvidence.values())
notes={
 product[0]:'Pure actual capability leaf; all scalar facts/order/options/defaults/transitions validate via original matrix; zero restored lint diagnostics; no imports/cycle.',
 product[1]:'Compatibility exports delegate leaf. Project parser/profileVersion/native builder unchanged; defaults/ordered accumulated scalar issues compared to original.',
 product[2]:'D05 Spec/Args declarations unchanged. Reused scalar policy with original target/input/hidden-field/limit/error ordering/native lowering. Ordered seven advertisement bytes and 89 tools retained.',
 product[3]:'Actual shared single/batch fields consume projector. Full review/session/approval/prefs owner bodies unchanged. Original-native comparison and fallback regression preserved/corrected. Cyclomatic growth recorded.',
 product[4]:'Actual Radix defaults consume projector; invalid imported values retained. Existing strict CAS/rebase/dirty guard/retry/adopt-latest paths exercised. No paid submit. Cyclomatic growth recorded.',
 tests[0]:'Six original/current matrix and strict/permissive/control tests, actual captured D05 source; arrays/default/native keys/exact errors/roles/limits, frame representation and explicit user apply preserved.',
 tests[1]:'Isolated actual single/batch/project UI/native DB. Real pending approval, local run callback only; synthetic illegal proposals explicit, proper unique provider schema, state/storage gates.',
 tests[2]:'Local Vite isolated fixture entry, no external dependencies.'}
coverage=[]
for p in scope:
 if p in notes:note=notes[p];kind='product' if p in product else 'test/fixture'
 elif p in copyProof:note='Immutable original byte copy; matches pre-first-edit entry; evidence not new implementation.';kind='original evidence copy'
 elif '/failures/' in p:note='Preserved failed native setup/locator/regression artifact; historical failure, not acceptance.';kind='failure evidence'
 elif p.endswith('.log'):note='Exact historical/final gate/proof output; hash verified; applicable command/outcome in gate map.';kind='log evidence'
 elif p.endswith('.mjs') or p.endswith('.py'):note='Writer-owned implementation/verification/evidence helper; tested runner inputs separately identified; later report helper is not retrospectively claimed gate-tested.';kind='runner/helper'
 else:note='Writer-owned current freeze/report/proof/evidence; final hash indexed without recursive self hashing.';kind='evidence'
 coverage.append({'path':p,'status':'PASS','classification':kind,'before':before[p],'after':after[p],'note':note})
obj={'status':'PASS','role':'trellis-implement','unit':'D06/AU07','capturedAt':datetime.datetime.now().astimezone().isoformat(),'baselineRevision':entry['baseline'],'entryHEAD':entry['head'],'currentHEAD':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'scopePaths':scope,'scopeCount':len(scope),'productPaths':product,'testFixturePaths':tests,'before':before,'after':after,'deletedPaths':[],'perFileCoverage':coverage,'entryCapture':{'path':str(tools/'entry.json'),'sha256':sha(tools/'entry.json'),'capturedPaths':len(entry['hashes'])},'originalCopies':copyProof,'sourceFreeze':freeze,'testedInputMismatches':sourceMismatches,'heavyGatesFinished':True,'gateResults':finalGates,'allAttempts':gates,'coordinatorEvidenceHashes':coordinator,'static':static,'ast':ast,'staticCurrentMismatches':staticMismatches,'actualEntryMetrics':json.loads((root/'reviews/D06-entry-metrics.json').read_text())['rows'],'priorDirectOverlaps':overlaps,'latestAcceptedOwnerProof':latestProof,'latestAcceptedMismatches':latestMismatches,'acceptedD05EvidencePreserved':acceptedEvidence,'producerConsumers':notes,'semanticProof':{'path':str(root/'reviews/D06-semantic-proof.json'),'sha256':sha(root/'reviews/D06-semantic-proof.json')},'routeFormattingProof':{'path':str(root/'reviews/D06-route-tree-proof.json'),'sha256':sha(root/'reviews/D06-route-tree-proof.json'),'onlyTestedRawByteDrift':'src/routeTree.gen.ts','same3995Tokens':True},'nativeProof':{'current':str(root/'reviews/D06-native.json'),'original':str(root/'reviews/D06-native-original.json'),'externalRequests':0,'paidRequests':0,'pageErrors':[],'checks':10},'runnerReportSideEffects':['D06-native.mjs writes reviews/D06-native.json; D06_BASELINE_UI=1 writes original UI proof. Final integration must prohibit baseline env. Preserve accepted proof before rerunning or use destination-only runner clone.','D06-compiler-negatives.mjs writes reviews/D06-compiler-negatives.json. Current actual diagnostics stable across two corrected/pre-corrected final gates; report remains snapshot-hashed.'],'evidenceHashes':{str(p):sha(p) for p in evidence},'report':str(root/'research/D06-implementation.md'),'reportSha256':sha(root/'research/D06-implementation.md'),'reportHelpersAfterSourceFreeze':['entry-metrics.mjs','semantic-proof.mjs','finalize.py'],'reportHelperLimits':'These read-only evidence helpers do not change tested inputs; entry metrics uses full hash-verified original program and actual restored rules, not current-source resolution masquerading as entry. Snapshot finalizer does not prove independent acceptance.','notClosed':['AU07 ledger','D07','D08','whole-D','E/QG01','commit approval'],'limitations':['Inherited UI cyclomatic complexity grows despite reduced cognitive complexity; no clean whole-project lint claim.','Native fixtures use local controlled model/storage gates and record resume without paid execution; no entitlement/provider reliability/media decode/full product E2E claim.','Current DB unique definitionId prohibits persisted multiple-instance fixture; pure ambiguity tests remain separate.','Existing MemoryEditor key/build chunk warnings remain.','No source/test/native/compiler edits after source freeze; all current maps verified.','Independent whole-unit review and spec/ledger/status remain main/checker responsibilities.']}
out=root/'reviews/D06-implement-snapshot.json';out.write_text(json.dumps(obj,indent=2,ensure_ascii=False)+'\n');print(json.dumps({'snapshot':str(out),'scopeCount':len(scope),'originalCopies':len(copyProof),'sourceInputs':len(freeze['hashes']),'mismatches':sourceMismatches,'all12FinalGatesPASS':True,'staticCurrentMismatches':staticMismatches,'priorAcceptedOwners':len(latestProof)}))
